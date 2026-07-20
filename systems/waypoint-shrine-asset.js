// Blackroot authored waypoint shrine (Art Direction Phase 2 - the vertical slice).
//
// V0.21.2: the spec's Phase 2 is "build one fully authored Dark Woods waypoint ... render shrine,
// runes, beam, flames, particles, shadow ... verify it reads correctly in-world", and it is explicit
// that the waypoint "must be rendered as one authored shrine asset, not a small procedural circle
// with generic glow".
//
// HOW THIS IS "AUTHORED" WITHOUT A PNG FROM AN ARTIST. The shrine is drawn ONCE at high detail into
// an offscreen canvas, then registered through the authored-atlas pipeline built in V0.20.97 with
// real anchor / occlusionHeight / contactShadow / emissive / light metadata. That is exactly how
// pre-rendered 2.5D assets work - a source is rendered down to a sprite - and it means the runtime
// path is the AUTHORED path, not procedural per-frame drawing. When a hand-painted PNG eventually
// replaces the bake, only the page source changes; every consumer already reads it as an atlas frame.
// It also gives the Phase 10 pipeline its first real asset, which is the only way to find out whether
// that pipeline actually works.
//
// WHAT IS BAKED vs WHAT STAYS LIVE - this follows the spec's own module separation:
//   BAKED (static, object-renderer): raised circular platform, weathered masonry, rim blocks,
//     concentric rune rings, ritual pillars, ruined backplate. Plus a matching EMISSIVE page.
//   LIVE (animated, effects-renderer): cold blue flames, bright centre core, vertical beam, drifting
//     particles. These must move, so baking them would freeze the thing that sells the effect.
//
// The bake is DETERMINISTIC (seeded), so the same build always produces the same asset.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.21.4 SIZE CORRECTION. The first pass used a 320px frame with a 132px platform radius and I
  // reported it as "1.93 tiles wide" - which measured the PLATFORM ONLY and ignored that the backplate
  // pylons rose 150px above it and the pillars another 74px. In world the whole silhouette stood three
  // to four times character height and swallowed the camp; the user's words were "you broke the
  // waypoint big time", and they were right. Measuring one part of an asset and reporting it as the
  // asset's size is the mistake to avoid repeating.
  //
  // Now a 208px frame with a 76px platform radius - about 1.1 tiles across the platform and roughly
  // one and a half character heights overall, so it reads as a landmark you walk up to rather than
  // architecture you walk under.
  const FRAME = 208;
  const ANCHOR_X = FRAME / 2;
  const ANCHOR_Y = 174;          // FOOT: where the platform meets the ground
  const PLATFORM_RX = 76;
  const ISO = 0.5;               // TILE_H / TILE_W - the platform is a circle in world space
  const PLATFORM_RY = PLATFORM_RX * ISO;
  const WALL_H = 16;             // visible thickness of the raised platform

  // Deterministic noise so every bake is identical.
  function rnd(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function shade(hex, amt) {
    const n = parseInt(String(hex).slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map(v => Math.max(0, Math.min(255, Math.round(v + amt))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  const STONE = '#6b6a63';
  const STONE_DARK = '#43423d';
  const RUNE = '#b8d3ff';

  // ---------------------------------------------------------------------------------------------
  // COLOUR PAGE
  // ---------------------------------------------------------------------------------------------
  function bakeColour(ctx, R) {
    const cx = ANCHOR_X, cy = ANCHOR_Y;

    // --- ruined backplate arch, behind everything: gives the shrine world presence rather than
    // leaving it a disc on open ground. Spec lists this as optional; without it the silhouette reads
    // as a platform, not architecture.
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const bx = cx + side * 58, by = cy - 84;
      ctx.fillStyle = shade(STONE_DARK, -6);
      ctx.beginPath();
      ctx.moveTo(bx - 9, by + 84);
      ctx.lineTo(bx - 7, by + 5);
      ctx.lineTo(bx + 7, by);
      ctx.lineTo(bx + 9, by + 84);
      ctx.closePath();
      ctx.fill();
      // broken masonry courses on the pylon
      for (let c = 0; c < 9; c++) {
        const t = c / 9, yy = by + 6 + t * 78;
        ctx.strokeStyle = `rgba(0,0,0,${0.20 + R() * 0.12})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(bx - 8 + R() * 2, yy); ctx.lineTo(bx + 8 - R() * 2, yy); ctx.stroke();
      }
      // crumbled top edge
      ctx.fillStyle = shade(STONE_DARK, 8);
      for (let c = 0; c < 5; c++) {
        ctx.fillRect(bx - 7 + c * 3, by - 2 + R() * 3, 3 + R() * 2, 2 + R() * 2);
      }
    }
    ctx.restore();

    // --- platform side wall (the raised edge). Drawn before the top so the top caps it.
    const wallGrad = ctx.createLinearGradient(0, cy - PLATFORM_RY, 0, cy + PLATFORM_RY + WALL_H);
    wallGrad.addColorStop(0, shade(STONE, -34));
    wallGrad.addColorStop(0.55, shade(STONE, -52));
    wallGrad.addColorStop(1, shade(STONE, -74));
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, PLATFORM_RX, PLATFORM_RY, 0, 0, Math.PI);
    ctx.lineTo(cx - PLATFORM_RX, cy);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.rect(cx - PLATFORM_RX, cy - 1, PLATFORM_RX * 2, WALL_H);
    ctx.save(); ctx.clip();
    ctx.fillStyle = wallGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy + WALL_H, PLATFORM_RX, PLATFORM_RY, 0, 0, Math.PI); ctx.fill();
    ctx.fillRect(cx - PLATFORM_RX, cy, PLATFORM_RX * 2, WALL_H);
    ctx.restore();

    // --- masonry blocks around the side wall: this is the "weathered masonry" requirement, and the
    // single biggest reason the old version read as a disc. 26 blocks with individual tone,
    // mortar gaps and chipped corners.
    const BLOCKS = 26;
    for (let i = 0; i < BLOCKS; i++) {
      const a0 = (i / BLOCKS) * Math.PI, a1 = ((i + 1) / BLOCKS) * Math.PI;
      const x0 = cx + Math.cos(a0) * PLATFORM_RX, y0 = cy + Math.sin(a0) * PLATFORM_RY;
      const x1 = cx + Math.cos(a1) * PLATFORM_RX, y1 = cy + Math.sin(a1) * PLATFORM_RY;
      const tone = -46 + (R() * 26 - 13);
      ctx.fillStyle = shade(STONE, tone);
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1 + WALL_H); ctx.lineTo(x0, y0 + WALL_H);
      ctx.closePath(); ctx.fill();
      // mortar joint
      ctx.strokeStyle = 'rgba(0,0,0,0.34)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + WALL_H); ctx.stroke();
      // chipped corner / wear
      if (R() > 0.62) {
        ctx.fillStyle = `rgba(0,0,0,${0.16 + R() * 0.14})`;
        ctx.fillRect(x0 + R() * 4, y0 + WALL_H - 5 - R() * 4, 3 + R() * 4, 3 + R() * 3);
      }
    }

    // --- platform top surface
    const topGrad = ctx.createRadialGradient(cx, cy - 8, 6, cx, cy, PLATFORM_RX);
    topGrad.addColorStop(0, shade(STONE, 16));
    topGrad.addColorStop(0.62, shade(STONE, -4));
    topGrad.addColorStop(1, shade(STONE, -26));
    ctx.fillStyle = topGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy, PLATFORM_RX, PLATFORM_RY, 0, 0, Math.PI * 2); ctx.fill();

    // --- radial paving slabs on the top: 20 wedges, each individually toned, with joints. This is
    // what stops the top reading as flat colour, which the spec bans outright for terrain and which
    // applies just as much to a landmark's surface.
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, PLATFORM_RX, PLATFORM_RY, 0, 0, Math.PI * 2); ctx.clip();
    const WEDGES = 20;
    for (let i = 0; i < WEDGES; i++) {
      const a0 = (i / WEDGES) * Math.PI * 2, a1 = ((i + 1) / WEDGES) * Math.PI * 2;
      ctx.fillStyle = `rgba(${R() > 0.5 ? 255 : 0},${R() > 0.5 ? 255 : 0},${R() > 0.5 ? 255 : 0},${0.02 + R() * 0.035})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * PLATFORM_RX, cy + Math.sin(a0) * PLATFORM_RY);
      ctx.lineTo(cx + Math.cos(a1) * PLATFORM_RX, cy + Math.sin(a1) * PLATFORM_RY);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * PLATFORM_RX, cy + Math.sin(a0) * PLATFORM_RY); ctx.stroke();
    }
    // concentric joint rings
    for (const f of [0.38, 0.66, 0.88]) {
      ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, PLATFORM_RX * f, PLATFORM_RY * f, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // surface grime, cracks and moss so the stone reads aged rather than new
    for (let i = 0; i < 90; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.96;
      const x = cx + Math.cos(a) * PLATFORM_RX * r, y = cy + Math.sin(a) * PLATFORM_RY * r;
      const moss = R() > 0.72;
      ctx.fillStyle = moss ? `rgba(74,92,58,${0.10 + R() * 0.16})` : `rgba(0,0,0,${0.06 + R() * 0.12})`;
      ctx.beginPath(); ctx.ellipse(x, y, 1.5 + R() * 5, 1 + R() * 2.4, R() * 3, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const a = R() * Math.PI * 2, r = 0.25 + R() * 0.68;
      let x = cx + Math.cos(a) * PLATFORM_RX * r, y = cy + Math.sin(a) * PLATFORM_RY * r;
      ctx.strokeStyle = `rgba(0,0,0,${0.16 + R() * 0.16})`; ctx.lineWidth = 0.8 + R();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 20; y += (R() - 0.5) * 9; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();

    // --- ritual pillars. Spec asks for 2-4; four reads as deliberate architecture and frames the
    // beam from every one of the four camera headings.
    const PILL = 4;
    for (let i = 0; i < PILL; i++) {
      const a = (i / PILL) * Math.PI * 2 + Math.PI / 4;
      const bx = cx + Math.cos(a) * PLATFORM_RX * 0.78;
      const by = cy + Math.sin(a) * PLATFORM_RY * 0.78;
      const h = 44, w = 9;
      // base plinth
      ctx.fillStyle = shade(STONE, -30);
      ctx.beginPath(); ctx.ellipse(bx, by, w * 1.5, w * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      // shaft, lit from the centre so all four read as lit by the core
      const lit = Math.cos(a) > 0 ? 1 : -1;
      const g2 = ctx.createLinearGradient(bx - w, 0, bx + w, 0);
      g2.addColorStop(0, shade(STONE, lit > 0 ? -34 : -6));
      g2.addColorStop(0.5, shade(STONE, 8));
      g2.addColorStop(1, shade(STONE, lit > 0 ? -6 : -34));
      ctx.fillStyle = g2;
      ctx.fillRect(bx - w, by - h, w * 2, h);
      // masonry courses
      for (let c = 1; c < 7; c++) {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx - w, by - h + (h / 7) * c); ctx.lineTo(bx + w, by - h + (h / 7) * c); ctx.stroke();
      }
      // weathering
      for (let c = 0; c < 7; c++) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.12})`;
        ctx.fillRect(bx - w + R() * w * 2, by - h + R() * h, 2 + R() * 4, 1 + R() * 3);
      }
      // capital
      ctx.fillStyle = shade(STONE, 2);
      ctx.beginPath(); ctx.ellipse(bx, by - h, w * 1.25, w * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(STONE, -22);
      ctx.fillRect(bx - w * 1.25, by - h, w * 2.5, 5);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // EMISSIVE PAGE - runes only, on black. Composited additively by the renderer.
  // ---------------------------------------------------------------------------------------------
  function bakeEmissive(ctx, R) {
    const cx = ANCHOR_X, cy = ANCHOR_Y;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, PLATFORM_RX, PLATFORM_RY, 0, 0, Math.PI * 2); ctx.clip();

    // Two concentric rune rings, per spec. Segmented rather than continuous so they read as carved
    // glyphs catching light, not a drawn circle.
    for (const [rf, seg, lw] of [[0.82, 30, 3.2], [0.54, 20, 2.6]]) {
      for (let i = 0; i < seg; i++) {
        if (i % 3 === 0) continue;                       // gaps = glyph spacing
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 0.62) / seg) * Math.PI * 2;
        ctx.strokeStyle = RUNE;
        ctx.globalAlpha = 0.55 + R() * 0.45;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(cx, cy, PLATFORM_RX * rf, PLATFORM_RY * rf, 0, a0, a1);
        ctx.stroke();
      }
    }
    // radial glyph ticks between the rings
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.strokeStyle = RUNE; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * PLATFORM_RX * 0.6, cy + Math.sin(a) * PLATFORM_RY * 0.6);
      ctx.lineTo(cx + Math.cos(a) * PLATFORM_RX * 0.74, cy + Math.sin(a) * PLATFORM_RY * 0.74);
      ctx.stroke();
    }
    // central sigil
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = RUNE; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.ellipse(cx, cy, PLATFORM_RX * 0.2, PLATFORM_RY * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * PLATFORM_RX * 0.2, cy + Math.sin(a) * PLATFORM_RY * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function makePage(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  DR.WaypointShrineAsset = {
    install(Game) {
      Object.assign(Game.prototype, {

        // Bakes and registers the shrine. Idempotent; safe to call more than once.
        buildAuthoredWaypointShrine() {
          if (this._waypointShrinePages) return this._waypointShrinePages;
          const colour = makePage(FRAME, FRAME);
          const emissive = makePage(FRAME, FRAME);
          try {
            bakeColour(colour.getContext('2d'), rnd(0x5A17E));
            bakeEmissive(emissive.getContext('2d'), rnd(0x9E11));
          } catch (err) {
            console.warn('[Blackroot] waypoint shrine bake failed:', err);
            return null;
          }

          const manifest = {
            schema: 'blackroot-authored-atlas-v1',
            name: 'props_waypoints',
            kind: 'prop',
            pages: [{ file: 'props_waypoints_0.png', w: FRAME, h: FRAME }],
            frames: {
              dark_woods_waypoint_full: {
                page: 0,
                rect: { x: 0, y: 0, w: FRAME, h: FRAME },
                anchor: { x: ANCHOR_X, y: ANCHOR_Y },
                // Tall enough to hide an actor standing behind the platform, measured to the pillar
                // capitals rather than guessed.
                occlusionHeight: 70,
                contactShadow: { rx: PLATFORM_RX * 0.92, ry: PLATFORM_RY * 1.05, alpha: 0.26 },
                emissive: 'props_waypoints_0_emissive.png',
                light: { radius: 150, intensity: 0.85, color: '#78aaff' }
              }
            }
          };

          const res = this.registerAuthoredAtlas?.(manifest, 'props_waypoints');
          if (!res || !res.ok) {
            console.warn('[Blackroot] waypoint shrine atlas rejected; keeping procedural fallback.');
            return null;
          }
          this._waypointShrinePages = { colour, emissive, manifest, frame: FRAME };
          return this._waypointShrinePages;
        },

        // Blits the baked shrine at a screen foot point. Returns false if unavailable, so the caller
        // can fall back rather than drawing nothing.
        drawAuthoredWaypointShrine(s, scale = 1) {
          const pages = this._waypointShrinePages || this.buildAuthoredWaypointShrine();
          if (!pages) return false;
          const { ctx } = DR.runtime || {};
          if (!ctx) return false;
          const f = this.authoredFrame?.('props_waypoints', 'dark_woods_waypoint_full');
          const ax = f?.anchor?.x ?? ANCHOR_X, ay = f?.anchor?.y ?? ANCHOR_Y;
          const w = FRAME * scale, h = FRAME * scale;
          const dx = s.x - ax * scale, dy = s.y - ay * scale;

          ctx.save();
          ctx.drawImage(pages.colour, dx, dy, w, h);
          // Emissive pass: additive, so the runes read as light rather than paint. Boosted at night
          // through the same profile knob the rest of the lighting uses.
          const boost = this.waypointEmissiveStrength ? this.waypointEmissiveStrength() : 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, Math.min(1, 0.30 * boost));
          ctx.drawImage(pages.emissive, dx, dy, w, h);
          ctx.restore();
          return true;
        }
      });
    }
  };
})();
