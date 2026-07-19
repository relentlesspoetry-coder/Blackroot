(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.20.1: the slash styles this renderer actually draws a distinct silhouette for. Declared HERE,
  // beside the branches that implement them, and consumed by validateSpellShapes() so a spell cannot
  // author a vfxStyle nothing knows how to draw ('slam' shipped exactly that way - see V0.20.0).
  // This is NOT a tautology: the styles are DECLARED here and REQUESTED by data/spells.js, two
  // independent sources. tools/check-vfx-styles.js additionally asserts this list matches the real
  // `e.style === '...'` branches below, so the registry cannot silently drift from the drawing code.
  DR.SLASH_STYLES = Object.freeze([
    'slash',   // baseline sweep
    'claw',    // twin arcs (beasts)
    'slam',    // overhead smash + ground shock
    'crush',   // blunt pound + debris, no blade
    'cast',    // glyph ring + motes, no blade
    'split',   // vertical rend, halves parting
    'thrust',  // straight counter-stab + tip flash
    'wild',    // two crossing off-balance arcs
    'execute', // decisive downward arc + glint
    'shatter', // shards bursting from the block point
    'break'    // hard zigzag crack
  ]);

  // Per-kind visual identity for Assassin projectiles/impacts, so each spell reads
  // as the weapon it actually is: tumbling thrown steel, a fast light bolt, a heavy
  // armor-punching quarrel, a green venom bolt, a lethal crimson executioner bolt.
  const ASSASSIN_PROJECTILE_KINDS = {
    knife:         { trail: '#dfe6e5', core: '#dfe8e7', dark: '#252b2d', hi: '#ffffff', width: 3.4, len: 48, size: 3.7, spin: true,  dash: true },
    blade:         { trail: '#e6eeee', core: '#eef6f6', dark: '#2a3133', hi: '#ffffff', width: 3.0, len: 40, size: 3.4, spin: true,  dash: true },
    crossbow:      { trail: '#8c9497', core: '#aeb7bb', dark: '#0e1112', hi: '#f5ffff', width: 3.4, len: 64, size: 4.2, smoke: '#24272a' },
    heavyBolt:     { trail: '#9fb0c4', core: '#c7d6e6', dark: '#0c1016', hi: '#ffffff', width: 5.2, len: 88, size: 5.4, smoke: '#1a2230', streak: '#dcebff' },
    venomBolt:     { trail: '#74ee62', core: '#9cff86', dark: '#0f1f10', hi: '#e8ffdc', width: 4.2, len: 64, size: 4.2, motes: '#6fe258' },
    executionBolt: { trail: '#c23145', core: '#e2455a', dark: '#1c0709', hi: '#ffd7dd', width: 5.0, len: 78, size: 5.2, glint: '#ff6076' },
    poisonDart:    { trail: '#74ee62', core: '#78f26a', dark: '#101810', hi: '#c6ffd0', width: 5.0, len: 48, size: 3.2, motes: '#73e95f' }
  };
  const ASSASSIN_IMPACT_KINDS = {
    knife:         { color: '#eef4f3', sparks: 11, sparkR: 24, ground: '#18090a', steel: true },
    blade:         { color: '#eef4f3', sparks: 10, sparkR: 22, ground: '#18090a', steel: true },
    crossbow:      { color: '#f0f3ec', sparks: 11, sparkR: 24, ground: '#18090a' },
    heavyBolt:     { color: '#dfeaf5', sparks: 14, sparkR: 32, ground: '#0e1420', pierce: true },
    venomBolt:     { color: '#75e66a', sparks: 8,  sparkR: 24, ground: '#143e16', poison: true },
    executionBolt: { color: '#e2455a', sparks: 15, sparkR: 34, ground: '#1c0709', execute: true },
    poisonDart:    { color: '#75e66a', sparks: 7,  sparkR: 24, ground: '#143e16', poison: true }
  };

  DR.EffectsRenderer = {
    install(Game) {
      Object.assign(Game.prototype, {

clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); },

easeOutCubic(t) { t = this.clamp01(t); return 1 - Math.pow(1 - t, 3); },

easeInOutCubic(t) { t = this.clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },

easeOutBack(t) { t = this.clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },

easeOutExpo(t) { t = this.clamp01(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },

smoothstep(edge0, edge1, x) { const t = this.clamp01((Number(x) - Number(edge0)) / Math.max(0.0001, Number(edge1) - Number(edge0))); return t * t * (3 - 2 * t); },

pulse01(t) { return 0.5 - 0.5 * Math.cos(this.clamp01(t) * Math.PI * 2); },

vfxHash(seed) { const x = Math.sin(Number(seed || 0) * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); },

vfxRand(seed, salt = 0) { return this.vfxHash(Number(seed || 0) + Number(salt || 0) * 101.13); },

flickerNoise(seed, t) { return 0.72 + this.vfxRand(seed, Math.floor(Number(t || 0) * 28)) * 0.28; },

hexToRgb(color) {
      const raw = String(color || '#ffffff').trim();
      const hex = raw[0] === '#' ? raw.slice(1) : raw;
      // Clamp each channel to a valid 0-255 int; a malformed/NaN channel falls back
      // to 255 so rgba() can never emit "rgba(NaN,...)" and crash addColorStop.
      const ch = v => { const n = parseInt(v, 16); return Number.isFinite(n) ? Math.max(0, Math.min(255, n)) : 255; };
      if (hex.length === 3) return { r: ch(hex[0] + hex[0]), g: ch(hex[1] + hex[1]), b: ch(hex[2] + hex[2]) };
      if (hex.length >= 6) return { r: ch(hex.slice(0, 2)), g: ch(hex.slice(2, 4)), b: ch(hex.slice(4, 6)) };
      return { r: 255, g: 255, b: 255 };
},

rgba(color, alpha = 1) { const c = this.hexToRgb(color); return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, Number(alpha) || 0))})`; },

vfxScreen(x, y, height = 0) {
      const tile = this.tileAt(Number(x) || 0, Number(y) || 0);
      return this.worldToScreen(Number(x) || 0, Number(y) || 0, (tile?.elev || 0) + Number(height || 0));
},

vfxStyle(e = {}) {
      const key = `${e.sourceClass || ''} ${e.school || ''} ${e.kind || ''} ${e.style || ''} ${e.label || ''}`.toLowerCase();
      if (/poison|venom|dart/.test(key)) return { primary: e.color || '#72df68', secondary: e.color2 || '#b7ffd2', dark: '#102014', smoke: '#24451f', motion: 'bubble' };
      // V0.20.21: 'rogue' joins the blade line rather than getting a palette of its own - it is the
      // same silver-and-blood identity as the assassin, and inventing a second one would be a
      // difference the player cannot read. Reachable only since casters began publishing sourceClass.
      if (/assassin|rogue|knife|crossbow|marked|tripwire/.test(key)) return { primary: e.color || '#d8dde0', secondary: e.color2 || '#b31224', dark: '#0b0708', smoke: '#2b2528', motion: 'precise' };
      // V0.20.22: the four classes that matched NOTHING and drew the generic default. Placed HIGH -
      // above the necro/wizard/cleric lines - because these are tested in ORDER and their own spell
      // names collide with those schools: the Shaman casts Lightning Spark, Stormcall, Chain Storm
      // and Ghostfire (all -> the wizard line), the Summoner casts Arcane Spark, Soul Link and
      // Elemental Rotation ('Rotation' starts with 'rot' -> the necro line), the Enchanter casts
      // Arcane Binding and Glyphstorm. Placed low, every one of those would wear another school's
      // colours and the class term would never fire - the exact 'warden' shadow bug from V0.20.21.
      // Kept BELOW the poison and blade lines, which name an effect rather than a caster and should
      // still win. \b-anchored so 'summoner' is not claimed by a 'Summon Familiar' and 'ranger' not
      // by a stray 'stranger'. Motions reuse existing draw branches - no new renderer was invented.
      if (/\bshaman|ancestor|totem|tempest/.test(key)) return { primary: e.color || '#5fd8e0', secondary: e.color2 || '#ffd98a', dark: '#0b2026', smoke: '#2b5a63', motion: 'wisp' };
      if (/\bsummoner|planar|servitor|familiar/.test(key)) return { primary: e.color || '#9d7dff', secondary: e.color2 || '#e2d6ff', dark: '#150d28', smoke: '#3a2a60', motion: 'rune' };
      if (/\benchanter|mesmer|illusor|phantom|charm/.test(key)) return { primary: e.color || '#ff8fd0', secondary: e.color2 || '#ffe3f4', dark: '#24101d', smoke: '#5c2b48', motion: 'wave' };
      if (/\branger|quarry|hunter|arrow|volley/.test(key)) return { primary: e.color || '#a8d86a', secondary: e.color2 || '#d9b378', dark: '#141b0e', smoke: '#3c4a29', motion: 'precise' };
      // V0.20.21: '\brot', not 'rot' - unanchored, it also matched the 'rot' inside 'pROTect' and,
      // being tested first, shadowed the 'protect' term the cleric line below lists: every Cleric
      // protection spell has been rendering as necromancy. Word-START only, so 'rot'/'rotting'/
      // 'rotten' still match. Same family as the ward/warden shadow fixed below.
      if (/necro|bone|shadow|curse|disease|\brot|soul|grave/.test(key)) return { primary: e.color || '#a7ff77', secondary: e.color2 || '#dce8cf', dark: '#100a13', smoke: '#203225', motion: 'wisp' };
      if (/wizard|arcane|frost|fire|lightning|storm|prismatic/.test(key)) return { primary: e.color || '#6fa8ff', secondary: e.color2 || '#dce8ff', dark: '#0c1028', smoke: '#203157', motion: 'rune' };
      // V0.20.21: 'ward(?!en)', not 'ward' - these are tested in order, so a bare /ward/ also matched
      // 'warden' and shadowed the 'warden' term the druid line below explicitly lists, making that
      // term unreachable and dressing the Warden in the Cleric's gold. Kept as a lookahead rather
      // than a word boundary so 'wards'/'warding' still match. Only reachable at all since casters
      // began publishing sourceClass this version - see decorateEffectVisualPayload.
      // V0.20.21: 'paladin' joins the holy line - every Paladin SPELL is holy (Radiant Strike, Holy
      // Rebuke, Divine Verdict), and their martial identity is carried by the melee silhouettes
      // V0.20.20 authored, not by this palette. Placed after the blade line so it cannot shadow it.
      if (/cleric|paladin|holy|heal|bless|protect|ward(?!en)/.test(key)) return { primary: e.color || '#ffd66a', secondary: e.color2 || '#fff6d5', dark: '#21190a', smoke: '#f3e0a2', motion: 'bloom' };
      if (/druid|nature|root|thorn|leaf|spore|warden/.test(key)) return { primary: e.color || '#8fe47d', secondary: e.color2 || '#e2d081', dark: '#132211', smoke: '#3e5f31', motion: 'organic' };
      if (/bard|song|sonic|note|chorus|hymn/.test(key)) return { primary: e.color || '#d69cff', secondary: e.color2 || '#ffd36a', dark: '#201329', smoke: '#57416c', motion: 'wave' };
      if (/fighter|slash|steel|impact|hit|cleave/.test(key)) return { primary: e.color || '#d6d0c8', secondary: e.color2 || '#ff8a3d', dark: '#1d1a16', smoke: '#6b5544', motion: 'impact' };
      return { primary: e.color || '#ffffff', secondary: e.color2 || '#dfe7ff', dark: '#0c0f12', smoke: '#87909a', motion: 'magic' };
},

drawSoftGlow(ctx, sx, sy, radius, color, alpha = 1) {
      const r = Math.max(1, Number(radius) || 1);
      if (!ctx?.createRadialGradient || alpha <= 0) return;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, this.rgba(color, Math.min(0.80, alpha)));
      g.addColorStop(0.42, this.rgba(color, alpha * 0.28));
      g.addColorStop(1, this.rgba(color, 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawGroundEllipse(ctx, sx, sy, rx, ry, color, alpha = 1) {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.rgba(color, alpha);
      ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawExpandingRing(ctx, sx, sy, radius, color, alpha = 1, width = 2, yScale = 0.46) {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.35, width);
      ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(1, radius), Math.max(1, radius * yScale), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
},

drawTaperedTrail(ctx, points, color, alpha = 1, widthStart = 8, widthEnd = 1) {
      if (!points || points.length < 2 || alpha <= 0) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < points.length - 1; i++) {
        const p = i / Math.max(1, points.length - 2);
        ctx.globalAlpha = alpha * (1 - p * 0.72);
        ctx.strokeStyle = color;
        ctx.lineWidth = widthStart + (widthEnd - widthStart) * p;
        ctx.beginPath(); ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[i + 1].x, points[i + 1].y); ctx.stroke();
      }
      ctx.restore();
},

drawRibbonTrail(ctx, sourceScreen, targetScreen, progress, color, seed = 0, options = {}) {
      const p = this.clamp01(progress);
      const dx = targetScreen.x - sourceScreen.x;
      const dy = targetScreen.y - sourceScreen.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux;
      const tip = { x: sourceScreen.x + dx * p, y: sourceScreen.y + dy * p };
      const trail = Math.min(len * 0.55, Number(options.length || 58));
      const points = [];
      const wave = (this.vfxRand(seed, 3) - 0.5) * 20;
      for (let i = 0; i < 6; i++) {
        const q = i / 5;
        const curve = Math.sin((q + p) * Math.PI) * wave * (1 - q);
        points.push({ x: tip.x - ux * trail * q + px * curve, y: tip.y - uy * trail * q + py * curve });
      }
      this.drawTaperedTrail(ctx, points, color, Number(options.alpha || 0.58), Number(options.widthStart || 6), Number(options.widthEnd || 0.7));
},

drawSparkBurst(ctx, sx, sy, progress, seed, color, count = 8, radius = 22, options = {}) {
      const p = this.clamp01(progress);
      const fade = Math.max(0, 1 - p);
      const budgetScale = this.effectQualityScale?.() || 1;
      const safeCount = Math.max(1, Math.floor(count * budgetScale));
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = color;
      for (let i = 0; i < safeCount; i++) {
        const a = this.vfxRand(seed, i) * Math.PI * 2;
        const speed = 0.45 + this.vfxRand(seed, i + 44) * 0.65;
        const r = radius * this.easeOutExpo(p) * speed;
        const x1 = sx + Math.cos(a) * r * 0.28;
        const y1 = sy + Math.sin(a) * r * (options.flat ? 0.28 : 0.58);
        const x2 = sx + Math.cos(a) * r;
        const y2 = sy + Math.sin(a) * r * (options.flat ? 0.38 : 0.72);
        ctx.globalAlpha = fade * (0.35 + this.vfxRand(seed, i + 9) * 0.45);
        ctx.lineWidth = Math.max(0.45, (options.width || 1.2) * (1 - p * 0.5));
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
},

drawMoteField(ctx, sx, sy, progress, seed, color, count = 10, radius = 20, options = {}) {
      const p = this.clamp01(progress);
      const fade = Math.max(0, 1 - p);
      const budgetScale = this.effectQualityScale?.() || 1;
      const safeCount = Math.max(1, Math.floor(count * budgetScale));
      ctx.save(); ctx.fillStyle = color;
      for (let i = 0; i < safeCount; i++) {
        const a = this.vfxRand(seed, i + 11) * Math.PI * 2;
        const rr = radius * (0.18 + this.vfxRand(seed, i + 19) * 0.82) * (0.25 + p * 0.95);
        const lift = (options.lift ?? 14) * p * (0.4 + this.vfxRand(seed, i + 61));
        const x = sx + Math.cos(a) * rr;
        const y = sy + Math.sin(a) * rr * Number(options.yScale || 0.50) - lift;
        const size = (options.size || 2.0) * (0.55 + this.vfxRand(seed, i + 31) * 0.9) * (1 - p * 0.45);
        ctx.globalAlpha = fade * (0.15 + this.vfxRand(seed, i + 71) * 0.40);
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
},

drawSmokeWisps(ctx, sx, sy, progress, seed, color, count = 5, radius = 18, options = {}) {
      const p = this.clamp01(progress);
      const fade = Math.max(0, 1 - p);
      const safeCount = Math.max(1, Math.floor(count * (this.effectQualityScale?.() || 1)));
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = this.rgba(color, 0.6);
      for (let i = 0; i < safeCount; i++) {
        const a = this.vfxRand(seed, i + 88) * Math.PI * 2;
        const r = radius * (0.2 + this.vfxRand(seed, i + 92) * 0.8);
        const sway = Math.sin(p * Math.PI * 2 + i) * (4 + this.vfxRand(seed, i + 20) * 5);
        const x = sx + Math.cos(a) * r * 0.45 + sway * p;
        const y = sy + Math.sin(a) * r * 0.22 - p * Number(options.lift || 24);
        ctx.globalAlpha = fade * 0.16 * (0.6 + this.vfxRand(seed, i + 96));
        ctx.lineWidth = 4 + this.vfxRand(seed, i + 97) * 5;
        ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 0.1, sy + Math.sin(a) * r * 0.1); ctx.quadraticCurveTo((sx + x) * 0.5 + sway, (sy + y) * 0.5 - 10 * p, x, y); ctx.stroke();
      }
      ctx.restore();
},

drawArcSigil(ctx, sx, sy, progress, seed, color, radius = 18, options = {}) {
      const p = this.clamp01(progress);
      const rot = Number(options.rotation || 0) + p * Math.PI * 2 * Number(options.spin || 0.16);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot); ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = Number(options.width || 1.4);
      const a = Number(options.alpha || 0.65);
      for (let i = 0; i < 3; i++) {
        const rr = radius + i * 5;
        ctx.globalAlpha = a * (1 - i * 0.22);
        ctx.beginPath(); ctx.arc(0, 0, rr, i * 0.9 + p * 0.5, i * 0.9 + Math.PI * 1.25 + p * 0.5); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) { const a0 = i * Math.PI / 3; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * (radius - 5), Math.sin(a0) * (radius - 5) * 0.64); ctx.lineTo(Math.cos(a0) * (radius + 5), Math.sin(a0) * (radius + 5) * 0.64); ctx.stroke(); }
      ctx.restore();
},

drawRuneFragments(ctx, sx, sy, progress, seed, color, radius = 20, options = {}) {
      const p = this.clamp01(progress);
      const fade = Math.max(0, 1 - p);
      const glyphs = options.glyphs || ['·', '⌁', '◇', '—', '✦'];
      ctx.save(); ctx.font = `${Math.max(8, Number(options.size || 11))}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
      const count = Math.max(3, Math.floor((options.count || 8) * (this.effectQualityScale?.() || 1)));
      for (let i = 0; i < count; i++) {
        const a = this.vfxRand(seed, i + 121) * Math.PI * 2 + p * 0.7;
        const r = radius * (0.45 + this.vfxRand(seed, i + 127) * 0.75) * (0.65 + p * 0.45);
        ctx.globalAlpha = fade * (0.20 + this.vfxRand(seed, i + 131) * 0.55);
        ctx.fillText(glyphs[i % glyphs.length], sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.55 - p * 12);
      }
      ctx.restore();
},

drawProjectileCore(ctx, sx, sy, angle, progress, color, options = {}) {
      const p = this.clamp01(progress);
      const size = Number(options.size || 5);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle); ctx.globalAlpha = Number(options.alpha || 1);
      this.drawSoftGlow(ctx, 0, 0, size * 4, color, 0.22);
      ctx.fillStyle = options.dark || '#101010'; ctx.beginPath(); ctx.ellipse(0, 0, size * 2.2, size * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(size * 0.20, 0, size * 1.55, size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = options.highlight || '#ffffff'; ctx.globalAlpha *= 0.62; ctx.beginPath(); ctx.ellipse(size * 0.75, -size * 0.12, size * 0.45, size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawImpactBloom(ctx, sx, sy, progress, color, options = {}) {
      const p = this.clamp01(progress);
      const e = this.easeOutCubic(p);
      const fade = Math.max(0, 1 - p);
      this.drawSoftGlow(ctx, sx, sy, (options.radius || 22) * (0.55 + e), color, fade * 0.30);
      this.drawExpandingRing(ctx, sx, sy, (options.radius || 22) * e, color, fade * 0.72, options.width || 2.0, options.yScale || 0.46);
      this.drawSparkBurst(ctx, sx, sy, p, options.seed || 0, color, options.sparks || 10, options.sparkRadius || 26, { flat: options.flat, width: options.sparkWidth || 1.1 });
},

effectQualityScale() {
      const count = Array.isArray(this.effects) ? this.effects.length : 0;
      const max = this.effectBudgetLimits?.().effects || 460;
      // V0.20.37 (Roadmap Item 20): reduced-motion thins DECORATIVE particle counts (motes, sparks,
      // wisps) by half. This is the count only - effect lifetimes, radii and damage timing are
      // untouched, so every ring/bolt/telegraph still draws and every gameplay cue is preserved; there
      // is just less swirling motion on screen. Stacks with the existing performance throttle below.
      const motion = this.uiPrefs?.reduceMotion ? 0.5 : 1;
      if (count > max * 0.82) return 0.35 * motion;
      if (count > max * 0.62) return 0.55 * motion;
      if (count > max * 0.42) return 0.75 * motion;
      return motion;
},

// V0.20.23: the ring's widest moment. r = base * (0.58 + easeOutBack(p) * 1.38), and easeOutBack
// OVERSHOOTS to ~1.1 before settling to 1 at p=1 - so the widest r is base * ~2.098, NOT base * 1.96.
// Measured from the real easing rather than hardcoded, so changing easeOutBack cannot silently
// desynchronise a spell's drawn area from the area it actually damages. Cached: it never varies.
ringPeakMult() {
      if (this._ringPeakMult > 0) return this._ringPeakMult;
      let m = 0;
      for (let p = 0; p <= 1.0001; p += 0.002) m = Math.max(m, 0.58 + this.easeOutBack(p) * 1.38);
      this._ringPeakMult = m;
      return m;
},

// V0.20.23: the ellipse a world-space ground circle ACTUALLY projects to, measured through the live
// vfxScreen rather than assumed. A circle's rightmost point sits at world (R/root2, -R/root2) and its
// lowest at (R/root2, +R/root2); sampling the full circle agrees with this to 2dp. The engine's true
// y:x ratio is ~0.558, while the stylised ring hardcodes 0.42 - so an area ring drawn at 0.42 is the
// wrong SHAPE for the ground as well as the wrong size. Legacy pixel callers keep 0.42 on purpose.
worldRingMetrics(wx, wy, worldRadius, height) {
      const u = Math.max(0, Number(worldRadius) || 0) * 0.7071067811865476;
      const o = this.vfxScreen(wx, wy, height);
      const right = this.vfxScreen(wx + u, wy - u, height);
      const low = this.vfxScreen(wx + u, wy + u, height);
      const rx = Math.abs(right.x - o.x);
      const ry = Math.abs(low.y - o.y);
      if (!(rx > 0.001)) return null;
      return { rx: Math.max(1, rx), yScale: Math.min(1, Math.max(0.05, ry / rx)) };
},

// V0.20.24/V0.20.25 (Roadmap Item 6): the entity renderer had NO per-frame pass over active buffs, so
// a shield fired a ~0.68s cast flash and then nothing - Guardian Aura lasts 1800s and was visible for
// 0.68 of them - and a DoT ticked with no persistent mark at all. This is that pass. It is driven
// straight off actor.buffs, so a visual's lifetime IS the buff's gameplay lifetime: it appears the
// frame the buff is applied and vanishes the frame remaining hits 0. No lifetime can drift, because
// there is no second lifetime to drift from. Covers the TWO categories the spec names - protective
// buffs ("a shield must remain visible for the actual protection duration") and DoTs ("a DoT must
// persist while the debuff is active").
PROTECTIVE_BUFF_TAGS: null,
isProtectiveBuff(b) {
      if (!b || Number(b.remaining) <= 0 || b.hostile) return false;
      if (Number(b.absorbRemaining) > 0) return true;
      const dtm = Number(b.damageTakenMultiplier);
      if (dtm > 0 && dtm < 1) return true;
      const mdtm = Number(b.magicDamageTakenMultiplier);
      if (mdtm > 0 && mdtm < 1) return true;
      if (!this.PROTECTIVE_BUFF_TAGS) this.PROTECTIVE_BUFF_TAGS = new Set(['shield','ward','barrier','bulwark','aura','absorb','bubble','guard','protect','aegis','sanctuary']);
      const tags = b.tags;
      if (Array.isArray(tags)) for (const t of tags) if (this.PROTECTIVE_BUFF_TAGS.has(String(t).toLowerCase())) return true;
      return false;
},

// V0.20.25: a DoT is a hostile effect that deals periodic damage - that IS the definition, so the
// predicate keys on it directly rather than the 'dot' type string (which some periodic debuffs omit).
isDotDebuff(b) {
      return !!b && Number(b.remaining) > 0 && b.hostile === true && Number(b.periodicDamage) > 0;
},

// V0.20.25: buff.color does NOT encode the element - ground-truthed, Ignite (fire) ships the wizard's
// BLUE #6fa8ff and Bleeding Vein (bleed) ships grey #cfd4d9 - so a DoT's tint is derived from
// damageType, then tags, and NEVER from buff.color, or a burn would read as frost. The spec requires
// the visual to communicate DAMAGE TYPE, which is exactly the field buff.color gets wrong.
DOT_ELEMENT_COLORS: null,
dotElementColor(b) {
      if (!this.DOT_ELEMENT_COLORS) this.DOT_ELEMENT_COLORS = {
        fire: '#ff7a3d', burn: '#ff7a3d', ignite: '#ff7a3d', flame: '#ff7a3d', ember: '#ff7a3d',
        poison: '#8dff5a', venom: '#8dff5a', disease: '#8dff5a', rot: '#9fe04a', toxic: '#8dff5a', spore: '#8dff5a', nature: '#8dff5a',
        bleed: '#e2454a', physical: '#e2454a', laceration: '#e2454a',
        shadow: '#b57cff', necro: '#b57cff', necrotic: '#b57cff', soul: '#b57cff', drain: '#b57cff', curse: '#b57cff', dark: '#b57cff', void: '#b57cff',
        frost: '#9fd8ff', ice: '#9fd8ff', cold: '#9fd8ff', chill: '#9fd8ff',
        lightning: '#ffe66a', storm: '#ffe66a', shock: '#ffe66a', holy: '#ffd66a', radiant: '#ffd66a',
        lunar: '#c9b6ff', moon: '#c9b6ff', arcane: '#b58cff'
      };
      const dt = String(b.damageType || '').toLowerCase();
      if (this.DOT_ELEMENT_COLORS[dt]) return this.DOT_ELEMENT_COLORS[dt];
      const tags = b.tags;
      if (Array.isArray(tags)) for (const t of tags) { const c = this.DOT_ELEMENT_COLORS[String(t).toLowerCase()]; if (c) return c; }
      return '#b8c0c8';
},

// Persistent buff visuals for one actor, drawn from entity-renderer.drawEntity AFTER the body so they
// envelop without occluding. ONE scan of the buff list, then at most one shield dome and one DoT
// plume - a 5-DoT enemy shows a single affliction, not five, and a double-buffed paladin one bubble.
// Returns immediately when there are no buffs, which is the overwhelming common case.
drawEntityStatusAuras(e, visualFoot, scale) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e || !Array.isArray(e.buffs) || e.buffs.length === 0) return;
      let shield = null, dot = null, dotDps = 0;
      for (const b of e.buffs) {
        if (this.isProtectiveBuff(b)) {
          // prefer an absorb shield (it has a depletion story); else the strongest mitigation.
          if (!shield) { shield = b; continue; }
          const bAbsorb = Number(b.absorbRemaining) > 0, curAbsorb = Number(shield.absorbRemaining) > 0;
          if (bAbsorb && !curAbsorb) shield = b;
          else if (bAbsorb === curAbsorb && Number(b.damageTakenMultiplier || 1) < Number(shield.damageTakenMultiplier || 1)) shield = b;
        } else if (this.isDotDebuff(b)) {
          dotDps += Number(b.periodicDamage) || 0;
          // dominant DoT (by per-tick damage) decides the plume's element colour.
          if (!dot || (Number(b.periodicDamage) || 0) > (Number(dot.periodicDamage) || 0)) dot = b;
        }
      }
      if (!shield && !dot) return;
      const s = Math.max(0.4, Number(scale) || 1);
      if (shield) this.drawShieldDome(ctx, shield, visualFoot, s, e);
      if (dot) this.drawDotAffliction(ctx, dot, dotDps, visualFoot, s, e);
},

drawShieldDome(ctx, buff, visualFoot, s, e) {
      const cx = visualFoot.x;
      const footY = visualFoot.y;
      const centerY = footY - 34 * s;
      const rx = 25 * s;
      const ry = 33 * s;
      const color = buff.color || '#bfe3ff';
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      const seed = (Number(e.id) || (e.x + e.y) || 0) * 1.7;
      // Visual lifetime tied to the buff: fade IN over the first 0.3s of existence, fade OUT over the
      // final 0.9s of remaining, so the dome's arrival and expiry read as the shield's arrival/expiry.
      const age = Math.max(0, Number(buff.duration || 0) - Number(buff.remaining || 0));
      const fadeIn = age < 0.3 ? this.clamp01(age / 0.3) : 1;
      const fadeOut = Number(buff.remaining) < 0.9 ? this.clamp01(Number(buff.remaining) / 0.9) : 1;
      const life = fadeIn * fadeOut;
      if (life <= 0.01) return;
      const shimmer = 0.72 + 0.28 * Math.sin(now * 2.3 + seed);
      const stacks = Math.max(1, Number(buff.stacks) || 1);
      ctx.save();
      this.drawGroundEllipse?.(ctx, cx, footY + 1, rx * 0.92, rx * 0.34, color, 0.16 * life);
      ctx.globalCompositeOperation = 'lighter';
      this.drawSoftGlow?.(ctx, cx, centerY, rx * 1.18, color, 0.14 * life * shimmer);
      ctx.globalAlpha = 0.5 * life * shimmer;
      ctx.strokeStyle = this.rgba ? this.rgba(color, 1) : color;
      ctx.lineWidth = (1.4 + Math.min(3, stacks - 1) * 0.35) * s;
      ctx.beginPath();
      ctx.ellipse(cx, centerY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.22 * life * shimmer;
      ctx.lineWidth = 1.0 * s;
      ctx.beginPath();
      ctx.ellipse(cx, centerY, rx * 0.7, ry * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
},

// V0.20.25: the DoT plume - deliberately RESTRAINED because DoTs are on nearly every enemy in a fight
// and this must not turn combat to soup. A faint element-coloured ground taint plus a few small rising
// motes, all merged from every DoT on the actor into ONE plume tinted by the strongest. Cheap: one
// ground ellipse + up to 4 arc fills, no gradients. No fade-IN (DoTs are short and want instant combat
// feedback); fades OUT only in the final 0.6s so expiry reads. Mote count scales with total DoT dps -
// the spec's "Power" cue - capped at 4.
drawDotAffliction(ctx, buff, dps, visualFoot, s, e) {
      const remaining = Number(buff.remaining);
      const fadeOut = remaining < 0.6 ? this.clamp01(remaining / 0.6) : 1;
      if (fadeOut <= 0.02) return;
      const color = this.dotElementColor(buff);
      const stroke = this.rgba ? this.rgba(color, 1) : color;
      const cx = visualFoot.x;
      const footY = visualFoot.y;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      const seed = ((Number(e.id) || (e.x * 13.1 + e.y * 7.7) || 0)) % 100;
      const moteCount = Math.min(4, 2 + Math.floor(Math.max(0, dps) / 20));
      const rise = 40 * s;
      ctx.save();
      // the affliction pools at the feet
      this.drawGroundEllipse?.(ctx, cx, footY + 1, 14 * s, 5 * s, color, 0.14 * fadeOut);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = stroke;
      for (let i = 0; i < moteCount; i++) {
        const phase = ((now * 0.7) + i / moteCount + seed * 0.013) % 1;
        const y = footY - 6 * s - phase * rise;
        const wob = Math.sin(phase * 6.2832 + i * 2.1) * 5 * s;
        const x = cx + wob + (i - (moteCount - 1) / 2) * 4 * s;
        const a = Math.sin(phase * Math.PI) * 0.42 * fadeOut;
        if (a <= 0.01) continue;
        const size = (1.3 + 0.7 * Math.sin(phase * Math.PI)) * s;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
},

// V0.20.28 (Roadmap Item 6): the Wizard's bespoke elemental burst. Until now every Wizard spell drew
// the same wizard-blue rune ring - a Fireball, a Frost Nova and an Arcane Bolt were visually
// identical, for the one class whose entire identity IS elemental variety. This is an ISOLATED effect
// type (nothing else spawns it), so it differentiates fire/frost/lightning/arcane without touching the
// shared vfxStyle palette every other class depends on. Every radius is clamped >= 1 - a negative
// canvas radius is a render-fault black screen (see the silk-critter clock bug).
WIZARD_ELEMENT_STYLES: null,
wizardElementStyle(element) {
      if (!this.WIZARD_ELEMENT_STYLES) this.WIZARD_ELEMENT_STYLES = {
        fire:      { primary: '#ff7a3d', secondary: '#ffd07a', motion: 'ember' },
        frost:     { primary: '#7fd8ff', secondary: '#e6f6ff', motion: 'shard' },
        lightning: { primary: '#ffe66a', secondary: '#fff6c8', motion: 'arc' },
        arcane:    { primary: '#b57cff', secondary: '#e6d6ff', motion: 'rune' }
      };
      return this.WIZARD_ELEMENT_STYLES[element] || this.WIZARD_ELEMENT_STYLES.arcane;
},
drawWizardElementEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const life = Math.max(0.001, Number(e.life || 0.62));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const st = this.wizardElementStyle(e.element);
      const primary = e.color || st.primary;
      const secondary = st.secondary;
      const s = this.vfxScreen(e.x, e.y, 0.24 + Number(e.height || 0));
      const baseR = Math.max(2, Number(e.radius || 26) * Number(e.scale || 1));
      const grow = this.easeOutCubic(p);
      const r = Math.max(1, baseR * (0.4 + grow * 1.1));
      const seed = Number(e.seed || 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawSoftGlow?.(ctx, s.x, s.y - 4, Math.max(1, r * 1.1), primary, 0.22 * fade);
      if (st.motion === 'ember') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.7 * fade, 3.2, 0.5);
        this.drawMoteField?.(ctx, s.x, s.y - 6, p, seed, secondary, 10, Math.max(1, r * 0.6), { lift: 34, size: 2.4 });
        ctx.strokeStyle = this.rgba(secondary, 0.55 * fade); ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = this.vfxRand(seed, i); const fx = s.x + (a - 0.5) * r * 1.2; const fy = s.y - grow * (20 + a * 30); ctx.beginPath(); ctx.moveTo(fx, s.y); ctx.quadraticCurveTo(fx + (a - 0.5) * 8, (s.y + fy) / 2, fx, fy); ctx.stroke(); }
      } else if (st.motion === 'shard') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.75 * fade, 2.6, 0.5);
        ctx.strokeStyle = this.rgba(secondary, 0.8 * fade); ctx.lineWidth = 2; ctx.lineCap = 'round';
        const shards = 8;
        for (let i = 0; i < shards; i++) { const ang = (Math.PI * 2 * i / shards) + seed; const ir = Math.max(1, r * 0.5); const or = Math.max(ir + 1, r * (0.9 + 0.2 * this.vfxRand(seed, i))); ctx.beginPath(); ctx.moveTo(s.x + Math.cos(ang) * ir, s.y + Math.sin(ang) * ir * 0.5); ctx.lineTo(s.x + Math.cos(ang) * or, s.y + Math.sin(ang) * or * 0.5); ctx.stroke(); }
      } else if (st.motion === 'arc') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.5 * fade, 2.0, 0.5);
        ctx.strokeStyle = this.rgba(primary, 0.85 * fade); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        const bolts = 5;
        for (let i = 0; i < bolts; i++) { const ang = (Math.PI * 2 * i / bolts) + seed * 0.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); const segs = 4; for (let j = 1; j <= segs; j++) { const tt = j / segs; const jitter = (this.vfxRand(seed, i * 10 + j) - 0.5) * 10; ctx.lineTo(s.x + Math.cos(ang) * r * tt + jitter, s.y + Math.sin(ang) * r * tt * 0.5 + jitter * 0.5); } ctx.stroke(); }
      } else {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.7 * fade, 2.8, 0.5);
        this.drawRuneFragments?.(ctx, s.x, s.y - 8, p, seed, secondary, Math.max(1, r * 0.7), { count: 9 });
      }
      if (p < 0.4) { const flash = 1 - p * 2.5; this.drawSoftGlow?.(ctx, s.x, s.y - 4, Math.max(1, r * 0.5 * flash), secondary, 0.5 * flash); }
      ctx.restore();
},

// V0.20.29 (Roadmap Item 6): the shared bespoke burst for the five remaining palette-only casters
// (Druid, Shaman, Summoner, Enchanter, Ranger). Same isolated-effect-type discipline as the Wizard's
// (V0.20.28) - nothing shared with vfxStyle - but generalized to a MOTIF so five classes reuse one
// draw path instead of five near-duplicates. Every radius clamped >= 1 (negative-radius black screen).
CASTER_MOTIF_STYLES: null,
casterMotifStyle(motif) {
      if (!this.CASTER_MOTIF_STYLES) this.CASTER_MOTIF_STYLES = {
        nature: { primary: '#8fe47d', secondary: '#d7f0a0', motion: 'leaf' },
        lunar:  { primary: '#c9b6ff', secondary: '#eae2ff', motion: 'lunar' },
        storm:  { primary: '#5fd8e0', secondary: '#d8fbff', motion: 'arc' },
        earth:  { primary: '#d9a25a', secondary: '#f0d29a', motion: 'shard' },
        spirit: { primary: '#7fe0d0', secondary: '#e2fff8', motion: 'wisp' },
        planar: { primary: '#9d7dff', secondary: '#e2d6ff', motion: 'rift' },
        mind:   { primary: '#ff8fd0', secondary: '#ffe3f4', motion: 'mind' },
        hunt:   { primary: '#a8d86a', secondary: '#e6d29a', motion: 'hunt' }
      };
      return this.CASTER_MOTIF_STYLES[motif] || this.CASTER_MOTIF_STYLES.nature;
},
drawCasterMotifEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const life = Math.max(0.001, Number(e.life || 0.62));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const st = this.casterMotifStyle(e.motif);
      const primary = e.color || st.primary;
      const secondary = st.secondary;
      const s = this.vfxScreen(e.x, e.y, 0.24 + Number(e.height || 0));
      const baseR = Math.max(2, Number(e.radius || 26) * Number(e.scale || 1));
      const grow = this.easeOutCubic(p);
      const r = Math.max(1, baseR * (0.4 + grow * 1.1));
      const seed = Number(e.seed || 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawSoftGlow?.(ctx, s.x, s.y - 4, Math.max(1, r * 1.05), primary, 0.2 * fade);
      const m = st.motion;
      if (m === 'leaf') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.62 * fade, 2.6, 0.5);
        this.drawMoteField?.(ctx, s.x, s.y - 6, p, seed, secondary, 9, Math.max(1, r * 0.6), { lift: 26, size: 2.2 });
        ctx.strokeStyle = this.rgba(secondary, 0.6 * fade); ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const a = this.vfxRand(seed, i); const ang = a * Math.PI * 2; const lr = Math.max(1, r * (0.5 + a * 0.5)); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x + Math.cos(ang) * lr * 0.6, s.y + Math.sin(ang) * lr * 0.3 - 6, s.x + Math.cos(ang) * lr, s.y + Math.sin(ang) * lr * 0.5); ctx.stroke(); }
      } else if (m === 'lunar') {
        this.drawSoftGlow?.(ctx, s.x, s.y - 8, Math.max(1, r * 0.9), secondary, 0.28 * fade);
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.55 * fade, 2.2, 0.5);
        ctx.strokeStyle = this.rgba(secondary, 0.7 * fade); ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, Math.max(1, r * 0.7), Math.max(1, r * 0.5), 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else if (m === 'arc') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.5 * fade, 2.0, 0.5);
        ctx.strokeStyle = this.rgba(primary, 0.85 * fade); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const ang = (Math.PI * 2 * i / 5) + seed * 0.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); const segs = 4; for (let j = 1; j <= segs; j++) { const tt = j / segs; const jit = (this.vfxRand(seed, i * 10 + j) - 0.5) * 10; ctx.lineTo(s.x + Math.cos(ang) * r * tt + jit, s.y + Math.sin(ang) * r * tt * 0.5 + jit * 0.5); } ctx.stroke(); }
      } else if (m === 'shard') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.7 * fade, 2.8, 0.5);
        ctx.strokeStyle = this.rgba(secondary, 0.8 * fade); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const ang = (Math.PI * 2 * i / 7) + seed; const ir = Math.max(1, r * 0.45); const or = Math.max(ir + 1, r * (0.85 + 0.25 * this.vfxRand(seed, i))); ctx.beginPath(); ctx.moveTo(s.x + Math.cos(ang) * ir, s.y + Math.sin(ang) * ir * 0.5); ctx.lineTo(s.x + Math.cos(ang) * or, s.y + Math.sin(ang) * or * 0.5); ctx.stroke(); }
      } else if (m === 'wisp') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.45 * fade, 1.8, 0.5);
        this.drawSmokeWisps?.(ctx, s.x, s.y, p, seed, secondary, 6, Math.max(1, r * 0.55), { lift: 30 });
      } else if (m === 'rift') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.6 * fade, 2.4, 0.5);
        ctx.strokeStyle = this.rgba(secondary, 0.75 * fade); ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const off = (i - 1) * r * 0.4; const h = Math.max(2, r * (0.7 + 0.3 * this.vfxRand(seed, i))); ctx.beginPath(); ctx.moveTo(s.x + off, s.y - h); ctx.lineTo(s.x + off + (this.vfxRand(seed, i + 5) - 0.5) * 6, s.y + h * 0.4); ctx.stroke(); }
      } else if (m === 'mind') {
        for (let i = 0; i < 3; i++) { const ph = this.clamp01(p * 1.4 - i * 0.18); if (ph <= 0) continue; const rr = Math.max(1, baseR * (0.3 + this.easeOutCubic(ph) * 1.3)); this.drawExpandingRing?.(ctx, s.x, s.y - 2, rr, i % 2 ? secondary : primary, 0.5 * (1 - ph), 1.8, 0.5); }
      } else if (m === 'hunt') {
        this.drawExpandingRing?.(ctx, s.x, s.y - 2, r, primary, 0.5 * fade, 1.6, 0.5);
        ctx.strokeStyle = this.rgba(secondary, 0.85 * fade); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        const ch = Math.max(3, r * 0.7);
        ctx.beginPath(); ctx.moveTo(s.x - ch, s.y - 2); ctx.lineTo(s.x + ch, s.y - 2); ctx.moveTo(s.x, s.y - 2 - ch * 0.6); ctx.lineTo(s.x, s.y - 2 + ch * 0.6); ctx.stroke();
        for (let i = 0; i < 2; i++) { const ang = seed + i * 2.3; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(ang) * r * 1.2, s.y + Math.sin(ang) * r * 0.6); ctx.lineTo(s.x + Math.cos(ang) * r * 0.2, s.y + Math.sin(ang) * r * 0.1); ctx.stroke(); }
      }
      if (p < 0.4) { const flash = 1 - p * 2.5; this.drawSoftGlow?.(ctx, s.x, s.y - 4, Math.max(1, r * 0.45 * flash), secondary, 0.45 * flash); }
      ctx.restore();
},

drawHighQualityRingEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const life = Math.max(0.001, Number(e.life || 0.68));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const style = this.vfxStyle(e);
      const s = this.vfxScreen(e.x, e.y, Number(e.height || 0.04) + Number(e.depthBias || 0));
      // V0.20.23 (Roadmap Item 6, "a ground-targeted spell must show the correct affected area"):
      // e.radius is SCREEN PIXELS, so a resolver passing spell.radius (WORLD TILES) drew Meteorfall's
      // 7-tile blast as a 22px ring - ~19x under its real reach. When a world radius is supplied the
      // ring is sized from the ACTUAL projection instead: worldRingMetrics measures the ellipse the
      // ground circle really makes, so the drawn edge is the damage edge. Legacy pixel callers are
      // untouched and keep the stylised 0.42 squash.
      const worldMetrics = Number(e.worldRadius) > 0 ? this.worldRingMetrics(e.x, e.y, Number(e.worldRadius), Number(e.height || 0.04) + Number(e.depthBias || 0)) : null;
      // r peaks at base * RING_PEAK_MULT - easeOutBack OVERSHOOTS to ~1.1, so sizing to its p=1 value
      // would let the graphic claim ~7% more reach than the spell damages. Size to the PEAK so the
      // ring never over-promises: it may under-draw for an instant, never over-draw.
      const base = worldMetrics ? (worldMetrics.rx / this.ringPeakMult()) : Math.max(4, Number(e.radius || 18) * Number(e.scale || 1));
      const yScale = worldMetrics ? worldMetrics.yScale : 0.42;
      const r = base * (0.58 + this.easeOutBack(p) * 1.38);
      ctx.save();
      this.drawGroundEllipse(ctx, s.x, s.y + 2, r * 0.82, r * (yScale * 0.667), style.dark, 0.18 * fade);
      this.drawSoftGlow(ctx, s.x, s.y - 3, r * 1.12, style.primary, 0.16 * fade * Number(e.intensity || 1));
      this.drawExpandingRing(ctx, s.x, s.y - 2, r, style.primary, 0.78 * fade, 2.4 + Number(e.intensity || 1) * 0.5, yScale);
      this.drawExpandingRing(ctx, s.x, s.y - 2, Math.max(1, r * 0.62), style.secondary, 0.28 * fade, 1.0, yScale);
      if (style.motion === 'rune') this.drawRuneFragments(ctx, s.x, s.y - 8, p, e.seed || 0, style.secondary, r * 0.62, { count: 9 });
      else if (style.motion === 'wisp') this.drawSmokeWisps(ctx, s.x, s.y, p, e.seed || 0, style.smoke, 6, r * 0.52, { lift: 28 });
      else if (style.motion === 'wave') this.drawArcSigil(ctx, s.x, s.y - 3, p, e.seed || 0, style.secondary, r * 0.38, { alpha: 0.28 * fade, spin: 0.04 });
      else this.drawMoteField(ctx, s.x, s.y - 5, p, e.seed || 0, style.secondary, 9, r * 0.46, { lift: 16, size: 1.8 });
      ctx.restore();
},

// V0.19.8 (Roadmap Item 6): draws the arc that was actually TESTED - same origin, facing, spread and
// reach the resolver used. The wedge is built by sampling the arc in WORLD space and projecting each
// point through vfxScreen (the same transform the world uses), rather than approximating it with a
// canvas ellipse: an ellipse's parametric angle is not the world angle under an iso projection, so an
// arc drawn that way would not line up with the cone that kills. `e.radius` is WORLD units here.
drawSpellConeEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const life = Math.max(0.001, Number(e.life || 0.42));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const style = this.vfxStyle(e);
      const cone = Number(e.coneDegrees) || 0;
      if (!(cone > 0)) return;
      const half = (cone * Math.PI / 180) * 0.5;
      const facing = Number(e.angle) || 0;
      const rWorld = Math.max(0.1, Number(e.radius) || 2);
      // Sweeps outward and lands EXACTLY on the real reach. Deliberately not easeOutBack like the ring:
      // that overshoots past 1, which would paint the swing landing further out than it actually hits.
      const grow = 1 - Math.pow(1 - p, 3);
      const reach = rWorld * (0.45 + 0.55 * grow);
      const segments = Math.max(6, Math.ceil(cone / 6));
      const ground = 0.04 + Number(e.depthBias || 0);
      const at = (angle, radius) => this.vfxScreen(e.x + Math.cos(angle) * radius, e.y + Math.sin(angle) * radius, ground);
      const centre = this.vfxScreen(e.x, e.y, ground);

      const tracePath = (radius) => {
        ctx.beginPath();
        ctx.moveTo(centre.x, centre.y);
        for (let i = 0; i <= segments; i++) {
          const a = facing - half + (i / segments) * (half * 2);
          const s = at(a, radius);
          ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
      };

      ctx.save();
      // Filled wedge: the area that took the hit.
      ctx.globalAlpha = 0.20 * fade;
      ctx.fillStyle = style.primary;
      tracePath(reach);
      ctx.fill();
      // Edge: the two radii plus the leading arc, so the boundary reads clearly.
      ctx.globalAlpha = 0.80 * fade;
      ctx.strokeStyle = style.primary;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      tracePath(reach);
      ctx.stroke();
      // Leading arc highlight - the blade's outer edge travelling through the sweep.
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = style.secondary;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const a = facing - half + (i / segments) * (half * 2);
        const s = at(a, reach * 0.72);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.restore();
      this.drawSoftGlow(ctx, centre.x, centre.y - 3, Math.max(6, rWorld * 10), style.primary, 0.10 * fade * Number(e.intensity || 1));
},

drawHighQualityBoltEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = this.vfxStyle(e);
      const travel = Math.max(0, Number(e.travelDuration || 0));
      const life = Math.max(0.001, Number(e.life || (travel + 0.18)));
      const travelP = travel > 0 ? this.clamp01(Number(e.t || 0) / travel) : 1;
      const afterP = travel > 0 ? this.clamp01((Number(e.t || 0) - travel) / Math.max(0.001, life - travel)) : this.clamp01(Number(e.t || 0) / life);
      const fade = travelP < 1 ? 1 : Math.max(0, 1 - afterP);
      const sx = Number(e.x || 0), sy = Number(e.y || 0), tx = Number(e.x2 ?? sx), ty = Number(e.y2 ?? sy);
      const wx = sx + (tx - sx) * travelP;
      const wy = sy + (ty - sy) * travelP;
      const source = this.vfxScreen(sx, sy, 0.24 + Number(e.height || 0));
      const target = this.vfxScreen(tx, ty, 0.22 + Number(e.height || 0));
      const tip = this.vfxScreen(wx, wy, 0.24 + Number(e.height || 0));
      // V0.20.26: lift the SOURCE to the caster's cast-hand height (spawnBolt derives originLift from
      // the caster's feet/head anchors; falls back to the old fixed 24 for callers that pass none).
      // Only the source moves - the bolt still lands on the target's body, so aim is unchanged.
      source.y -= Number.isFinite(Number(e.originLift)) ? Number(e.originLift) : 24;
      target.y -= 22; tip.y -= 22;
      const dx = target.x - source.x, dy = target.y - source.y;
      const angle = Math.atan2(dy, dx);
      const len = Math.max(0.001, Math.hypot(dx, dy));
      ctx.save();
      ctx.globalAlpha = fade;
      if (e.style === 'arrow') {
        this.drawRibbonTrail(ctx, source, target, travelP, style.primary, e.seed || 0, { alpha: 0.34 * fade, widthStart: 3.8, widthEnd: 0.45, length: Math.min(45, len * 0.36) });
        this.drawProjectileCore(ctx, tip.x, tip.y, angle, travelP, style.primary, { size: 3.5, alpha: fade, dark: '#23180d', highlight: '#f2f5df' });
      } else {
        this.drawRibbonTrail(ctx, source, target, travelP, style.primary, e.seed || 0, { alpha: 0.56 * fade, widthStart: 7.5, widthEnd: 0.6, length: Math.min(72, len * 0.48) });
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.72 * fade; ctx.strokeStyle = style.secondary; ctx.lineWidth = 1.35; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const off = (this.vfxRand(e.seed, i) - 0.5) * 10; ctx.beginPath(); ctx.moveTo(source.x, source.y + off * 0.2); ctx.quadraticCurveTo((source.x + tip.x) * 0.5, (source.y + tip.y) * 0.5 + off, tip.x, tip.y); ctx.stroke(); }
        ctx.restore();
        this.drawProjectileCore(ctx, tip.x, tip.y, angle, travelP, style.primary, { size: 5.5 * Number(e.scale || 1), alpha: fade, highlight: style.secondary });
      }
      if (travelP >= 1) this.drawImpactBloom(ctx, target.x, target.y, afterP, style.primary, { seed: e.seed || 0, radius: 20 * Number(e.intensity || 1), sparks: 8 });
      ctx.restore();
},
drawEffect(e, layer) {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  if (e && e.delay > 0) return; // staggered burst: not visible until its delay elapses
  if (e.type === 'ring') {
    this.drawHighQualityRingEffect(e);
  } else if (e.type === 'spellCone') {
    this.drawSpellConeEffect(e);
  } else if (e.type === 'bolt') {
    this.drawHighQualityBoltEffect(e);
  } else if (e.type === 'wizardElement') {
    this.drawWizardElementEffect(e);
  } else if (e.type === 'casterMotif') {
    this.drawCasterMotifEffect(e);
  } else if (e.type === 'spiderWebProjectile') {
    this.drawSpiderWebProjectileEffect(e);
  } else if (e.type === 'slash') {
    const a = 1 - e.t / e.life;
    const s = this.worldToScreen(e.x, e.y, this.tileAt(e.x, e.y).elev);
    const f = this.worldToScreen(e.fromX, e.fromY, this.tileAt(e.fromX, e.fromY).elev);
    const dx = s.x - f.x;
    const dir = dx >= 0 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = e.color;
    // V0.20.0 (Roadmap Item 6): 'slam' was DEAD STYLING. Titan Chop, Perfect Masterstroke (the level-20
    // capstone) and the mercenary slam all passed style 'slam', and no renderer had ever branched on it -
    // only 'claw' was implemented - so the fighter's two heaviest hits drew the exact same horizontal arc
    // as level-1 Heavy Swing. An overhead smash needs its own silhouette to read as one: a heavy
    // near-vertical stroke driven down onto the target, then a ground shock where it lands.
    if (e.style === 'slam') {
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const drop = 30 * (1 - Math.pow(1 - prog, 2));
      ctx.lineWidth = 4.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x + dir * 14, s.y - 48 + drop * 0.34);
      ctx.lineTo(s.x + dir * 3, s.y - 14 + drop * 0.52);
      ctx.stroke();
      // Ground shock, once the blade has actually landed.
      if (prog > 0.45) {
        const shock = (prog - 0.45) / 0.55;
        const r = 7 + shock * 25;
        ctx.globalAlpha = a * (1 - shock);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, r, r * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.style === 'crush') {
      // Brute blunt impact (enemy heavy attacks). No blade arc - a short, thick pound plus radial
      // debris ticks, so it reads as weight rather than an edge.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x + dir * 9, s.y - 34 + prog * 12);
      ctx.lineTo(s.x + dir * 2, s.y - 12 + prog * 8);
      ctx.stroke();
      ctx.globalAlpha = a * 0.75;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI + (i / 4) * Math.PI; // debris kicks upward/outward from the point of impact
        const len = 5 + prog * 11;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(ang) * 5, s.y - 4 + Math.sin(ang) * 2);
        ctx.lineTo(s.x + Math.cos(ang) * (5 + len), s.y - 4 + Math.sin(ang) * (2 + len * 0.36));
        ctx.stroke();
      }
    } else if (e.style === 'cast') {
      // A cast is not a sword. Ranged bots and non-undead pets passed this style and got the melee
      // slash arc anyway - a caster swinging an invisible blade. A glyph ring plus rising motes reads
      // as magic without pretending to be a weapon.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const r = 6 + prog * 12;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 16, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.6;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 16, r * 0.55, r * 0.23, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.85;
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + prog * 2.2;
        const mx = s.x + Math.cos(ang) * r * 0.8;
        const my = s.y - 16 + Math.sin(ang) * r * 0.34 - prog * 10;
        ctx.beginPath();
        ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
      }
    } else if (e.style === 'split') {
      // Armor Splitter: a vertical rend, and the two halves parting. Reads as something being opened
      // rather than struck.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const gap = 1 + prog * 6;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s.x + side * gap, s.y - 34);
        ctx.lineTo(s.x + side * (gap + prog * 3), s.y - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 36);
      ctx.lineTo(s.x, s.y - 4);
      ctx.stroke();
    } else if (e.style === 'thrust') {
      // Heavy Riposte: a counter, not a swing. A straight stab along the attack line with a tip flash.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const reach = 10 + prog * 22;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x - dir * 16, s.y - 20);
      ctx.lineTo(s.x - dir * 16 + dir * reach, s.y - 20);
      ctx.stroke();
      ctx.globalAlpha = a * (1 - prog);
      ctx.beginPath();
      ctx.arc(s.x - dir * 16 + dir * reach, s.y - 20, 3 + prog * 3, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();
    } else if (e.style === 'wild') {
      // Reckless Strike: two crossing arcs, deliberately off-balance - the spell debuffs the caster,
      // so it should not look controlled.
      ctx.lineWidth = 2.8;
      for (const off of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s.x + dir * 3, s.y - 22 + off * 5, 24, dir > 0 ? -1.1 + off * 0.25 : Math.PI + 1.1 - off * 0.25,
                dir > 0 ? 0.9 + off * 0.25 : Math.PI - 0.9 - off * 0.25);
        ctx.stroke();
      }
    } else if (e.style === 'execute') {
      // Final Swing: only usable below the execute threshold. A decisive downward arc plus a crossing
      // glint - the finisher should look like a decision, not another hit.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.arc(s.x + dir * 3, s.y - 24, 26, dir > 0 ? -1.5 : Math.PI + 1.5, dir > 0 ? 0.3 : Math.PI - 0.3);
      ctx.stroke();
      ctx.globalAlpha = a * (1 - prog) * 1.2;
      ctx.lineWidth = 2;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s.x - 9 * d, s.y - 30);
        ctx.lineTo(s.x + 9 * d, s.y - 12);
        ctx.stroke();
      }
    } else if (e.style === 'shatter') {
      // Shatter Guard: a shield coming apart. Shards fly outward from the block point; no sweep at all.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const ang = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8;
        const near = 4 + prog * 6;
        const far = near + 6 + prog * 14;
        ctx.globalAlpha = a * (1 - prog * 0.6);
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(ang) * near, s.y - 20 + Math.sin(ang) * near * 0.6);
        ctx.lineTo(s.x + Math.cos(ang) * far, s.y - 20 + Math.sin(ang) * far * 0.6);
        ctx.stroke();
      }
    } else if (e.style === 'break') {
      // Bonebreaker: a snap. A hard zigzag crack rather than a clean edge.
      const prog = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      ctx.lineWidth = 2.4 + prog * 1.2;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(s.x - dir * 14, s.y - 30);
      ctx.lineTo(s.x - dir * 4, s.y - 24);
      ctx.lineTo(s.x - dir * 9, s.y - 17);
      ctx.lineTo(s.x + dir * 3, s.y - 11);
      ctx.lineTo(s.x - dir * 2, s.y - 5);
      ctx.stroke();
    } else {
      ctx.lineWidth = e.style === 'claw' ? 2.2 : 3.2;
      ctx.beginPath();
      ctx.arc(s.x + dir * 3, s.y - 22, e.style === 'claw' ? 18 : 23, dir > 0 ? -0.9 : Math.PI + 0.9, dir > 0 ? 0.7 : Math.PI - 0.7);
      ctx.stroke();
      if (e.style === 'claw') {
        ctx.beginPath();
        ctx.arc(s.x + dir * 6, s.y - 17, 13, dir > 0 ? -0.9 : Math.PI + 0.9, dir > 0 ? 0.7 : Math.PI - 0.7);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (e.type === 'spark') {
    const s = this.worldToScreen(e.x, e.y, this.tileAt(e.x, e.y).elev);
    ctx.globalAlpha = 1 - e.t / e.life;
    ctx.fillStyle = e.color;
    ctx.fillRect(s.x - 2, s.y - 7, 4, 4);
    ctx.globalAlpha = 1;
  } else if (e.type === 'silkEggBurst') {
    this.drawSilkEggBurstEffect(e);
  } else if (e.type === 'silkDrop') {
    this.drawSilkDropEffect(e);
  } else if (e.type === 'silkSkeletonFall') {
    this.drawSilkSkeletonFallEffect(e);
  } else if (e.type === 'bossGroundTelegraph') {
    this.drawBossGroundTelegraphEffect(e);
  } else if (e.type === 'bossStrikeHit') {
    this.drawBossStrikeHitEffect(e);
  } else if (e.type === 'silkSealCrawler') {
    this.drawSilkSealCrawlerEffect(e);
  } else if (e.type === 'terrainStep') {
    this.drawTerrainStepEffect(e);
  } else if (e.type === 'castCue') {
    this.drawCastCueEffect(e);
  } else if (e.type === 'combatImpact') {
    this.drawCombatImpactEffect(e);
  } else if (e.type === 'combatSpark') {
    this.drawCombatSparkEffect(e);
  } else if (e.type === 'statusPulse') {
    this.drawStatusPulseEffect(e);
  } else if (e.type === 'assassinProjectile') {
    this.drawAssassinProjectileEffect(e);
  } else if (e.type === 'assassinImpact') {
    this.drawAssassinImpactEffect(e);
  } else if (e.type === 'assassinCrosshair') {
    this.drawAssassinCrosshairEffect(e);
  } else if (e.type === 'assassinTripwire') {
    this.drawAssassinTripwireEffect(e, false);
  } else if (e.type === 'assassinTripwireTrigger') {
    this.drawAssassinTripwireEffect(e, true);
  } else if (e.type === 'assassinPoisonPulse') {
    this.drawAssassinPoisonPulseEffect(e);
  } else if (e.type === 'assassinMarkLine') {
    this.drawAssassinMarkLineEffect(e);
  } else if (e.type === 'assassinMarkSigil') {
    this.drawAssassinMarkSigilEffect(e);
  } else if (e.type === 'assassinMarkFlare') {
    this.drawAssassinMarkFlareEffect(e);
  } else if (e.type === 'assassinMarkRemove') {
    this.drawAssassinMarkRemoveEffect(e);
  } else if (e.type === 'assassinSelfBuff') {
    this.drawAssassinSelfBuffEffect(e);
  } else if (e.type === 'assassinTrapField') {
    this.drawAssassinTrapFieldEffect(e);
  } else if (e.type === 'clericBless') {
    this.drawClericBlessEffect(e);
  } else if (e.type === 'clericSmite') {
    this.drawClericSmiteEffect(e);
  } else if (e.type === 'bardWarHymn') {
    this.drawBardSongWaveEffect(e, false);
  } else if (e.type === 'bardSonicCut') {
    this.drawBardSonicCutEffect(e);
  } else if (e.type === 'bardLullaby') {
    this.drawBardLullabyEffect(e);
  } else if (e.type === 'bardValorChorus') {
    this.drawBardSongWaveEffect(e, true);
  } else if (e.type === 'bardDiscordantNote') {
    this.drawBardDiscordantNoteEffect(e);
  } else if (e.type === 'bardRefrain') {
    this.drawBardRefrainEffect(e);
  } else if (e.type === 'bardNoteParticle') {
    this.drawBardNoteParticleEffect(e);
  } else if (e.type === 'bardMeditationAura') {
    this.drawBardMeditationAuraEffect(e);
  } else if (e.type === 'necroRaiseBoneServant') {
    this.drawNecroRaiseBoneServantEffect(e);
  } else if (e.type === 'necroLifeTap') {
    this.drawNecroDrainTendrilEffect(e, false);
  } else if (e.type === 'necroBoneSpear') {
    this.drawNecroBoneSpearEffect(e);
  } else if (e.type === 'necroRotCloud') {
    this.drawNecroRotCloudEffect(e);
  } else if (e.type === 'necroGraveArmor') {
    this.drawNecroGraveArmorEffect(e);
  } else if (e.type === 'necroSoulLeech') {
    this.drawNecroDrainTendrilEffect(e, true);
  } else if (e.type === 'necroBoneDust') {
    this.drawNecroBoneDustEffect(e);
  } else if (e.type === 'ashrootCrush') {
    this.drawAshrootCrushEffect(e);
  } else if (e.type === 'ashrootAshCloud') {
    this.drawAshrootAshCloudEffect(e);
  } else if (e.type === 'ashrootDeathBloom') {
    this.drawAshrootDeathBloomEffect(e);
  } else if (e.type === 'rotlingRootEntangle') {
    this.drawRotlingRootEntangleEffect(e, layer);
  } else if (e.type === 'ashrootCinderrootSnare') {
    this.drawAshrootCinderrootSnareEffect(e);
  } else if (e.type === 'ashrootBlightwoodPulse') {
    this.drawAshrootBlightwoodPulseEffect(e);
  } else if (e.type === 'ashrootAshenRegrowth') {
    this.drawAshrootAshenRegrowthEffect(e);
  } else if (e.type === 'turnTelegraph') {
    this.drawTurnTelegraphEffect(e);
  }
},

drawSpiderWebProjectileEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const life = Math.max(0.001, Number(e.life || 0.34));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const fade = Math.max(0, 1 - p * 0.55);
      const x = Number(e.x || 0) + (Number(e.x2 || e.x || 0) - Number(e.x || 0)) * p;
      const y = Number(e.y || 0) + (Number(e.y2 || e.y || 0) - Number(e.y || 0)) * p;
      const s1 = this.worldToScreen(e.x, e.y, this.tileAt(e.x, e.y).elev + 0.18);
      const s = this.worldToScreen(x, y, this.tileAt(x, y).elev + 0.22);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgba(238,240,246,0.74)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y - 28);
      ctx.quadraticCurveTo((s1.x + s.x) / 2, Math.min(s1.y, s.y) - 54, s.x, s.y - 22);
      ctx.stroke();
      ctx.fillStyle = e.color || '#e8e6ef';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 22, 7 + p * 2, 5 + p, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade * 0.78;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = p * Math.PI * 6 + i * Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * 4, s.y - 22 + Math.sin(a) * 3);
        ctx.lineTo(s.x + Math.cos(a + 0.9) * 12, s.y - 22 + Math.sin(a + 0.9) * 8);
        ctx.stroke();
      }
      ctx.restore();
},

drawCastCueEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.06);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const fade = 1 - p;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.strokeStyle = e.color || '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 12, 14 + p * 20, 6 + p * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, fade * 0.34);
      ctx.fillStyle = e.color || '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 12, 9 + p * 12, 4 + p * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e.label) {
        ctx.globalAlpha = Math.max(0, fade * 0.82);
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f7f2d2';
        ctx.fillText(e.label, s.x, s.y - 44 - p * 8);
      }
      ctx.restore();
},

drawCombatImpactEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = this.vfxStyle(e);
      const s = this.vfxScreen(e.x, e.y, 0.10 + Number(e.depthBias || 0));
      const life = Math.max(0.001, Number(e.life || 0.42));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const power = Math.max(0.4, Number(e.intensity || 1));
      ctx.save();
      this.drawGroundEllipse(ctx, s.x, s.y + 2, 18 * power * (1 + p), 5 * power * (1 + p * 0.6), style.dark, 0.22 * fade);
      this.drawImpactBloom(ctx, s.x, s.y - 24, p, style.primary, { seed: e.seed || 0, radius: 20 * power, sparks: Math.round(8 + power * 4), sparkRadius: 25 * power });
      if (style.motion === 'impact') this.drawSmokeWisps(ctx, s.x, s.y - 7, p, e.seed || 0, style.smoke, 5 + Math.floor(power), 24, { lift: 12 });
      else this.drawMoteField(ctx, s.x, s.y - 20, p, e.seed || 0, style.secondary, 8, 22 * power, { lift: 10, size: 1.6 });
      ctx.restore();
},

drawCombatSparkEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.28)));
      const fade = 1 - p;
      const s = this.vfxScreen(Number(e.x || 0) + Number(e.vx || 0) * p * 8, Number(e.y || 0) + Number(e.vy || 0) * p * 8, 0.12);
      ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round'; ctx.strokeStyle = e.color || '#ffffff'; ctx.lineWidth = Math.max(0.8, 2.2 * (1 - p));
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 25 - p * 12); ctx.lineTo(s.x - Number(e.vx || 0) * 90, s.y - 25 - p * 12 - Number(e.vy || 0) * 55); ctx.stroke();
      ctx.restore();
},

drawStatusPulseEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = this.vfxStyle(e);
      const s = this.vfxScreen(e.x, e.y, Number(e.height || 0.08));
      const life = Math.max(0.001, Number(e.life || 0.78));
      const p = this.clamp01(Number(e.t || 0) / life);
      const fade = Math.max(0, 1 - p);
      const r = (Number(e.radius || 18) + this.easeOutCubic(p) * 24) * Number(e.scale || 1);
      ctx.save();
      this.drawGroundEllipse(ctx, s.x, s.y + 1, r * 0.68, r * 0.20, style.dark, 0.15 * fade);
      this.drawSoftGlow(ctx, s.x, s.y - 18, r * 1.15, style.primary, 0.16 * fade);
      this.drawExpandingRing(ctx, s.x, s.y - 16, r, style.primary, 0.55 * fade, 1.9, 0.46);
      this.drawExpandingRing(ctx, s.x, s.y - 16, r * 0.62, style.secondary, 0.23 * fade, 0.9, 0.46);
      if (style.motion === 'bloom') this.drawMoteField(ctx, s.x, s.y - 25, p, e.seed || 0, style.secondary, 14, r * 0.62, { lift: 28, size: 2.0 });
      else if (style.motion === 'wisp') this.drawSmokeWisps(ctx, s.x, s.y - 15, p, e.seed || 0, style.smoke, 7, r * 0.42, { lift: 30 });
      else if (style.motion === 'rune') this.drawRuneFragments(ctx, s.x, s.y - 22, p, e.seed || 0, style.secondary, r * 0.52, { count: 9 });
      else this.drawMoteField(ctx, s.x, s.y - 22, p, e.seed || 0, style.secondary, 9, r * 0.50, { lift: 18, size: 1.6 });
      if (e.label) {
        ctx.globalAlpha = fade * 0.90;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = style.secondary;
        ctx.fillText(String(e.label || ''), s.x, s.y - 48 - p * 9);
      }
      ctx.restore();
},



drawAssassinProjectileEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = this.vfxStyle(e);
      const life = Math.max(0.001, Number(e.life || 0.35));
      const travel = Math.max(0.05, Number(e.travelDuration || life * 0.62));
      const p = this.clamp01(Number(e.t || 0) / travel);
      const fade = Math.max(0, 1 - Math.max(0, Number(e.t || 0) - travel) / Math.max(0.001, life - travel));
      const sx = Number(e.x || 0), sy = Number(e.y || 0), tx = Number(e.x2 ?? sx), ty = Number(e.y2 ?? sy);
      const wx = sx + (tx - sx) * this.easeOutCubic(p);
      const wy = sy + (ty - sy) * this.easeOutCubic(p);
      const source = this.vfxScreen(sx, sy, 0.20);
      const target = this.vfxScreen(tx, ty, 0.20);
      const tip = this.vfxScreen(wx, wy, 0.22);
      source.y -= 24; target.y -= 22; tip.y -= 22;
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const st = ASSASSIN_PROJECTILE_KINDS[e.kind] || ASSASSIN_PROJECTILE_KINDS.crossbow;
      ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
      this.drawRibbonTrail(ctx, source, target, this.easeOutCubic(p), st.trail, e.seed || 0, { alpha: (st.motes ? 0.46 : 0.34) * fade, widthStart: st.width, widthEnd: 0.45, length: st.len });
      // Heavy quarrels tear a bright speed-streak ahead of the smoke.
      if (st.streak) { ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = this.rgba(st.streak, 0.6); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(tip.x - Math.cos(angle) * st.len, tip.y - Math.sin(angle) * st.len); ctx.lineTo(tip.x - Math.cos(angle) * 6, tip.y - Math.sin(angle) * 6); ctx.stroke(); ctx.globalAlpha = fade; }
      const drawAngle = st.spin ? angle + p * Math.PI * 2 * 3.2 : angle; // thrown steel tumbles end-over-end in flight
      this.drawProjectileCore(ctx, tip.x, tip.y, drawAngle, p, st.core, { size: st.size, alpha: fade, dark: st.dark, highlight: st.hi });
      if (st.dash) { ctx.strokeStyle = this.rgba('#ffffff', 0.70 * fade); ctx.lineWidth = 1.0; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(tip.x - Math.cos(angle) * (st.len * 0.85), tip.y - Math.sin(angle) * (st.len * 0.85)); ctx.lineTo(tip.x - Math.cos(angle) * 8, tip.y - Math.sin(angle) * 8); ctx.stroke(); ctx.setLineDash([]); }
      if (st.smoke) this.drawSmokeWisps(ctx, tip.x - Math.cos(angle) * 22, tip.y - Math.sin(angle) * 22, p, e.seed || 0, st.smoke, 3, 14, { lift: 4 });
      if (st.motes) this.drawMoteField(ctx, tip.x - Math.cos(angle) * 16, tip.y - Math.sin(angle) * 16, p, e.seed || 0, st.motes, 5, 14, { lift: 4, size: 1.5, yScale: 0.7 });
      if (st.glint) this.drawSoftGlow(ctx, tip.x, tip.y, 9, st.glint, 0.4 * fade);
      if (e.marked) this.drawArcSigil(ctx, tip.x, tip.y, p, e.seed || 0, '#c91527', 9, { alpha: 0.42 * fade, spin: 0.35, width: 1.0 });
      ctx.restore();
},

drawAssassinImpactEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const st = ASSASSIN_IMPACT_KINDS[e.kind] || ASSASSIN_IMPACT_KINDS.crossbow;
      const s = this.vfxScreen(e.x, e.y, 0.18);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.34)));
      const fade = 1 - p;
      const cx = s.x, cy = s.y - 25;
      const color = (e.marked && !st.poison) ? '#d12033' : st.color;
      ctx.save();
      this.drawImpactBloom(ctx, cx, cy, p, color, { seed: e.seed || 0, radius: (st.pierce || st.execute ? 23 : 18) * Number(e.intensity || 1), sparks: st.sparks, sparkRadius: st.sparkR, flat: false });
      this.drawGroundEllipse(ctx, cx, s.y - 4, 16 + p * 20, 5 + p * 5, st.ground, 0.20 * fade);
      if (st.poison) {
        this.drawMoteField(ctx, cx, cy + 2, p, e.seed || 0, '#76e85f', 9, 18, { lift: 12, size: 2.4, yScale: 0.7 });
        this.drawSmokeWisps(ctx, cx, cy + 7, p, e.seed || 0, '#24451f', 5, 14, { lift: 18 });
      } else if (st.pierce) {
        // punch-through: opposed steel shards fly out the far side.
        ctx.globalAlpha = fade * 0.85; ctx.strokeStyle = this.rgba('#dcebff', 0.85); ctx.lineWidth = 2.2; const r = 10 + this.easeOutCubic(p) * 26;
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      } else if (st.execute) {
        this.drawArcSigil(ctx, cx, cy, p, e.seed || 0, '#e2455a', 18 + p * 10, { alpha: 0.5 * fade, spin: 0.6, width: 1.4 });
        this.drawSoftGlow(ctx, cx, cy, 20 + p * 14, '#ff5a70', 0.24 * fade);
      } else if (e.marked) {
        this.drawArcSigil(ctx, cx, cy, p, e.seed || 0, '#d7192c', 18 + p * 8, { alpha: 0.45 * fade, spin: 0.55, width: 1.2 });
      } else if (st.steel) {
        this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, '#ffffff', 6, 22, { width: 0.9 });
      }
      ctx.restore();
},

drawAssassinCrosshairEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.24);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.46)));
      const fade = Math.max(0, 1 - p * 0.35);
      const r = 27 - this.easeOutBack(p) * 13;
      ctx.save();
      this.drawSoftGlow(ctx, s.x, s.y - 26, 28, '#bfc5c9', 0.10 * fade);
      this.drawArcSigil(ctx, s.x, s.y - 26, p, e.seed || 0, '#c8ced0', r, { alpha: 0.50 * fade, spin: -0.09, width: 1.2 });
      ctx.globalAlpha = fade * 0.60; ctx.strokeStyle = '#f0f4ee'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(s.x - r - 8, s.y - 26); ctx.lineTo(s.x - r * 0.32, s.y - 26); ctx.moveTo(s.x + r * 0.32, s.y - 26); ctx.lineTo(s.x + r + 8, s.y - 26); ctx.moveTo(s.x, s.y - 26 - r * 0.72); ctx.lineTo(s.x, s.y - 26 - r * 0.18); ctx.moveTo(s.x, s.y - 26 + r * 0.18); ctx.lineTo(s.x, s.y - 26 + r * 0.72); ctx.stroke();
      this.drawSmokeWisps(ctx, s.x - 10 + p * 4, s.y - 13, p, e.seed || 0, '#23272a', 3, 12, { lift: 4 });
      ctx.restore();
},

drawAssassinTripwireEffect(e, triggered = false) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const a = this.vfxScreen(e.x, e.y, 0.05);
      const b = this.vfxScreen(e.x2, e.y2, 0.05);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.6)));
      const fade = 1 - p;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 7;
      ctx.save();
      this.drawGroundEllipse(ctx, mx, my + 7, Math.abs(b.x - a.x) * 0.45 + 8, 4, '#080808', 0.16 * fade);
      ctx.globalAlpha = Math.max(0, fade * (triggered ? 0.95 : 0.72)); ctx.strokeStyle = triggered ? '#f2f5e8' : '#b9c0bd'; ctx.lineWidth = triggered ? 1.8 : 1.0; ctx.setLineDash(triggered ? [4, 3] : [2, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 6); ctx.quadraticCurveTo(mx, my - (triggered ? 14 * this.easeOutBack(p) : 0), b.x, b.y - 6); ctx.stroke(); ctx.setLineDash([]);
      this.drawSparkBurst(ctx, triggered ? mx : a.x, triggered ? my : a.y - 6, p, e.seed || 0, triggered ? '#ffffff' : '#bfc6c2', triggered ? 9 : 4, triggered ? 24 : 10, { flat: true, width: 0.8 });
      ctx.fillStyle = '#232323'; ctx.strokeStyle = '#6c7070'; ctx.lineWidth = 0.8;
      for (const pt of [a, b]) { ctx.beginPath(); ctx.ellipse(pt.x, pt.y - 5, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
},

drawAssassinPoisonPulseEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.12);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.58)));
      const fade = 1 - p;
      ctx.save();
      this.drawGroundEllipse(ctx, s.x, s.y - 4, 18 + p * 24, 6 + p * 7, '#113a13', 0.24 * fade);
      this.drawSoftGlow(ctx, s.x, s.y - 20, 34 + p * 18, '#78e268', 0.18 * fade);
      this.drawExpandingRing(ctx, s.x, s.y - 20, 13 + this.easeOutCubic(p) * 24, '#7dff65', 0.65 * fade, 1.6, 0.48);
      this.drawMoteField(ctx, s.x, s.y - 22, p, e.seed || 0, '#76e85f', 11, 23, { lift: 12, size: 2.5, yScale: 0.7 });
      this.drawSmokeWisps(ctx, s.x, s.y - 14, p, e.seed || 0, '#24451f', 4, 18, { lift: 18 });
      ctx.restore();
},

drawAssassinSelfBuffEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(Number(e.x || 0), Number(e.y || 0), 0.05);
      const cx = s.x, cy = s.y - 26;
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.6)));
      const fade = 1 - p;
      const style = String(e.style || '').toLowerCase();
      ctx.save();
      if (style === 'reload') {
        // Quick Reload: a steel ratchet spins shut and a fresh bolt seats.
        this.drawSoftGlow(ctx, cx, cy, 22, '#c7cdd0', 0.12 * fade);
        ctx.globalAlpha = fade * 0.85; ctx.strokeStyle = '#cfd5d8'; ctx.lineWidth = 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.easeOutBack(p) * Math.PI * 0.9);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.stroke(); }
        ctx.restore();
        this.drawExpandingRing(ctx, cx, cy, 8 + this.easeOutBack(p) * 12, '#e6ecec', 0.55 * fade, 1.4, 0.5);
        this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, '#f4f7f2', 5, 16, { width: 0.8 });
      } else if (style === 'silentstep') {
        // Silent Step: cold shadow smoke swallows the silhouette.
        this.drawGroundEllipse(ctx, cx, s.y - 4, 20 + p * 16, 7, '#05070a', 0.28 * fade);
        this.drawSmokeWisps(ctx, cx, cy + 4, p, e.seed || 0, '#0c1016', 8, 22, { lift: 22 });
        this.drawSoftGlow(ctx, cx, cy, 26, '#2a2f3a', 0.16 * fade);
        this.drawExpandingRing(ctx, cx, cy, 10 + this.easeOutCubic(p) * 22, '#3a4150', 0.30 * fade, 1.6, 0.5);
      } else if (style === 'shadowfuse') {
        // Shadow Fuse: violet fuse-lines whip out to link the traps.
        this.drawSoftGlow(ctx, cx, cy, 26, '#9b5cff', 0.16 * fade);
        ctx.globalAlpha = fade * 0.7; ctx.strokeStyle = this.rgba('#b58bff', 0.8); ctx.lineWidth = 1.3; ctx.setLineDash([3, 5]);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + p * 1.2; const r = 12 + this.easeOutCubic(p) * 26; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6); ctx.stroke(); }
        ctx.setLineDash([]);
        this.drawMoteField(ctx, cx, cy, p, e.seed || 0, '#a678ff', 7, 20, { lift: 8, size: 1.6, yScale: 0.7 });
      } else if (style === 'venomcoat') {
        // Black Lotus Venom: venom sweats up over the blades.
        this.drawGroundEllipse(ctx, cx, s.y - 4, 18 + p * 12, 6, '#0d2410', 0.24 * fade);
        this.drawSoftGlow(ctx, cx, cy, 26, '#5fd24e', 0.18 * fade);
        this.drawMoteField(ctx, cx, cy + 6, p, e.seed || 0, '#76e85f', 12, 20, { lift: 24, size: 2.2, yScale: 0.7 });
        this.drawExpandingRing(ctx, cx, cy, 10 + this.easeOutCubic(p) * 18, '#7dff65', 0.40 * fade, 1.6, 0.5);
      } else {
        // Perfect Ambush (default): a lethal crimson readiness sigil flares.
        this.drawSoftGlow(ctx, cx, cy, 24, '#d7324a', 0.16 * fade);
        this.drawArcSigil(ctx, cx, cy, p, e.seed || 0, '#e2455a', 14 + this.easeOutBack(p) * 8, { alpha: 0.50 * fade, spin: 0.5, width: 1.3 });
        this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, '#ff6076', 6, 18, { width: 0.9 });
      }
      ctx.restore();
},

drawAssassinTrapFieldEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(Number(e.x || 0), Number(e.y || 0), 0.02);
      const edge = this.vfxScreen(Number(e.x || 0) + Math.max(1, Number(e.radius || 3)), Number(e.y || 0), 0.02);
      const R = Math.max(20, Math.abs(edge.x - s.x));
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.9)));
      const fade = 1 - p;
      const cx = s.x, cy = s.y - 6;
      ctx.save();
      // Death Box: a mechanical kill-zone of tension wires snaps taut with blade nodes.
      this.drawGroundEllipse(ctx, cx, cy, R, R * 0.5, '#160406', 0.30 * fade);
      ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = this.rgba(e.color || '#c9d0cf', 0.85); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      const spokes = 8;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        const nx = cx + Math.cos(a) * R, ny = cy + Math.sin(a) * R * 0.5;
        ctx.globalAlpha = fade * 0.45; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
        const snap = this.pulse01(p * 2 + i / spokes);
        ctx.globalAlpha = fade * (0.4 + snap * 0.5); ctx.fillStyle = this.rgba('#e6ecec', 0.9);
        ctx.beginPath(); ctx.moveTo(nx, ny - 4 - snap * 4); ctx.lineTo(nx + 3, ny); ctx.lineTo(nx - 3, ny); ctx.closePath(); ctx.fill();
      }
      this.drawExpandingRing(ctx, cx, cy, R * (0.3 + this.easeOutCubic(p) * 0.7), e.color2 || '#f0c6ff', 0.35 * fade, 1.4, 0.5);
      this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, '#ffffff', 8, R * 0.6, { flat: true, width: 0.8 });
      ctx.restore();
},

drawAssassinMarkLineEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s1 = this.vfxScreen(e.x, e.y, 0.36);
      const s2 = this.vfxScreen(e.x2, e.y2, 0.42);
      s1.y -= 34; s2.y -= 31;
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.3)));
      const fade = 1 - p;
      ctx.save();
      this.drawRibbonTrail(ctx, s1, s2, this.easeOutCubic(p), '#d7192c', e.seed || 0, { alpha: 0.68 * fade, widthStart: 4.8, widthEnd: 0.5, length: 96 });
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * 0.45; ctx.strokeStyle = '#ff4756'; ctx.lineWidth = 1.0; ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      ctx.restore();
},

drawAssassinExecutionSigil(ctx, x, y, radius, p, color, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p * Math.PI * 2 * 0.18); ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(35,8,10,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = color || '#d7192c'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (radius - 3), Math.sin(a) * (radius - 3)); ctx.lineTo(Math.cos(a) * (radius + 5), Math.sin(a) * (radius + 5)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-radius * 0.55, radius * 0.44); ctx.lineTo(radius * 0.45, -radius * 0.50); ctx.lineTo(radius * 0.62, -radius * 0.36); ctx.lineTo(-radius * 0.34, radius * 0.58); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, radius * 0.28, radius * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color || '#d7192c'; ctx.globalAlpha = alpha * (0.35 + 0.18 * Math.sin(p * Math.PI * 8)); ctx.beginPath(); ctx.arc(0, 0, radius * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawAssassinMarkSigilEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.38);
      const time = Number(e.t || 0);
      const p = (time % 12) / 12;
      const pulse = 0.90 + Math.sin(time * 4.0 + Number(e.seed || 0)) * 0.10;
      const scale = Number(e.intensity || 1);
      ctx.save();
      this.drawSoftGlow(ctx, s.x, s.y - 36, 28 * scale, '#d7192c', 0.12 + 0.06 * pulse);
      this.drawAssassinExecutionSigil(ctx, s.x, s.y - 36, 13 * scale * pulse, p, e.color || '#d7192c', 0.78);
      this.drawArcSigil(ctx, s.x, s.y - 36, p, e.seed || 0, '#5b060e', 19 * scale, { alpha: 0.22, spin: -0.05, width: 1.0 });
      this.drawGroundEllipse(ctx, s.x, s.y - 17, 19 * scale, 5.5 * scale, '#160507', 0.18);
      const dropPhase = (time * 0.8 + Number(e.seed || 0)) % 1;
      ctx.globalAlpha = 0.32 * (1 - dropPhase); ctx.fillStyle = '#b81222'; ctx.beginPath(); ctx.ellipse(s.x + Math.sin(time * 2) * 7, s.y - 25 + dropPhase * 20, 1.7, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawAssassinMarkFlareEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.36);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.36)));
      const fade = 1 - p;
      ctx.save();
      this.drawSoftGlow(ctx, s.x, s.y - 36, 24 + p * 20, '#d7192c', 0.18 * fade);
      this.drawAssassinExecutionSigil(ctx, s.x, s.y - 36, 12 + p * 10, p, e.color || '#d7192c', fade * 0.78);
      this.drawSparkBurst(ctx, s.x, s.y - 36, p, e.seed || 0, '#ff4656', 9, 28, { width: 1.0 });
      ctx.restore();
},

drawAssassinMarkRemoveEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.34);
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.62)));
      const fade = 1 - p;
      ctx.save();
      this.drawSmokeWisps(ctx, s.x, s.y - 28, p, e.seed || 0, '#0b0506', 6, 28, { lift: 12 });
      this.drawSparkBurst(ctx, s.x, s.y - 36, p, e.seed || 0, '#b51224', 10, 35, { width: 0.85 });
      this.drawGroundEllipse(ctx, s.x, s.y - 25 + p * 8, 26 + p * 10, 9 + p * 4, '#0b0506', 0.16 * fade);
      ctx.restore();
},

drawBardMeditationAuraEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.12);
      const life = Math.max(0.001, Number(e.life || 0.95));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const fade = Math.max(0, 1 - p);
      const seed = Number(e.seed || 0);
      const time = (this.runtimeNowMs?.() || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())) / 1000;
      ctx.save();
      ctx.globalAlpha = 0.34 * fade;
      ctx.strokeStyle = '#8fd7ff';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const wave = (time * 0.52 + seed + i * 0.5) % 1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 11 - i * 4, 13 + wave * 17, 5 + wave * 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const glyphs = ['♪', '♫', '♩', '𝄞'];
      ctx.font = 'bold 13px ui-serif, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 5; i++) {
        const phase = (time * 0.28 + seed * 0.73 + i / 5) % 1;
        const angle = phase * Math.PI * 2 + i * 1.71;
        const orbit = 12 + i * 2.1;
        const x = s.x + Math.cos(angle) * orbit;
        const y = s.y - 27 - phase * 24 + Math.sin(angle) * 4;
        const localFade = fade * Math.sin(Math.PI * phase);
        ctx.globalAlpha = Math.max(0, localFade * 0.78);
        ctx.fillStyle = i % 2 ? '#8fd7ff' : '#ffd98a';
        ctx.fillText(glyphs[i % glyphs.length], x, y);
      }
      ctx.globalAlpha = 0.22 * fade;
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 14, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
},

// V0.17.51 Phase 12 (Animated Waypoint Aura): the animated overlay for the
// static 'waypoint' object drawWaypoint already renders (render/object-renderer.js,
// Phase 11) - this draws on top of that emblem, it does not replace it, so
// the emblem stays readable underneath. Modeled directly on
// drawBardMeditationAuraEffect just above (same worldToScreen/time/seed
// pattern) rather than inventing a new effect-rendering approach. The
// effect's own e.t/e.life are not used for fade here - life is
// intentionally huge (see systems/waypoint-system.js) so this always reads
// as a persistent, smoothly looping ambient landmark aura, not a fading
// one-shot. All motion is driven by elapsed real time and modulo-looped, so
// it stays smooth indefinitely with no reset/restart logic needed. Particle
// count is kept low (4 motes, 6 rune-ring ticks) per this phase's own rule.
drawTurnTelegraphEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const targetTile = this.tileAt(e.x, e.y);
      const t = this.worldToScreen(e.x, e.y, (targetTile?.elev || 0) + 0.07);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const pulse = 0.5 + Math.sin(p * Math.PI * 4) * 0.18;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - p * 0.45));
      ctx.strokeStyle = e.color || '#d4665a';
      ctx.lineWidth = 2.1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + 1, 21 + pulse * 7, 9 + pulse * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (e.ranged && Number.isFinite(e.sourceX) && Number.isFinite(e.sourceY)) {
        const sourceTile = this.tileAt(e.sourceX, e.sourceY);
        const f = this.worldToScreen(e.sourceX, e.sourceY, (sourceTile?.elev || 0) + 0.07);
        ctx.globalAlpha = Math.max(0, 0.42 - p * 0.18);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 20);
        ctx.lineTo(t.x, t.y - 20);
        ctx.stroke();
      }
      if (e.label) {
        ctx.globalAlpha = Math.max(0, 0.88 - p * 0.25);
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe5be';
        ctx.fillText(e.label, t.x, t.y - 49);
      }
      ctx.restore();
},


drawTerrainStepEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const projected = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.02);
      const yOffset = Number.isFinite(Number(e.screenYOffset)) ? Number(e.screenYOffset) : 1;
      const xOffset = Number.isFinite(Number(e.screenXOffset)) ? Number(e.screenXOffset) : 0;
      const base = {
        x: projected.x + xOffset,
        y: projected.y + yOffset
      };
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const fade = 1 - p;
      const expand = 1 + p * 1.4;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);

      if (e.terrainId === 'shallow_water' || e.terrainId === 'swamp') {
        ctx.strokeStyle = e.terrainId === 'swamp' ? 'rgba(83,116,91,0.58)' : 'rgba(151,231,244,0.72)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y + 3, 9 * expand * (e.scale || 1), 4 * expand * (e.scale || 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const pt of e.particles || []) {
        const local = this.worldToScreen(e.x + (pt.ox || 0) + (pt.vx || 0) * p * 4, e.y + (pt.oy || 0) + (pt.vy || 0) * p * 4, (tile?.elev || 0) + 0.02);
        const x = base.x + (local.x - projected.x);
        const y = base.y + (local.y - projected.y) - (pt.lift || 0) * Math.sin(p * Math.PI) * 0.72 + p * 4;
        const size = Math.max(0.6, (pt.size || 2) * (1 - p * 0.35));
        ctx.fillStyle = pt.color || '#c2b184';
        ctx.strokeStyle = pt.color || '#c2b184';

        if (pt.droplet || e.terrainId === 'shallow_water' || e.terrainId === 'swamp') {
          ctx.beginPath();
          ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.terrainId === 'grass') {
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(x, y + size * 0.8);
          ctx.lineTo(x + Math.cos((pt.rot || 0) + p) * size * 1.8, y - size * 1.2);
          ctx.stroke();
        } else if (e.terrainId === 'leaves') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((pt.rot || 0) + (pt.spin || 0) * p);
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.25, size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (e.terrainId === 'stone') {
          ctx.fillRect(x - size * 0.35, y - size * 0.35, size * 0.7, size * 0.7);
        } else {
          ctx.globalAlpha = Math.max(0, fade * 0.56);
          ctx.beginPath();
          ctx.ellipse(x, y, size * 1.35, size * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = Math.max(0, fade);
        }
      }
      ctx.restore();
},



drawBardGlyph(ctx, x, y, scale = 1, glyph = 0, color = '#ffd36a', rotation = 0, alpha = 1) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation || 0);
      ctx.scale(scale, scale);
      ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.8;
      const g = Math.floor(Number(glyph) || 0) % 6;
      if (g === 0) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.lineTo(8, -11); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-2, 2, 4, 3, -0.35, 0, Math.PI * 2); ctx.fill();
      } else if (g === 1) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(8, -13, 7, -7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-2, 2, 4, 3, -0.35, 0, Math.PI * 2); ctx.fill();
      } else if (g === 2) {
        ctx.beginPath(); ctx.arc(0, 0, 4, 0.15, Math.PI * 1.82); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(10, -6); ctx.stroke();
      } else if (g === 3) {
        ctx.beginPath(); ctx.moveTo(-5, -4); ctx.quadraticCurveTo(0, -11, 6, -4); ctx.quadraticCurveTo(0, 7, -5, -4); ctx.stroke();
      } else if (g === 4) {
        ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, -7); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(-7, 7); ctx.lineTo(7, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(2, -2, 2.8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(-5, 4); ctx.bezierCurveTo(-12, -4, -4, -12, 4, -7); ctx.bezierCurveTo(13, -1, 6, 7, -5, 4); ctx.stroke();
      }
      ctx.restore();
},

drawHolyCross(ctx, x, y, size, color, alpha) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, size * 0.24);
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size * 0.9); ctx.moveTo(x - size * 0.6, y - size * 0.3); ctx.lineTo(x + size * 0.6, y - size * 0.3); ctx.stroke();
      ctx.globalAlpha = Math.max(0, alpha * 0.5); ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y - size, size * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawSunburst(ctx, x, y, radius, rays, color, alpha, p = 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
      for (let i = 0; i < rays; i++) {
        const a = i / rays * Math.PI * 2 + p * 0.4;
        const r0 = radius * 0.42, r1 = radius * (0.9 + (i % 2) * 0.22);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.55); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.55); ctx.stroke();
      }
      ctx.restore();
},

// Holy support/heal/shield family (single-ally, group, cleanse, ward, revive,
// turn-undead nova) - one function, keyed by e.style.
drawClericBlessEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = String(e.style || 'heal').toLowerCase();
      const s = this.vfxScreen(Number(e.x || 0), Number(e.y || 0), 0.05);
      const cx = s.x, cy = s.y - 26;
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.7)));
      const fade = 1 - p;
      const gold = e.color || '#ffd66a';
      const warm = e.color2 || '#fff6d5';
      const edge = this.vfxScreen(Number(e.x || 0) + Math.max(1, Number(e.radius || 3)), Number(e.y || 0), 0.05);
      const R = Math.max(24, Math.abs(edge.x - s.x));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (style === 'aoeheal') {
        this.drawGroundEllipse(ctx, cx, s.y - 4, R * 0.9, R * 0.42, warm, 0.14 * fade);
        this.drawExpandingRing(ctx, cx, s.y - 6, R * 0.3 + this.easeOutCubic(p) * R * 0.7, gold, 0.5 * fade, 2.4, 0.46);
        this.drawExpandingRing(ctx, cx, s.y - 6, R * 0.15 + this.easeOutCubic(p) * R * 0.5, warm, 0.4 * fade, 1.6, 0.46);
        this.drawSunburst(ctx, cx, cy, 20 + p * 16, 12, warm, 0.4 * fade, p);
        this.drawMoteField(ctx, cx, cy + 8, p, e.seed || 0, warm, 14, R * 0.5, { lift: 26, size: 2.2, yScale: 0.7 });
        for (const a of (Array.isArray(e.allies) ? e.allies : [])) { const as = this.vfxScreen(a.x, a.y, 0.06); this.drawSoftGlow(ctx, as.x, as.y - 26, 16, warm, 0.22 * fade); this.drawHolyCross(ctx, as.x, as.y - 34, 7, gold, 0.5 * fade); }
      } else if (style === 'nova') {
        this.drawSoftGlow(ctx, cx, cy, R * 0.5, warm, 0.24 * fade);
        this.drawExpandingRing(ctx, cx, s.y - 6, R * 0.2 + this.easeOutBack(p) * R * 0.85, gold, 0.6 * fade, 3, 0.5);
        this.drawSunburst(ctx, cx, cy, 24 + p * R * 0.4, 16, warm, 0.5 * fade, p);
        this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, warm, 14, R * 0.6, { width: 1 });
        this.drawHolyCross(ctx, cx, cy - 6, 12, warm, 0.7 * fade);
      } else if (style === 'revive') {
        const h = 92 * this.easeOutCubic(p);
        const g = ctx.createLinearGradient(cx, cy + 12, cx, cy - h);
        g.addColorStop(0, this.rgba(warm, 0)); g.addColorStop(0.4, this.rgba(gold, 0.5 * fade)); g.addColorStop(1, this.rgba(warm, 0));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(cx - 13, cy - h, 26, h + 22);
        this.drawSoftGlow(ctx, cx, cy - h * 0.5, 26, warm, 0.30 * fade);
        this.drawMoteField(ctx, cx, cy, p, e.seed || 0, warm, 12, 20, { lift: h * 0.8, size: 2, yScale: 0.5 });
        this.drawHolyCross(ctx, cx, cy - h - 6, 11 + p * 6, gold, 0.7 * fade);
      } else if (style === 'ward') {
        const rr = (e.radius > 3 ? R * 0.72 : 26) + this.easeOutBack(p) * 6;
        ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = gold; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 1.02, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.26 * fade; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + p * 0.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.02); ctx.stroke(); }
        this.drawSoftGlow(ctx, cx, cy, rr * 0.9, warm, 0.14 * fade);
        this.drawHolyCross(ctx, cx, cy - 4, 9, warm, 0.7 * fade);
        this.drawSparkBurst(ctx, cx, cy, p, e.seed || 0, warm, 6, rr, { width: 0.8 });
        for (const a of (Array.isArray(e.allies) ? e.allies : [])) { const as = this.vfxScreen(a.x, a.y, 0.06); this.drawSoftGlow(ctx, as.x, as.y - 26, 14, gold, 0.18 * fade); }
      } else if (style === 'cleanse') {
        this.drawGroundEllipse(ctx, cx, s.y - 4, 20, 7, warm, 0.16 * fade);
        this.drawExpandingRing(ctx, cx, cy, 10 + this.easeOutCubic(p) * 20, warm, 0.45 * fade, 1.8, 0.5);
        this.drawMoteField(ctx, cx, cy + 6, p, e.seed || 0, warm, 12, 18, { lift: 28, size: 1.8, yScale: 0.6 });
        ctx.globalAlpha = fade * 0.5; ctx.fillStyle = this.rgba('#3a2b12', 0.6);
        for (let i = 0; i < 6; i++) { const a = this.vfxRand(e.seed, i) * Math.PI * 2; const rr = 6 + this.vfxRand(e.seed, i + 9) * 12; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy - p * 26 + Math.sin(a) * 4, 1.4, 0, Math.PI * 2); ctx.fill(); }
        this.drawHolyCross(ctx, cx, cy - 10, 8, gold, 0.6 * fade);
      } else if (style === 'hot') {
        this.drawSoftGlow(ctx, cx, cy, 20 + Math.sin(p * Math.PI * 3) * 4, warm, 0.16 * fade);
        this.drawMoteField(ctx, cx, cy + 4, p, e.seed || 0, warm, 8, 16, { lift: 22, size: 1.5, yScale: 0.6 });
        this.drawHolyCross(ctx, cx, cy - 6, 8, gold, 0.5 * fade);
        this.drawExpandingRing(ctx, cx, cy, 8 + this.easeOutCubic(p) * 14, gold, 0.3 * fade, 1.4, 0.5);
      } else {
        this.drawSoftGlow(ctx, cx, cy, 24, warm, 0.22 * fade);
        this.drawExpandingRing(ctx, cx, cy, 10 + this.easeOutBack(p) * 18, gold, 0.5 * fade, 2, 0.5);
        this.drawExpandingRing(ctx, cx, cy, 6 + this.easeOutBack(p) * 11, warm, 0.4 * fade, 1.4, 0.5);
        this.drawSunburst(ctx, cx, cy, 16 + p * 12, 10, warm, 0.36 * fade, p);
        this.drawMoteField(ctx, cx, cy + 6, p, e.seed || 0, warm, 10, 16, { lift: 24, size: 2, yScale: 0.6 });
        this.drawHolyCross(ctx, cx, cy - 10 - p * 8, 10, gold, 0.7 * fade);
      }
      ctx.restore();
},

// Holy strike (Smite / Judgment / Exorcise): a pillar of light slams down onto
// the target, then blooms.
drawClericSmiteEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const style = String(e.style || 'smite').toLowerCase();
      const t = this.vfxScreen(Number(e.x2 ?? e.x), Number(e.y2 ?? e.y), 0.18);
      const tx = t.x, ty = t.y - 24;
      const p = this.clamp01(Number(e.t || 0) / Math.max(0.001, Number(e.life || 0.55)));
      const fade = 1 - p;
      const gold = e.color || '#ffe08a';
      const warm = e.color2 || '#fff6d5';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const drop = this.easeOutExpo(this.clamp01(p / 0.42));
      const top = ty - 150;
      const beamBottom = top + (ty - top) * drop;
      const halfW = 10 + (style === 'judgment' ? 4 : 0);
      const g = ctx.createLinearGradient(tx, top, tx, beamBottom);
      g.addColorStop(0, this.rgba(warm, 0)); g.addColorStop(0.5, this.rgba(gold, 0.5 * fade + 0.12)); g.addColorStop(1, this.rgba(warm, 0.7 * fade));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(tx - halfW * 0.4, top); ctx.lineTo(tx + halfW * 0.4, top); ctx.lineTo(tx + halfW, beamBottom); ctx.lineTo(tx - halfW, beamBottom); ctx.closePath(); ctx.fill();
      if (p > 0.32) {
        const ip = this.clamp01((p - 0.32) / 0.6);
        this.drawImpactBloom(ctx, tx, ty, ip, warm, { seed: e.seed || 0, radius: style === 'judgment' ? 26 : 22, sparks: 14, sparkRadius: 30, flat: false });
        this.drawExpandingRing(ctx, tx, ty + 4, 8 + this.easeOutCubic(ip) * 26, gold, 0.5 * (1 - ip), 2, 0.5);
        this.drawSunburst(ctx, tx, ty, 20 + ip * 16, 12, warm, 0.4 * (1 - ip), ip);
      }
      this.drawHolyCross(ctx, tx, beamBottom - 14, 11, warm, 0.5 + 0.5 * fade);
      if (style === 'exorcise') {
        this.drawSoftGlow(ctx, tx, ty, 28, '#ffffff', 0.24 * fade);
        this.drawMoteField(ctx, tx, ty, p, e.seed || 0, warm, 10, 20, { lift: 20, size: 1.8, yScale: 0.7 });
      }
      ctx.restore();
},

drawBardNoteParticleEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const tile = this.tileAt(e.x, e.y);
      const x = e.x + (e.vx || 0) * e.t * 10;
      const y = e.y + (e.vy || 0) * e.t * 10;
      const s = this.worldToScreen(x, y, (tile?.elev || 0) + 0.06);
      const fade = Math.max(0, 1 - p);
      ctx.save();
      ctx.globalAlpha = fade * 0.74;
      this.drawBardGlyph(ctx, s.x, s.y - 18 - p * 18, 0.72 * (e.size || 1), e.glyph || 0, e.color || '#ffd36a', (e.spin || 0) * p + p * 1.8, 1);
      ctx.restore();
},

drawBardSongWaveEffect(e, grand = false) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.05);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const fade = Math.max(0, 1 - Math.max(0, p - 0.74) / 0.26);
      const maxRadius = Math.max(16, Number(e.radius || (grand ? 20 : 18)) * (grand ? 4.2 : 3.45));
      // Themed per song (heal green, mana blue, war red, etc.); gold is the default.
      const gold = e.color || (grand ? '#ffd36a' : '#f0d38d');
      const rose = e.color2 || (grand ? '#ffb980' : '#d9985a');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Instrument/voice origin glow.
      const originPulse = Math.sin(Math.min(1, p * 2.2) * Math.PI);
      const grad = ctx.createRadialGradient(s.x, s.y - 42, 2, s.x, s.y - 42, 26 + originPulse * 12);
      grad.addColorStop(0, 'rgba(255,243,176,0.75)');
      grad.addColorStop(0.52, grand ? 'rgba(255,178,112,0.28)' : 'rgba(255,211,106,0.24)');
      grad.addColorStop(1, 'rgba(255,211,106,0)');
      ctx.globalAlpha = 0.78 * originPulse;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y - 42, 30 + originPulse * 8, 0, Math.PI * 2); ctx.fill();

      const ringCount = grand ? 7 : 5;
      for (let i = 0; i < ringCount; i++) {
        const rp = Math.max(0, Math.min(1, p * (grand ? 1.18 : 1.08) - i * (grand ? 0.075 : 0.10)));
        if (rp <= 0 || rp >= 1.05) continue;
        const wobble = 1 + Math.sin(e.t * 8 + i) * 0.045;
        const rx = 12 + rp * maxRadius * wobble;
        const ry = 5 + rp * maxRadius * (grand ? 0.33 : 0.28) * (1 + Math.cos(e.t * 7 + i) * 0.035);
        ctx.globalAlpha = Math.max(0, fade * (grand ? 0.46 : 0.36) * (1 - rp * 0.72));
        ctx.strokeStyle = i % 2 ? rose : gold;
        ctx.lineWidth = grand ? 2.5 - rp * 0.9 : 2.0 - rp * 0.65;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 5, rx, ry, Math.sin(i) * 0.035, 0, Math.PI * 2);
        ctx.stroke();
        // Staff lines riding the wave.
        if (grand && i % 2 === 0) {
          ctx.globalAlpha *= 0.45;
          for (let st = -1; st <= 1; st++) {
            ctx.beginPath();
            ctx.ellipse(s.x, s.y - 5 + st * 4, rx * 0.92, ry * 0.88, 0, Math.PI * 0.12, Math.PI * 1.06);
            ctx.stroke();
          }
        }
      }

      // Musical notes and bardic runes spiral through the wave field.
      const noteCount = grand ? 22 : 14;
      for (let i = 0; i < noteCount; i++) {
        const np = (p * (grand ? 1.15 : 0.95) + i / noteCount) % 1;
        const angle = np * Math.PI * 2 * (grand ? 1.5 : 1.1) + i * 2.399;
        const r = maxRadius * (0.16 + np * 0.74);
        const nx = s.x + Math.cos(angle) * r;
        const ny = s.y - 11 + Math.sin(angle) * r * 0.32;
        ctx.globalAlpha = fade * (0.28 + 0.32 * Math.sin(np * Math.PI));
        this.drawBardGlyph(ctx, nx, ny, grand ? 0.72 : 0.58, i, i % 3 === 0 ? '#fff0b8' : (i % 3 === 1 ? gold : rose), angle * 0.28, 1);
      }

      // Ally buff flashes: weapon/chest flashes for War Hymn, shield+blade motifs for Valor Chorus.
      const allies = Array.isArray(e.allies) ? e.allies : [];
      for (let i = 0; i < allies.length; i++) {
        const ally = allies[i];
        const aTile = this.tileAt(ally.x, ally.y);
        const as = this.worldToScreen(ally.x, ally.y, (aTile?.elev || 0) + 0.08);
        const flash = Math.max(0, 1 - Math.abs(p - 0.45 - i * 0.025) / 0.32);
        if (flash <= 0) continue;
        ctx.globalAlpha = flash * (grand ? 0.55 : 0.42);
        ctx.fillStyle = this.rgba(gold, grand ? 0.72 : 0.66);
        ctx.beginPath(); ctx.ellipse(as.x, as.y - 38, grand ? 18 : 13, grand ? 21 : 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rose;
        ctx.lineWidth = 2;
        if (grand) {
          ctx.beginPath(); ctx.moveTo(as.x - 9, as.y - 50); ctx.lineTo(as.x + 9, as.y - 50); ctx.lineTo(as.x + 6, as.y - 30); ctx.lineTo(as.x, as.y - 23); ctx.lineTo(as.x - 6, as.y - 30); ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(as.x - 2, as.y - 29); ctx.lineTo(as.x + 13, as.y - 46); ctx.stroke();
        } else {
          this.drawBardGlyph(ctx, as.x, as.y - 54, 0.70, i, '#fff0b8', p * 3 + i, 0.9);
        }
      }
      ctx.restore();
},

drawBardSonicCutEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const c1 = e.color || '#fff3b0', c2 = e.color2 || '#d9985a'; // themed per sonic spell
      const s1 = this.worldToScreen(e.x, e.y, (this.tileAt(e.x, e.y)?.elev || 0) + 0.08);
      const s2 = this.worldToScreen(e.x2, e.y2, (this.tileAt(e.x2, e.y2)?.elev || 0) + 0.08);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const flight = Math.max(0, Math.min(1, (p - 0.06) / 0.78));
      const x = s1.x + (s2.x - s1.x) * flight;
      const y = (s1.y - 42) + ((s2.y - 34) - (s1.y - 42)) * flight;
      const angle = Math.atan2((s2.y - 34) - (s1.y - 42), s2.x - s1.x);
      const fade = Math.sin(Math.min(1, p) * Math.PI);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // Compressed-air trail.
      for (let i = 0; i < 7; i++) {
        const tp = Math.max(0, flight - i * 0.055);
        const tx = s1.x + (s2.x - s1.x) * tp;
        const ty = (s1.y - 42) + ((s2.y - 34) - (s1.y - 42)) * tp;
        ctx.globalAlpha = Math.max(0, 0.42 - i * 0.05) * fade;
        ctx.strokeStyle = i % 2 ? 'rgba(255,243,176,0.72)' : 'rgba(217,152,90,0.58)';
        ctx.lineWidth = Math.max(1, 4 - i * 0.42);
        ctx.beginPath(); ctx.moveTo(tx - Math.cos(angle) * 10, ty - Math.sin(angle) * 10); ctx.lineTo(tx + Math.cos(angle) * 12, ty + Math.sin(angle) * 12); ctx.stroke();
      }
      // Sonic crescent blade.
      ctx.translate(x, y);
      ctx.rotate(angle - 0.2);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = c1;
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(0, 0, 24, -1.1, 1.15); ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.arc(2, 0, 17, -1.05, 1.04); ctx.stroke();
      ctx.globalAlpha = fade * 0.45;
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.ellipse(10, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (p > 0.72) {
        const ip = Math.min(1, (p - 0.72) / 0.20);
        ctx.globalAlpha = Math.max(0, 1 - ip);
        ctx.strokeStyle = c1;
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.ellipse(s2.x, s2.y - 34, 26 + ip * 18, 8 + ip * 7, angle, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 7; i++) this.drawBardGlyph(ctx, s2.x + Math.cos(i) * (8 + ip * 18), s2.y - 34 + Math.sin(i) * (5 + ip * 10), 0.45, i, '#fff0b8', i + ip * 2, 1 - ip);
      }
      ctx.restore();
},

drawBardLullabyEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s1 = this.worldToScreen(e.x, e.y, (this.tileAt(e.x, e.y)?.elev || 0) + 0.07);
      const s2 = this.worldToScreen(e.x2, e.y2, (this.tileAt(e.x2, e.y2)?.elev || 0) + 0.07);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const inP = Math.min(1, p / 0.20);
      const outP = p > 0.82 ? (p - 0.82) / 0.18 : 0;
      const alpha = Math.max(0, inP * (1 - outP));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const dx = (s2.x - s1.x), dy = (s2.y - 38) - (s1.y - 42);
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len, ny = dx / len;
      // Slow, hypnotic waves drifting to the target.
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = alpha * (0.32 - i * 0.035);
        ctx.strokeStyle = i % 2 ? '#f0b6bf' : '#c99be8';
        ctx.lineWidth = 3 - i * 0.35;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y - 42 + i * 2);
        const wave = Math.sin(p * 8 + i) * 10;
        ctx.bezierCurveTo(s1.x + dx * 0.33 + nx * (18 + wave), s1.y - 42 + dy * 0.33 + ny * 8, s1.x + dx * 0.66 - nx * (15 - wave), s1.y - 42 + dy * 0.66 - ny * 5, s2.x, s2.y - 38);
        ctx.stroke();
      }
      // Drowsy wrap around enemy.
      for (let i = 0; i < 5; i++) {
        const phase = p * 2.2 + i / 5;
        const a = phase * Math.PI * 2;
        ctx.globalAlpha = alpha * 0.42;
        ctx.strokeStyle = i % 2 ? '#f0b6bf' : '#8e66b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(s2.x, s2.y - 35 + i * 3, 18 + Math.sin(a) * 3, 7 + Math.cos(a) * 1.5, 0, a * 0.4, a * 0.4 + Math.PI * 1.5); ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI * 2 / 8 + p * 1.5;
        this.drawBardGlyph(ctx, s2.x + Math.cos(a) * 20, s2.y - 58 + Math.sin(a) * 7, 0.54, i + 2, i % 2 ? '#f0b6bf' : '#d8b2ff', -0.2 + Math.sin(a) * 0.2, alpha * 0.8);
        if (i % 3 === 0) {
          ctx.globalAlpha = alpha * 0.62;
          ctx.fillStyle = '#f4d1ff';
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.fillText('Z', s2.x + Math.cos(a + 0.6) * 15, s2.y - 68 + Math.sin(a) * 8);
        }
      }
      ctx.restore();
},

drawBardDiscordantNoteEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.05);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const burst = Math.min(1, p / 0.58);
      const fade = Math.max(0, 1 - Math.max(0, p - 0.64) / 0.36);
      const radius = Math.max(32, Number(e.radius || 4) * 17);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // Tense fractured corona.
      ctx.globalAlpha = fade * 0.62;
      for (let i = 0; i < 18; i++) {
        const a = i * Math.PI * 2 / 18 + Math.sin(i) * 0.2;
        const r1 = 12 + burst * radius * (0.35 + (i % 4) * 0.09);
        const r2 = 22 + burst * radius * (0.82 + (i % 3) * 0.08);
        ctx.strokeStyle = i % 3 === 0 ? '#ff7a38' : (i % 3 === 1 ? '#ffd36a' : '#d2462f');
        ctx.lineWidth = i % 4 === 0 ? 4.2 : 2.2;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * r1, s.y - 8 + Math.sin(a) * r1 * 0.38);
        ctx.lineTo(s.x + Math.cos(a + 0.09 * Math.sin(i)) * r2, s.y - 8 + Math.sin(a + 0.09 * Math.cos(i)) * r2 * 0.38);
        ctx.stroke();
      }
      // Shattered music glyphs.
      for (let i = 0; i < 15; i++) {
        const a = i * 2.399 + p * 4.2;
        const r = radius * (0.18 + burst * (0.45 + (i % 5) * 0.09));
        ctx.globalAlpha = fade * 0.55;
        this.drawBardGlyph(ctx, s.x + Math.cos(a) * r, s.y - 8 + Math.sin(a) * r * 0.36, 0.48 + (i % 3) * 0.12, i, i % 2 ? '#d2462f' : '#ffd36a', a + p * 3, 1);
      }
      // Edge shock ring.
      ctx.globalAlpha = fade * 0.38;
      ctx.strokeStyle = '#ffb980';
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 8, 16 + burst * radius, 7 + burst * radius * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      if (p > 0.76) {
        const clean = (p - 0.76) / 0.24;
        this.drawBardGlyph(ctx, s.x, s.y - 70 + clean * 12, 1.1, 0, '#fff3b0', 0, (1 - clean) * 0.9);
      }
      ctx.restore();
},

drawBardRefrainEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s1 = this.worldToScreen(e.x, e.y, (this.tileAt(e.x, e.y)?.elev || 0) + 0.07);
      const s2 = this.worldToScreen(e.x2, e.y2, (this.tileAt(e.x2, e.y2)?.elev || 0) + 0.07);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const fade = Math.sin(Math.min(1, p) * Math.PI);
      const travel = Math.min(1, p / 0.46);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const start = { x: s1.x, y: s1.y - 42 };
      const end = { x: s2.x, y: s2.y - 42 };
      const dx = end.x - start.x, dy = end.y - start.y;
      const mx = start.x + dx * travel;
      const my = start.y + dy * travel - Math.sin(travel * Math.PI) * 18;
      // Seeking ribbon.
      ctx.globalAlpha = 0.42 + fade * 0.28;
      ctx.strokeStyle = '#ffd6a5';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(start.x + dx * 0.22, start.y + dy * 0.22 - 20, start.x + dx * 0.70, start.y + dy * 0.70 + 12, mx, my);
      ctx.stroke();
      ctx.strokeStyle = '#f0b6bf';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const rp = (p * 1.35 + i / 9) % 1;
        const x = start.x + dx * Math.min(rp, travel);
        const y = start.y + dy * Math.min(rp, travel) - Math.sin(rp * Math.PI) * 15;
        this.drawBardGlyph(ctx, x + Math.sin(i + p * 5) * 8, y, 0.44, i, i % 2 ? '#ffd6a5' : '#f0b6bf', i * 0.5, fade * 0.75);
      }
      // Healing embrace around ally.
      const wrapP = Math.max(0, Math.min(1, (p - 0.34) / 0.46));
      if (wrapP > 0) {
        const out = p > 0.82 ? (p - 0.82) / 0.18 : 0;
        const a = Math.max(0, wrapP * (1 - out));
        for (let i = 0; i < 4; i++) {
          const phase = wrapP * Math.PI * 2 + i * Math.PI * 0.5;
          ctx.globalAlpha = a * 0.48;
          ctx.strokeStyle = i % 2 ? '#f0b6bf' : '#ffd6a5';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(end.x, end.y - 1 + i * 3, 18 + i * 3, 8 + i * 2, 0, phase, phase + Math.PI * 1.35); ctx.stroke();
        }
        ctx.globalAlpha = a * 0.30;
        const g = ctx.createRadialGradient(end.x, end.y - 36, 3, end.x, end.y - 36, 34);
        g.addColorStop(0, 'rgba(255,230,178,0.8)');
        g.addColorStop(0.55, 'rgba(240,182,191,0.25)');
        g.addColorStop(1, 'rgba(240,182,191,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(end.x, end.y - 36, 34, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
},


drawNecroBoneDustEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const s = this.worldToScreen(e.x + (e.vx || 0) * e.t * 10, e.y + (e.vy || 0) * e.t * 10, (tile?.elev || 0) + 0.04);
      const fade = Math.max(0, 1 - p);
      ctx.save();
      ctx.globalAlpha = fade * 0.68;
      ctx.fillStyle = e.color || '#d8e5b4';
      ctx.translate(s.x, s.y - 9 - p * 12);
      ctx.rotate((e.size || 2) * 0.4 + p * 2.7);
      ctx.fillRect(-(e.size || 3) * 0.45, -(e.size || 3) * 0.28, e.size || 3, (e.size || 3) * 0.55);
      ctx.restore();
},

drawNecroRaiseBoneServantEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.05);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const pulse = Math.sin(p * Math.PI);
      const cold = 'rgba(209,231,210,';
      const green = 'rgba(63,130,82,';
      ctx.save();

      // Ground rift: jagged split with cold inner glow.
      ctx.globalAlpha = 0.86 * (1 - Math.max(0, p - 0.84) / 0.16);
      ctx.strokeStyle = `rgba(7,8,8,${0.88})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s.x - 31, s.y - 3);
      ctx.lineTo(s.x - 18, s.y - 10);
      ctx.lineTo(s.x - 8, s.y - 4);
      ctx.lineTo(s.x + 5, s.y - 12);
      ctx.lineTo(s.x + 16, s.y - 5);
      ctx.lineTo(s.x + 32, s.y - 9);
      ctx.stroke();
      ctx.strokeStyle = `${cold}${0.54 + pulse * 0.28})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Expanding summoning rings.
      for (let r = 0; r < 3; r++) {
        const rp = Math.max(0, Math.min(1, p * 1.25 - r * 0.18));
        if (rp <= 0) continue;
        ctx.globalAlpha = (1 - rp) * 0.52;
        ctx.strokeStyle = r % 2 ? 'rgba(20,42,26,0.86)' : 'rgba(214,232,213,0.86)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 4, 16 + rp * 46, 6 + rp * 15, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rising bone vortex.
      const count = 22;
      for (let i = 0; i < count; i++) {
        const phase = (i / count + p * 1.85) % 1;
        const height = 10 + phase * 72;
        const ring = 10 + Math.sin(phase * Math.PI) * 22;
        const a = i * 2.399 + p * 9.0;
        const x = s.x + Math.cos(a) * ring;
        const y = s.y - height + Math.sin(a) * ring * 0.23;
        const size = 3 + (i % 5) * 1.2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(0.9, pulse * (1 - Math.max(0, p - 0.82) / 0.18)));
        ctx.translate(x, y);
        ctx.rotate(a + p * 4);
        ctx.fillStyle = i % 4 === 0 ? '#f0f2df' : '#b9c9ad';
        if (i % 7 === 0) {
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.2, size * 0.82, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(28,30,25,0.55)';
          ctx.stroke();
        } else {
          ctx.fillRect(-size * 0.5, -size * 0.18, size * 1.8, size * 0.42);
          ctx.fillRect(size * 0.55, -size * 0.42, size * 0.42, size * 0.84);
        }
        ctx.restore();
      }

      // Binding column and final materialization flash.
      ctx.globalAlpha = 0.28 * pulse;
      const grad = ctx.createLinearGradient(s.x, s.y - 90, s.x, s.y + 8);
      grad.addColorStop(0, 'rgba(210,238,216,0)');
      grad.addColorStop(0.35, 'rgba(137,210,143,0.34)');
      grad.addColorStop(1, 'rgba(10,12,10,0.08)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 35, 24 + pulse * 12, 58, 0, 0, Math.PI * 2);
      ctx.fill();

      if (p > 0.62) {
        const fp = Math.min(1, (p - 0.62) / 0.24);
        ctx.globalAlpha = Math.max(0, (1 - fp) * 0.7);
        ctx.strokeStyle = 'rgba(225,240,220,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 6, 24 + fp * 58, 9 + fp * 21, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
},

drawNecroDrainTendrilEffect(e, enhanced = false) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const sourceTile = this.tileAt(e.x, e.y);
      const targetTile = this.tileAt(e.x2, e.y2);
      const s1 = this.worldToScreen(e.x, e.y, (sourceTile?.elev || 0) + 0.08);
      const s2 = this.worldToScreen(e.x2, e.y2, (targetTile?.elev || 0) + 0.08);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const fade = Math.sin(p * Math.PI);
      const tendrils = enhanced ? 5 : 1;
      ctx.save();

      const castX = s1.x;
      const castY = s1.y - 48;
      const hitX = s2.x;
      const hitY = s2.y - 42;
      const dx = hitX - castX;
      const dy = hitY - castY;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;

      for (let i = 0; i < tendrils; i++) {
        const off = (i - (tendrils - 1) / 2) * (enhanced ? 7 : 0);
        const wobble = Math.sin(p * 12 + i * 1.9) * (enhanced ? 13 : 8);
        const cx = (castX + hitX) * 0.5 + nx * (off + wobble);
        const cy = (castY + hitY) * 0.5 + ny * (off + wobble * 0.32) - 8 * Math.sin(p * Math.PI);
        ctx.globalAlpha = 0.30 * fade;
        ctx.strokeStyle = enhanced ? 'rgba(18, 3, 28, 0.96)' : 'rgba(3, 8, 5, 0.95)';
        ctx.lineWidth = enhanced ? 8 : 6;
        ctx.beginPath();
        ctx.moveTo(castX, castY);
        ctx.quadraticCurveTo(cx, cy, hitX, hitY);
        ctx.stroke();

        ctx.globalAlpha = 0.75 * fade;
        ctx.strokeStyle = enhanced ? 'rgba(91, 31, 128, 0.94)' : 'rgba(72, 134, 80, 0.9)';
        ctx.lineWidth = enhanced ? 2.6 : 2.2;
        ctx.beginPath();
        ctx.moveTo(castX, castY);
        ctx.quadraticCurveTo(cx, cy, hitX, hitY);
        ctx.stroke();

        // Barbed hooks on Soul Leech.
        if (enhanced) {
          ctx.globalAlpha = 0.74 * fade;
          ctx.fillStyle = 'rgba(214,226,206,0.88)';
          for (let h = 0; h < 2; h++) {
            const hp = 0.72 + h * 0.1;
            const bx = castX + dx * hp + nx * (off * 0.35);
            const by = castY + dy * hp + ny * (off * 0.12);
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - nx * 8 - dx / len * 6, by - ny * 8 - dy / len * 6);
            ctx.lineTo(bx + nx * 4 - dx / len * 5, by + ny * 4 - dy / len * 5);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // Life motes travel from target to caster.
      const moteCount = enhanced ? 13 : 7;
      for (let i = 0; i < moteCount; i++) {
        const mp = (p * (enhanced ? 1.9 : 1.55) + i / moteCount) % 1;
        const x = hitX + (castX - hitX) * mp + Math.sin(mp * Math.PI * 2 + i) * (enhanced ? 10 : 5);
        const y = hitY + (castY - hitY) * mp + Math.cos(mp * Math.PI * 2 + i) * 4;
        const size = enhanced ? 4.2 : 3;
        ctx.globalAlpha = fade * (0.55 + 0.45 * Math.sin(mp * Math.PI));
        ctx.fillStyle = i % 3 === 0 ? '#efe5c2' : '#d45a48';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Target torment / caster healing pulse.
      ctx.globalAlpha = 0.42 * fade;
      ctx.strokeStyle = enhanced ? 'rgba(98,31,134,0.95)' : 'rgba(76,130,80,0.92)';
      ctx.lineWidth = enhanced ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(hitX, hitY + 2, enhanced ? 24 : 17, enhanced ? 30 : 22, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.44 * Math.max(0, Math.sin((p * (enhanced ? 5 : 3)) * Math.PI));
      ctx.fillStyle = enhanced ? 'rgba(58,14,86,0.8)' : 'rgba(42,84,54,0.72)';
      ctx.beginPath();
      ctx.ellipse(castX, castY + 18, enhanced ? 26 : 18, enhanced ? 17 : 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
},

drawNecroBoneSpearEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s1 = this.worldToScreen(e.x, e.y, (this.tileAt(e.x, e.y)?.elev || 0) + 0.08);
      const s2 = this.worldToScreen(e.x2, e.y2, (this.tileAt(e.x2, e.y2)?.elev || 0) + 0.08);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const flight = Math.max(0, Math.min(1, (p - 0.18) / 0.62));
      const x = s1.x + (s2.x - s1.x) * flight;
      const y = (s1.y - 44) + ((s2.y - 36) - (s1.y - 44)) * flight - Math.sin(flight * Math.PI) * 18;
      const angle = Math.atan2((s2.y - 36) - (s1.y - 44), s2.x - s1.x) + Math.sin(p * Math.PI * 8) * 0.12;
      ctx.save();

      // Formation fragments around caster.
      if (p < 0.28) {
        const fp = p / 0.28;
        for (let i = 0; i < 10; i++) {
          const a = i * 0.628 + fp * 5;
          const r = 24 * (1 - fp) + 4;
          ctx.save();
          ctx.globalAlpha = 1 - fp * 0.35;
          ctx.translate(s1.x + Math.cos(a) * r, s1.y - 44 + Math.sin(a) * r * 0.55);
          ctx.rotate(a);
          ctx.fillStyle = '#dfe9cd';
          ctx.fillRect(-5, -1, 10, 2.5);
          ctx.restore();
        }
      }

      if (p >= 0.14 && p <= 0.96) {
        // Dust trail.
        for (let i = 0; i < 8; i++) {
          const tp = Math.max(0, flight - i * 0.055);
          const tx = s1.x + (s2.x - s1.x) * tp;
          const ty = (s1.y - 44) + ((s2.y - 36) - (s1.y - 44)) * tp - Math.sin(tp * Math.PI) * 18;
          ctx.globalAlpha = Math.max(0, 0.36 - i * 0.035);
          ctx.fillStyle = i % 2 ? 'rgba(214,227,194,0.72)' : 'rgba(13,17,13,0.58)';
          ctx.beginPath();
          ctx.ellipse(tx, ty + i * 0.6, 4 + i * 0.7, 2.2 + i * 0.35, angle, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bone spear body.
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e9ecd8';
        ctx.strokeStyle = 'rgba(12,13,12,0.86)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.lineTo(9, -5);
        ctx.lineTo(-24, -3);
        ctx.lineTo(-29, 0);
        ctx.lineTo(-24, 3);
        ctx.lineTo(9, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(74,119,73,0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(18, 0);
        ctx.stroke();
        ctx.fillStyle = '#bac6aa';
        ctx.fillRect(-16, -6, 6, 12);
        ctx.fillRect(-2, -5, 5, 10);
      }

      // Impact.
      if (p > 0.72) {
        const ip = Math.min(1, (p - 0.72) / 0.22);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = Math.max(0, 1 - ip);
        ctx.strokeStyle = 'rgba(219,232,207,0.95)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI * 2 / 12;
          ctx.beginPath();
          ctx.moveTo(s2.x, s2.y - 34);
          ctx.lineTo(s2.x + Math.cos(a) * (12 + ip * 22), s2.y - 34 + Math.sin(a) * (7 + ip * 13));
          ctx.stroke();
        }
      }
      ctx.restore();
},

drawNecroRotCloudEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.03);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const inP = Math.min(1, p / 0.22);
      const outP = p > 0.78 ? (p - 0.78) / 0.22 : 0;
      const alpha = Math.max(0, inP * (1 - outP));
      const radius = Math.max(2.2, Number(e.radius || 4.4)) * 13;
      ctx.save();
      for (let i = 0; i < 18; i++) {
        const a = i * 2.399 + p * 1.7;
        const r = radius * (0.18 + ((i * 37) % 100) / 100 * 0.82);
        const x = s.x + Math.cos(a) * r;
        const y = s.y + Math.sin(a) * r * 0.42 - 4 + Math.sin(p * 8 + i) * 3;
        const w = 18 + ((i * 19) % 17) + Math.sin(p * 6 + i) * 4;
        const h = 7 + ((i * 13) % 9);
        ctx.globalAlpha = alpha * (0.18 + (i % 4) * 0.035);
        ctx.fillStyle = i % 3 === 0 ? '#566c28' : (i % 3 === 1 ? '#151910' : '#7b8e3e');
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, Math.sin(i) * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dense core and ground residue.
      ctx.globalAlpha = alpha * 0.30;
      ctx.fillStyle = '#0b0e09';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 3, radius * 0.72, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.max(0, (1 - p) * 0.18);
      ctx.strokeStyle = 'rgba(105,126,47,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 2, radius * (0.68 + p * 0.3), radius * (0.26 + p * 0.08), 0, 0, Math.PI * 2);
      ctx.stroke();
      // Pestilence specks.
      for (let i = 0; i < 22; i++) {
        const a = i * 1.71 + p * 5;
        const r = radius * (0.15 + ((i * 29) % 100) / 100 * 0.78);
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = i % 2 ? '#c2cf71' : '#121512';
        ctx.fillRect(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.38 - 7, 2, 2);
      }
      ctx.restore();
},

drawNecroGraveArmorEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const tile = this.tileAt(e.x, e.y);
      const s = this.worldToScreen(e.x, e.y, (tile?.elev || 0) + 0.08);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const assemble = Math.min(1, p / 0.18);
      const decay = p > 0.84 ? (p - 0.84) / 0.16 : 0;
      const a = Math.max(0, assemble * (1 - decay));
      ctx.save();
      // Active dark aura.
      ctx.globalAlpha = a * (0.20 + 0.08 * Math.sin(e.t * 7));
      ctx.fillStyle = 'rgba(4,6,5,0.9)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 22, 30, 39, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.72;
      ctx.strokeStyle = 'rgba(206,224,194,0.85)';
      ctx.lineWidth = 2;
      // Rib plate chest.
      for (let i = 0; i < 5; i++) {
        const yy = s.y - 45 + i * 7;
        ctx.beginPath();
        ctx.moveTo(s.x - 15 + i * 1.2, yy);
        ctx.quadraticCurveTo(s.x, yy + 7, s.x + 15 - i * 1.2, yy);
        ctx.stroke();
      }
      // Spine/center plate.
      ctx.strokeStyle = 'rgba(120,160,118,0.92)';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 54);
      ctx.lineTo(s.x, s.y - 14);
      ctx.stroke();
      // Shoulder pauldrons / forearm guards.
      ctx.fillStyle = '#d8e5c8';
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(s.x + side * 19, s.y - 45);
        ctx.rotate(side * 0.28);
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(13,15,13,0.8)';
        ctx.stroke();
        ctx.restore();
        ctx.fillRect(s.x + side * 17 - 3, s.y - 31, 6, 17);
      }
      // Orbiting bone fragments.
      for (let i = 0; i < 8; i++) {
        const o = i / 8 * Math.PI * 2 + e.t * 1.4;
        ctx.save();
        ctx.globalAlpha = a * 0.65;
        ctx.translate(s.x + Math.cos(o) * 27, s.y - 36 + Math.sin(o) * 8);
        ctx.rotate(o);
        ctx.fillStyle = i % 2 ? '#e6edd8' : '#83937f';
        ctx.fillRect(-4, -1, 8, 2.4);
        ctx.restore();
      }
      // Binding seams.
      ctx.globalAlpha = a * 0.58;
      ctx.strokeStyle = 'rgba(36,108,60,0.86)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(s.x - 18, s.y - 49 + i * 10);
        ctx.quadraticCurveTo(s.x, s.y - 58 + i * 15 + Math.sin(e.t * 4 + i) * 3, s.x + 18, s.y - 49 + i * 10);
        ctx.stroke();
      }
      ctx.restore();
},



drawAshrootScreen(e, z = 0.04) {
      const tile = this.tileAt?.(e.x, e.y) || { elev: 0 };
      return this.worldToScreen(e.x, e.y, (tile?.elev || 0) + z);
},

drawAshrootCrushEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const impact = Math.max(0, Math.min(1, (p - 0.42) / 0.18));
      const fade = Math.max(0, 1 - Math.max(0, p - 0.70) / 0.30);
      const s = this.drawAshrootScreen(e, 0.06);
      const src = this.worldToScreen(e.x, e.y, (this.tileAt?.(e.x, e.y)?.elev || 0) + 0.08);
      const dx = s.x - src.x;
      const side = dx >= 0 ? 1 : -1;
      const swing = Math.sin(Math.min(1, p / 0.48) * Math.PI);
      ctx.save();

      // Heavy charred limb arc.
      ctx.globalAlpha = 0.95 * (1 - impact * 0.18);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const limbBaseX = s.x - side * (46 - swing * 16);
      const limbBaseY = s.y - 88 + swing * 62;
      const limbTipX = s.x + side * (12 + swing * 8);
      const limbTipY = s.y - 14 + swing * 9;
      ctx.strokeStyle = 'rgba(9,7,5,0.95)';
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(limbBaseX, limbBaseY);
      ctx.quadraticCurveTo(s.x - side * 22, s.y - 58 + swing * 25, limbTipX, limbTipY);
      ctx.stroke();
      ctx.strokeStyle = '#2a1710';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = '#d7672e';
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.42 + 0.18 * Math.sin(e.t * 18);
      ctx.beginPath();
      ctx.moveTo(limbBaseX + side * 2, limbBaseY + 4);
      ctx.quadraticCurveTo(s.x - side * 13, s.y - 48 + swing * 20, limbTipX - side * 3, limbTipY - 2);
      ctx.stroke();

      // Impact fissures and crater.
      if (p > 0.38) {
        ctx.globalAlpha = fade;
        ctx.strokeStyle = 'rgba(15,9,6,0.92)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 3, 28 + impact * 36, 9 + impact * 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,95,38,0.85)';
        ctx.lineWidth = 2.1;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI * 2 / 12 + 0.25;
          const r0 = 10 + (i % 3) * 3;
          const r1 = 27 + impact * (25 + (i % 4) * 5);
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0 * 0.36);
          ctx.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1 * 0.42);
          ctx.stroke();
        }
        for (let i = 0; i < 24; i++) {
          const a = i * 2.399 + p * 4;
          const r = 12 + impact * (20 + (i % 5) * 6);
          ctx.globalAlpha = fade * (0.65 - i * 0.012);
          ctx.fillStyle = i % 3 === 0 ? '#ff8a32' : (i % 3 === 1 ? '#1b120d' : '#6e3b22');
          ctx.fillRect(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.42 - impact * (i % 4), 3 + (i % 3), 2 + (i % 2));
        }
      }
      ctx.restore();
},

drawAshrootAshCloudEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.drawAshrootScreen(e, 0.04);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const inP = Math.min(1, p / 0.18);
      const outP = p > 0.76 ? (p - 0.76) / 0.24 : 0;
      const alpha = Math.max(0, inP * (1 - outP));
      const r = Math.max(1.5, Number(e.radius || 2.2)) * 18;
      ctx.save();
      // Initial ash column.
      if (p < 0.28) {
        const col = 1 - p / 0.28;
        ctx.globalAlpha = col * 0.55;
        ctx.fillStyle = '#25201d';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 36 * (1 - col), 17 + (1 - col) * 12, 38 * col + 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 22; i++) {
        const a = i * 2.399 + p * 1.8;
        const rr = r * (0.20 + ((i * 37) % 100) / 100 * 0.92) * (0.55 + inP * 0.45);
        const x = s.x + Math.cos(a) * rr;
        const y = s.y + Math.sin(a) * rr * 0.42 - 8 + Math.sin(p * 9 + i) * 4;
        const w = 19 + ((i * 11) % 19);
        const h = 7 + ((i * 17) % 12);
        ctx.globalAlpha = alpha * (0.22 + (i % 4) * 0.035);
        ctx.fillStyle = i % 4 === 0 ? '#080706' : i % 4 === 1 ? '#302825' : i % 4 === 2 ? '#5b4a3c' : '#b9572c';
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, Math.sin(i) * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      // Ember eyes/motes inside choking cloud.
      for (let i = 0; i < 18; i++) {
        const a = i * 1.91 + p * 4.2;
        const rr = r * (0.12 + ((i * 29) % 100) / 100 * 0.75);
        ctx.globalAlpha = alpha * (0.45 + 0.25 * Math.sin(p * 18 + i));
        ctx.fillStyle = i % 3 ? '#ff7a2d' : '#d5c28f';
        ctx.fillRect(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr * 0.36 - 12, 2.4, 2.4);
      }
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = '#110d0a';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 2, r * 0.98, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
},

drawAshrootDeathBloomEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.drawAshrootScreen(e, 0.06);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const breach = Math.min(1, p / 0.25);
      const open = Math.max(0, Math.min(1, (p - 0.24) / 0.34));
      const decay = p > 0.72 ? (p - 0.72) / 0.28 : 0;
      const a = Math.max(0, 1 - decay);
      ctx.save();
      ctx.globalAlpha = a;
      // Fissure.
      ctx.strokeStyle = '#0a0705';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x - 29 * breach, s.y - 2);
      ctx.lineTo(s.x - 11, s.y - 8);
      ctx.lineTo(s.x + 3, s.y - 3);
      ctx.lineTo(s.x + 18 * breach, s.y - 10);
      ctx.lineTo(s.x + 31 * breach, s.y - 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(174,231,92,0.78)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Stem/core.
      const stemH = 44 * breach;
      ctx.strokeStyle = '#1c120e';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 2); ctx.quadraticCurveTo(s.x - 7, s.y - stemH * 0.55, s.x, s.y - stemH); ctx.stroke();
      ctx.strokeStyle = '#6f2d1b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = a * (0.30 + open * 0.42);
      ctx.fillStyle = '#baff6b';
      ctx.beginPath(); ctx.ellipse(s.x, s.y - stemH - 2, 12 + open * 10, 14 + open * 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Charred petals.
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI * 2 / 8 + Math.sin(i) * 0.08;
        const spread = open * (20 + (i % 3) * 5);
        ctx.save();
        ctx.translate(s.x + Math.cos(ang) * spread * 0.35, s.y - stemH - 2 + Math.sin(ang) * spread * 0.18);
        ctx.rotate(ang + open * 0.7);
        ctx.globalAlpha = a * (0.35 + open * 0.65);
        ctx.fillStyle = i % 2 ? '#25140e' : '#3b2116';
        ctx.strokeStyle = '#0b0705';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(open * 12, 0, 5 + open * 12, 3 + open * 6, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,99,39,0.45)';
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(open * 20, 0); ctx.stroke();
        ctx.restore();
      }

      // Spore wave.
      if (p > 0.42) {
        const sp = Math.min(1, (p - 0.42) / 0.34);
        ctx.globalAlpha = Math.max(0, (1 - sp) * 0.82);
        ctx.strokeStyle = 'rgba(178,236,101,0.82)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 2, 14 + sp * 58, 5 + sp * 24, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c8ff79';
        for (let i = 0; i < 24; i++) {
          const aa = i * 2.399 + sp * 2;
          const rr = 10 + sp * (22 + (i % 7) * 6);
          ctx.fillRect(s.x + Math.cos(aa) * rr, s.y + Math.sin(aa) * rr * 0.42 - 8 - sp * (i % 5), 2, 2);
        }
      }
      ctx.restore();
},

// V0.17.25 root-cause fix: this single function used to draw the ground
// decal AND the ankle-wrapping tendrils in one pass, and the caller queued
// the whole thing at a depth bias below the entangled entity's own sprite
// (game.js's world-renderable queue), so the tendrils - the actual "you are
// rooted" read - were always fully hidden behind the character model. The
// queue now pushes this same effect twice with two different depth biases;
// `layer` tells this function which half to draw for that pass. `layer` is
// only omitted by legacy/defensive direct callers, in which case both
// halves draw together (the pre-fix behavior) rather than silently drawing
// nothing.
drawRotlingRootEntangleEffect(e, layer) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const drawBase = layer !== 'wrap';
      const drawWrap = layer !== 'base';
      const target = e.targetId != null && this.findSpellActorById
        ? this.findSpellActorById(e.targetId)
        : (this.entities || []).find(actor => String(actor?.id ?? '') === String(e.targetId ?? ''));
      // V0.18.36: humanoids (players/bots/mercs/NPCs) draw their feet ~38px below
      // the body origin that _rootVfxFootAnchor is derived from, so that anchor sits
      // at the hips. The humanoid renderer publishes the true rendered foot line via
      // _lastGroundAnchor.groundY - prefer it so the snare roots wrap the feet, not
      // the waist. Mobs have no _lastGroundAnchor and keep using _rootVfxFootAnchor,
      // which already sits at their feet.
      const groundLine = target?._lastGroundAnchor;
      const anchored = (groundLine && Number.isFinite(Number(groundLine.groundY)))
        ? { x: Number(groundLine.x ?? target?._rootVfxFootAnchor?.x ?? target?.screenX ?? 0), y: Number(groundLine.groundY) }
        : (target?._rootVfxFootAnchor || target?._groundContactAnchor || target?._spriteFootAnchor || null);
      const projected = this.vfxScreen(e.x, e.y, -0.02);
      const s = anchored && Number.isFinite(Number(anchored.x)) && Number.isFinite(Number(anchored.y))
        ? { x: Number(anchored.x), y: Number(anchored.y) }
        : projected;
      const statusDuration = Math.max(0.2, Number(e.statusDuration || e.life || 1));
      const remaining = Math.max(0, Number(e.statusRemaining ?? Math.max(0, statusDuration - Number(e.t || 0))));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / Math.max(0.001, Number(e.life || statusDuration))));
      const grow = Math.min(1, Number(e.t || 0) / 0.34);
      const release = e.releasing || remaining <= 0.18 || p > 0.92;
      const releaseFade = release ? Math.max(0, Math.min(1, remaining / 0.18)) : 1;
      const lifeFade = Math.max(0, Math.min(1, (Number(e.life || 0) - Number(e.t || 0)) / 0.22));
      const alpha = Math.max(0, Math.min(1, grow * Math.min(releaseFade, lifeFade || 1)));
      if (alpha <= 0.02) return;
      const seed = Number(e.seed || 1);
      const pulse = 0.5 + Math.sin(Number(e.t || 0) * 8.0 + seed * 0.07) * 0.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Soil compression at the immobilized target's feet. The anchor is the
      // rendered foot/base point; this stays a ground decal below the target.
      const groundY = s.y + 4;
      if (drawBase) {
        ctx.fillStyle = 'rgba(12, 8, 4, 0.50)';
        ctx.beginPath();
        ctx.ellipse(s.x, groundY + 2, 29 + pulse * 2, 8.8 + pulse * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(130, 190, 88, ${0.24 + pulse * 0.16})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(s.x, groundY, 26 + pulse * 4, 7.6 + pulse * 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (drawWrap) {
        // Ankle/lower-leg wrapping tendrils. Queued at a depth bias above the
        // entangled entity's sprite (see game.js) so this half always renders
        // in front of the lower legs/feet instead of being hidden behind them.
        // Grown taller and brighter than the original single-pass version so
        // the "you are rooted" read stays clear during active combat VFX.
        for (let i = 0; i < 9; i++) {
          const lane = i - 4;
          const laneAbs = Math.abs(lane);
          const localGrow = Math.max(0, Math.min(1, grow - laneAbs * 0.025));
          const baseX = s.x + lane * 6.4;
          const baseY = groundY + laneAbs * 0.42;
          const wrapPhase = Number(e.t || 0) * 2.4 + seed * 0.01 + i * 1.17;
          const topX = s.x + lane * (2.2 + Math.sin(wrapPhase) * 1.2);
          const topY = groundY - (5 + (i % 3) * 2.2 + pulse * 1.2);
          const midX = s.x + lane * (9.2 + Math.cos(wrapPhase) * 1.8);
          const midY = groundY - (1 + localGrow * 5.5);
          ctx.strokeStyle = 'rgba(15, 8, 3, 0.92)';
          ctx.lineWidth = Math.max(2.4, 6.4 - laneAbs * 0.62);
          ctx.beginPath();
          ctx.moveTo(baseX, baseY);
          ctx.quadraticCurveTo(midX, midY, topX, baseY + (topY - baseY) * localGrow);
          ctx.stroke();
          ctx.strokeStyle = i % 2 ? '#653a19' : '#472a14';
          ctx.lineWidth = Math.max(1.6, 3.7 - laneAbs * 0.30);
          ctx.stroke();
          ctx.strokeStyle = `rgba(170, 235, 110, ${0.32 + pulse * 0.32})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }

        // Small sickly motes make the active snare state readable without replacing the debuff UI.
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 14; i++) {
          const a = i * 2.399 + Number(e.t || 0) * 1.35;
          const r = 7 + (i % 5) * 4 + pulse * 2;
          const sparkleAlpha = alpha * (0.20 + (i % 3) * 0.06);
          ctx.globalAlpha = sparkleAlpha;
          ctx.fillStyle = i % 2 ? '#9edb6d' : '#6fba52';
          ctx.fillRect(s.x + Math.cos(a) * r, groundY - 6 + Math.sin(a) * r * 0.3, 2.2, 2.2);
        }
      }
      ctx.restore();
},

// V0.18.38: Silk Web Cavern atmosphere VFX.
drawSilkEggBurstEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.02);
      const life = Math.max(0.001, Number(e.life || 0.6));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const seed = Number(e.seed || 1);
      const shell = e.color || '#ece2cd';
      ctx.save();
      ctx.lineCap = 'round';
      // expanding silk puff
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle = 'rgba(236,226,205,0.5)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, 6 + p * 26, (6 + p * 26) * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // snapping silk strands
      ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = shell; ctx.lineWidth = 1.1;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + seed * 0.1, r = 8 + p * 22;
        ctx.beginPath(); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x + Math.cos(a) * r, s.y - 6 + Math.sin(a) * r * 0.6); ctx.stroke();
      }
      // shell shards flung out then falling under gravity
      ctx.globalAlpha = 1 - p * 0.7; ctx.fillStyle = shell; ctx.strokeStyle = 'rgba(120,108,80,0.7)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + seed * 0.07;
        const dist = p * (14 + (i % 3) * 5);
        const fx = s.x + Math.cos(a) * dist;
        const fy = s.y - 6 + Math.sin(a) * dist * 0.55 + p * p * 18;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(a + p * 4);
        ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 2.0, 0, 0.3, Math.PI + 0.5); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
},

drawTinySpiderSilhouette(bx, by, scale, t, color = '#241d2e') {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx) return;
      const bob = Math.sin((t || 0) * 20) * 1.0 * scale;
      const y = by + bob;
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.0 * scale; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const off = (i - 1.5);
        const kx = 5 + Math.abs(off) * 1.1, kd = off * 1.5 - 2;
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx - kx * scale, y + kd * scale); ctx.lineTo(bx - (kx + 3) * scale, y + (off * 1.5 + 3) * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + kx * scale, y + kd * scale); ctx.lineTo(bx + (kx + 3) * scale, y + (off * 1.5 + 3) * scale); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(bx, y, 3.0 * scale, 3.6 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx, y - 3 * scale, 2.0 * scale, 1.8 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

drawSilkDropEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const ground = this.vfxScreen(e.x, e.y, 0.02);
      const life = Math.max(0.001, Number(e.life || 1));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const dropH = Number(e.dropHeight || 160);
      const topY = ground.y - dropH;
      const descend = Math.min(1, p / 0.72);
      const sy = topY + (ground.y - 5 - topY) * descend;
      ctx.save();
      // silk thread from the ceiling down to the spider (fades as it settles)
      ctx.globalAlpha = p > 0.85 ? Math.max(0, (1 - p) / 0.15) * 0.85 : 0.85;
      ctx.strokeStyle = 'rgba(224,214,240,0.9)'; ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.moveTo(ground.x, topY); ctx.lineTo(ground.x, sy); ctx.stroke();
      this.drawTinySpiderSilhouette(ground.x, sy, 1.05, Number(e.t || 0));
      ctx.restore();
},

drawSilkSkeletonFallEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const ground = this.vfxScreen(e.x, e.y, 0.02);
      const life = Math.max(0.001, Number(e.life || 0.9));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const fall = Math.min(1, p / 0.55);
      const collapse = Math.max(0, (p - 0.55) / 0.45);
      const bodyY = ground.y - 30 * (1 - fall);
      const fade = p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1;
      ctx.save();
      // silk shreds bursting from the broken cocoon
      ctx.globalAlpha = (1 - fall) * 0.6; ctx.strokeStyle = 'rgba(224,214,240,0.8)'; ctx.lineWidth = 1.0; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(ground.x, ground.y - 24); ctx.lineTo(ground.x + Math.cos(a) * (10 + fall * 10), ground.y - 24 + Math.sin(a) * 8); ctx.stroke(); }
      // skeleton: falls, then collapses onto the floor
      ctx.globalAlpha = fade;
      ctx.translate(ground.x, bodyY);
      ctx.rotate(collapse * 1.35);
      ctx.translate(0, collapse * 10);
      const bone = '#e6e0cf', boneShade = 'rgba(90,84,66,0.7)';
      ctx.strokeStyle = boneShade; ctx.fillStyle = bone; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      // spine
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 6); ctx.stroke();
      // ribs
      for (let i = 0; i < 3; i++) { const ry = -10 + i * 4; ctx.beginPath(); ctx.moveTo(0, ry); ctx.quadraticCurveTo(-7, ry + 1, -5, ry + 4); ctx.moveTo(0, ry); ctx.quadraticCurveTo(7, ry + 1, 5, ry + 4); ctx.stroke(); }
      // arms + legs
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-9, -3); ctx.moveTo(0, -9); ctx.lineTo(9, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-6, 15); ctx.moveTo(0, 6); ctx.lineTo(6, 15); ctx.stroke();
      // skull
      ctx.beginPath(); ctx.arc(0, -17, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(20,16,24,0.85)';
      ctx.beginPath(); ctx.arc(-1.6, -17.5, 1.1, 0, Math.PI * 2); ctx.arc(1.6, -17.5, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
},

// V0.18.42: boss/miniboss attack telegraph - a red danger zone on the ground that fills
// as the strike approaches, so the AoE can be dodged.
drawBossGroundTelegraphEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.02);
      const life = Math.max(0.001, Number(e.life || 0.9));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const R = Math.max(6, Number(e.radius || 4) * 5.8);
      const col = e.color || '#ff5a4f';
      const t = Number(e.t || 0);
      const pulse = 0.5 + Math.sin(t * 14) * 0.5;
      ctx.save();
      // interior fills up like a fuse as the strike nears
      ctx.globalAlpha = 0.12 + p * 0.26;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, R * p, R * 0.5 * p, 0, 0, Math.PI * 2); ctx.fill();
      // full-size boundary ring (shows the whole danger zone from the start)
      ctx.globalAlpha = 0.6 + pulse * 0.3;
      ctx.strokeStyle = col; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, R, R * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, R * 0.62, R * 0.31, 0, 0, Math.PI * 2); ctx.stroke();
      // radial hazard ticks
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * R * 0.84, s.y + Math.sin(a) * R * 0.5 * 0.84);
        ctx.lineTo(s.x + Math.cos(a) * R, s.y + Math.sin(a) * R * 0.5);
        ctx.stroke();
      }
      ctx.restore();
},

drawBossStrikeHitEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.02);
      const life = Math.max(0.001, Number(e.life || 0.4));
      const p = Math.max(0, Math.min(1, Number(e.t || 0) / life));
      const R = Math.max(6, Number(e.radius || 4) * 5.8);
      const col = e.color || '#ff5a4f';
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, R * (0.7 + p * 0.4), R * 0.5 * (0.7 + p * 0.4), 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, R * (0.8 + p * 0.6), R * 0.5 * (0.8 + p * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
},

// V0.18.42: a spider scuttling to seal the boss-room entrance (dragging a silk line).
drawSilkSealCrawlerEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.vfxScreen(e.x, e.y, 0.02);
      const dir = Number(e.dir || 0);
      const walkT = performance.now() * 0.008 + Number(e.seed || 0);
      ctx.save();
      // trailing silk thread behind the crawler
      ctx.globalAlpha = 0.4; ctx.strokeStyle = 'rgba(224,214,240,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x - Math.cos(dir) * 15, s.y - 4 - Math.sin(dir) * 9); ctx.stroke();
      ctx.globalAlpha = 1;
      this.drawTinySpiderSilhouette(s.x, s.y - 4, 1.75, walkT, '#2a2233');
      ctx.restore();
},

drawAshrootCinderrootSnareEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.drawAshrootScreen(e, 0.06);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const grow = Math.min(1, p / 0.22);
      const crumble = p > 0.82 ? (p - 0.82) / 0.18 : 0;
      const a = Math.max(0, 1 - crumble);
      const pulse = 0.5 + Math.sin(e.t * 8.5) * 0.5;
      ctx.save();
      ctx.globalAlpha = a;
      // Ground warning cracks.
      ctx.strokeStyle = 'rgba(255,92,31,0.68)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 1, 24 + pulse * 4, 8 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 5; i++) {
        const side = i - 2;
        const baseX = s.x + side * 8;
        const baseY = s.y + 2 + Math.abs(side) * 1.2;
        const topX = s.x + side * (4 + Math.sin(e.t * 3 + i) * 1.8);
        const topY = s.y - 34 - (i % 2) * 8;
        ctx.strokeStyle = '#0b0705';
        ctx.lineWidth = 8 - Math.abs(side);
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(s.x + side * 10, s.y - 16 * grow, topX, baseY + (topY - baseY) * grow);
        ctx.stroke();
        ctx.strokeStyle = '#3c1d12';
        ctx.lineWidth = 5 - Math.abs(side) * 0.45;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,93,32,${0.35 + pulse * 0.38})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // Tick embers around lower body.
      for (let i = 0; i < 14; i++) {
        const aa = i * Math.PI * 2 / 14 + e.t * 1.5;
        ctx.globalAlpha = a * (0.35 + pulse * 0.4);
        ctx.fillStyle = i % 2 ? '#f15c24' : '#9bdc65';
        ctx.fillRect(s.x + Math.cos(aa) * 20, s.y - 16 + Math.sin(aa) * 12, 2.4, 2.4);
      }
      if (crumble > 0) {
        ctx.globalAlpha = crumble * 0.7;
        ctx.fillStyle = '#191310';
        for (let i = 0; i < 12; i++) ctx.fillRect(s.x - 24 + i * 4, s.y - 3 + Math.sin(i) * 3, 3, 2);
      }
      ctx.restore();
},

drawAshrootBlightwoodPulseEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.drawAshrootScreen(e, 0.04);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const ring = Math.min(1, p / 0.34);
      const fade = Math.max(0, 1 - Math.max(0, p - 0.72) / 0.28);
      const r = Math.max(2.0, Number(e.radius || 3.0)) * 22;
      ctx.save();
      // Core drain.
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = (1 - ring) * 0.44;
      ctx.fillStyle = '#b7e86d';
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 38, 22 + (1-ring) * 14, 34 + (1-ring) * 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Expanding pulse rings.
      for (let k = 0; k < 3; k++) {
        const rp = Math.max(0, Math.min(1, ring - k * 0.12));
        if (rp <= 0) continue;
        ctx.globalAlpha = fade * (1 - rp) * 0.85;
        ctx.strokeStyle = k % 2 ? 'rgba(212,89,39,0.88)' : 'rgba(157,221,92,0.82)';
        ctx.lineWidth = 3.2 - k * 0.45;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 1, 18 + rp * r, 7 + rp * r * 0.43, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Darkened blight field and rootlets.
      ctx.globalAlpha = fade * 0.22;
      ctx.fillStyle = '#11130c';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 0.84, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 24; i++) {
        const aa = i * 2.399;
        const rr = r * (0.12 + ((i * 31) % 100) / 100 * 0.70);
        const x = s.x + Math.cos(aa) * rr;
        const y = s.y + Math.sin(aa) * rr * 0.38;
        const sprout = Math.max(0, Math.sin(e.t * 4.8 + i));
        ctx.globalAlpha = fade * (0.18 + sprout * 0.42);
        ctx.strokeStyle = sprout > 0.5 ? '#9bdc65' : '#25130d';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(aa + 1.1) * 4, y - 7 * sprout);
        ctx.stroke();
      }
      ctx.restore();
},

drawAshrootAshenRegrowthEffect(e) {
      const DR = window.DreamRealms;
      const { ctx } = DR.runtime || {};
      if (!ctx || !e) return;
      const s = this.drawAshrootScreen(e, 0.08);
      const p = Math.max(0, Math.min(1, e.t / Math.max(0.001, e.life)));
      const inP = Math.min(1, p / 0.22);
      const outP = p > 0.86 ? (p - 0.86) / 0.14 : 0;
      const a = Math.max(0, inP * (1 - outP));
      const pulse = 0.5 + Math.sin(e.t * 5.8) * 0.5;
      ctx.save();
      // Inward ash/ember draw from ground.
      for (let i = 0; i < 28; i++) {
        const phase = (p * 1.65 + i / 28) % 1;
        const aa = i * 2.399;
        const rr = 68 * (1 - phase);
        ctx.globalAlpha = a * (0.24 + pulse * 0.22);
        ctx.fillStyle = i % 4 === 0 ? '#ff8a32' : i % 4 === 1 ? '#c9d897' : '#2c211c';
        ctx.fillRect(s.x + Math.cos(aa) * rr, s.y + Math.sin(aa) * rr * 0.42 - phase * 20, 2.6, 2.6);
      }

      // Body surge and armor shell.
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = a * (0.26 + pulse * 0.38);
      ctx.fillStyle = '#ff7a2d';
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 45, 28 + pulse * 8, 48 + pulse * 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#aee777';
      ctx.globalAlpha = a * 0.20;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 44, 18, 37, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Bark sealing plates.
      ctx.globalAlpha = a * 0.72;
      ctx.strokeStyle = '#d8d3b0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = s.y - 68 + i * 10;
        ctx.beginPath();
        ctx.moveTo(s.x - 18 + (i % 2) * 5, y);
        ctx.quadraticCurveTo(s.x, y + 5 + pulse * 2, s.x + 18 - (i % 2) * 5, y + 1);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,111,39,0.80)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(s.x - 10 + i * 5, s.y - 77);
        ctx.lineTo(s.x - 7 + i * 4, s.y - 22);
        ctx.stroke();
      }

      // Protective ground shell.
      ctx.globalAlpha = a * 0.45;
      ctx.strokeStyle = 'rgba(214,214,190,0.88)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 2, 36 + pulse * 5, 13 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
},


drawDamage(d) {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  const s = this.worldToScreen(d.x, d.y, this.tileAt(d.x, d.y).elev);
  ctx.globalAlpha = 1 - d.t / d.life;
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(d.text, s.x + 1, s.y - 35 + 1);
  ctx.fillStyle = d.color;
  ctx.fillText(d.text, s.x, s.y - 35);
  ctx.globalAlpha = 1;
},

drawDepthFog(px, py) {
      // V0.14.26: disabled legacy screen-space depth fog. It rendered drifting translucent ovals
      // after the world pass, so the shapes followed the camera instead of belonging to terrain.
      return;
},

drawVignette() {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  const light = this.getWorldLightState?.() || {};
  const outer = Math.max(0.34, Math.min(0.74, Number(light.vignetteAlpha) || 0.46));
  const mid = Math.max(0.10, Math.min(0.34, outer * 0.28));
  const grad = ctx.createRadialGradient(
    window.innerWidth / 2, window.innerHeight / 2, Math.min(window.innerWidth, window.innerHeight) * 0.28,
    window.innerWidth / 2, window.innerHeight / 2, Math.max(window.innerWidth, window.innerHeight) * 0.78
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.72, `rgba(0,0,0,${mid.toFixed(3)})`);
  grad.addColorStop(1, `rgba(0,0,0,${outer.toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

}
      });
    }
  };
})();
