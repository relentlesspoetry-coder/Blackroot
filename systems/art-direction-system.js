// Blackroot art direction (Phase 1 of the HD dark-fantasy isometric conversion).
//
// V0.20.96: ONE SOURCE OF TRUTH for presentation style. Before this, style constants were scattered
// across the renderers - shade values in terrain-renderer, glow alphas in object-renderer, particle
// densities in effects-renderer - so "make the world darker" or "make magic brighter" meant hunting
// through four files and hoping none were missed. That is precisely how the V0.20.93 shading
// regression happened: a value existed in one place, was consumed in another, and nothing tied them
// together.
//
// SCOPE, STATED HONESTLY: this file defines the target style and the knobs. It does not draw anything
// and it cannot invent art. Authored sprite sheets, monster atlases, terrain tile families and UI art
// are asset production and must come from an artist or a render pipeline. What lives here is what the
// renderers READ, so that when those assets arrive they land in a world already lit and proportioned
// for them.
//
// TILE METRICS: V0.21.0 migrated to the spec's true 2:1 isometric ratio; V0.21.1 set the scale.
//
// V0.20.96 declined to change them, on the stated grounds that they were "load-bearing for collision,
// prop anchors, every authored landmark coordinate and every saved world". THAT WAS WRONG, and the
// correction is recorded here because the claim was repeated in the patch notes and README. Auditing
// every read site found 28 of them, and ALL are projection or presentation: worldToScreen /
// screenToWorld in game.js, the isometric basis vectors in terrain-renderer and render-backend-system,
// a jump-lift offset in entity-renderer, and a cosmetic fishing-line clamp. NOTHING in collision,
// NOTHING in the save system, NOTHING in stored coordinates - the world grid is in TILE space, so the
// metrics only decide how that grid is projected to pixels.
//
// The values live in core/config.js, which is the single source of truth. DR.CONFIG is frozen, so the
// migration plan's applyArtDirectionProfile() - which assigns this.CONFIG.TILE_W at runtime - would
// have failed SILENTLY. The intent is honoured by changing the source constants instead; the profile
// mirrors them so consumers still have one place to ask.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // Snap step for the camera. The spec's first choice is a FIXED isometric camera, with
  // 'snap-isometric-4' named as the fallback "if Q/E rotation must stay". Rotation is an established
  // feature here - four versions of terrain corner work (V0.20.92-95) went into making walls read at
  // every angle - so the fallback is what ships, and it is the spec's own sanctioned option rather
  // than an invention. V0.20.96's 8 was not on the spec's list at all.
  //
  // To go fully fixed, set SNAP_ANGLES = 1 and the camera settles on a single heading.
  const SNAP_ANGLES = 4;
  const SNAP_STEP = (Math.PI * 2) / SNAP_ANGLES;

  const PROFILE = Object.freeze({
    id: 'dark-fantasy-isometric-hd',
    projection: 'snap-isometric-4',
    snapAngles: SNAP_ANGLES,

    // Mirrors of core/config.js, which owns these. 136:68 is exactly 2:1 - the classic isometric
    // ratio the reference look is built on, where the shipped 104:58 was 1.79:1.
    //
    // V0.21.1: SCALED UP from the spec's literal 96/48/32, which measured 29.6% SMALLER on screen than
    // the build it replaced. That contradicted the spec's own requirement of "larger visual tiles than
    // your current low-detail pass" - the document's prose and its numbers disagree. 136/68 keeps the
    // true 2:1 ratio the spec is really after while restoring the previous apparent size to within
    // 0.24% (76.03px tile edge against 76.21px). ELEV_STEP 45 holds the spec's elevation-to-tile-height
    // ratio (0.662 against its 0.667), far above the old build's 0.483, so cliffs keep the added depth.
    tileWidth: 136,
    tileHeight: 68,
    elevStep: 45,

    // Dark, desaturated world so localized magic reads as the only real light source.
    // V0.21.4: BOTH VALUES MEASURED AGAINST THE REFERENCE IMAGE, not taken from the plan.
    //
    // VALUE. Reference ground sits at luma 72.6; ours measured 128.5 with weather cleared. The plan's
    // 0.72 reaches only 92.5. A first attempt at 0.565 landed at 103.7 - short, because the grade
    // applies to the material BASE while the cached detail passes, depth wash and lighting paint on
    // top ungraded, so the composite lands brighter than the base alone. 0.40 accounts for that.
    //
    // SATURATION IS ABOVE 1, WHICH CONTRADICTS THE PLAN, and the measurement is why. The plan says
    // "dark and desaturated" and specifies 0.72. But our ground measured 0.405 against the reference's
    // 0.444 - already BELOW it. Cutting further took it to 0.339 and moved away from the target. The
    // reference is desaturated relative to a bright fantasy palette, not relative to this build, which
    // was already muddy. So this lifts slightly instead. "Muted earth tones" means muted and EARTHY;
    // draining the last of the colour gives grey, which is what the fog bug was already doing.
    // layerGrade darkens the FINISHED chunk layer; value/saturation grade the material base going in.
    // Two stages because base-only grading stalled at luma 93 against the reference's 72.6 - the
    // detail passes paint on top ungraded. value eased back to 0.52 now that layerGrade carries the
    // brightness, so the base keeps its material identity instead of being crushed toward mud.
    ambient: Object.freeze({ saturation: 1.35, value: 0.52, layerGrade: 0.22, vignette: 0.18 }),

    terrain: Object.freeze({
      macroVariation: 0.35,
      // Broad world-anchored ELLIPSE patches stamped into the chunk on a 4-tile grid, up to
      // 5.7x4.3 tiles across. Distinct from macroVariation above, which is a smooth per-tile wash
      // sampled at 1/9th tile frequency and does not produce shapes.
      //
      // OFF (0) SINCE V0.21.7. They were meant to "break repetition across tile and chunk
      // boundaries", but at up to 5.7 tiles wide with a hard elliptical falloff they read as what
      // they are - discrete ovals stamped on the ground - rather than as terrain variation. The
      // smooth macroVariation wash and the V0.21.5 six-layer ground texture already cover
      // repetition breakup, and they do it without silhouettes.
      //
      // Set above 0 to bring them back; the value scales their alpha.
      macroPatchStrength: 0,
      // How strongly a material transition is accented. drawCachedMaterialBoundary strokes a band
      // along the shared tile edge; because that band traces the tile-grid staircase, a strong
      // accent makes the staircase MORE legible as the isometric zigzag, not less. Its third stroke
      // in particular uses the material's `light` tint, which draws a bright line straight along the
      // seam.
      //
      // 1.0 is the pre-V0.21.7 look. Lower values lighten the accent so the transition settles into
      // the ground. This is the safe knob for seam contrast: it only scales what is already drawn,
      // so unlike widening the seam it cannot introduce smearing or the chained ribbons that the
      // wider-jitter experiment produced.
      seamStrength: 0.45,
      // Drifting surface flow on open water. The baked shimmer layer only pulses its ALPHA
      // (terrain-renderer, shimmerAlpha), so its highlights breathe in place and nothing ever
      // travels - which is why water read as completely still. This adds movement that actually
      // goes somewhere. 0 disables it and restores the pulse-only look.
      waterFlow: Object.freeze({
        strength: 1.0,
        // World-space direction the surface drifts. Projected through worldToScreen, so it keeps a
        // consistent heading under camera rotation instead of sliding with the screen.
        dirX: 1,
        dirY: 0.35,
        speed: 0.055,          // world tiles per second
        // Lattice spacing in tiles. Crest count scales as 1/density², so small reductions are
        // quadratically expensive — 1.5 → 1.25 with a fine third octave measured ~6.1ms/frame.
        density: 1.45
      }),
      decalDensity: 0.42,
      crackDensity: 0.28,
      mossDensity: 0.22,
      // Minimum luminance a wall face may reach. The V0.20.95 fix lives here now rather than as a
      // magic number inside drawLayeredWallFace.
      wallFloorLuma: 8,
      wallHeadroomDivisor: 70
    }),

    shadows: Object.freeze({
      contactAlpha: 0.24,
      contactRadiusScale: 1,
      longShadowAlpha: 0.08,
      groundedProps: true
    }),

    lighting: Object.freeze({
      localizedOnly: true,
      emissiveBloom: 0.65,
      waypointBeamIntensity: 0.95,
      flameGlowIntensity: 0.55,
      // Night brightening, inherited from the removed waypointAura (V0.17.56 -> V0.20.89).
      nightBoost: 0.8,
      // Elements that must never be night-boosted or they clip to white - the lesson from V0.20.89.
      boostExempt: Object.freeze(['coreBloom', 'beamRoot', 'flameCore'])
    }),

    actors: Object.freeze({
      style: 'hd-prerendered-pixel',
      proportions: 'realistic',
      directions: 8,
      // Nothing authored yet; procedural humanoids remain the source until sheets exist.
      authoredSheetsAvailable: false
    }),

    vfx: Object.freeze({
      additiveBlend: 'lighter',
      particleDensity: 0.65,
      beamWidth: 18,
      runeColor: '#b8d3ff',
      beamColor: '#8ab8ff',
      coreColor: '#eaf6ff',
      // V0.20.97: how much brighter an ADDITIVE vfx pass draws than it authored itself. This is the
      // one knob that makes magic read as the only real light source in a dark world. Applied only to
      // 'lighter'/'screen' passes - structural source-over drawing is left exactly alone, because
      // boosting that would wash out the silhouettes rather than the glow.
      additiveBoost: 1.35
    })
  });

  DR.ART_PROFILE = PROFILE;

  DR.ArtDirectionSystem = {
    install(Game) {
      Object.assign(Game.prototype, {
        getArtDirectionProfile() { return PROFILE; },

        // Snap a yaw to the nearest authored angle.
        snapCameraYaw(yaw) {
          const y = Number(yaw) || 0;
          return Math.round(y / SNAP_STEP) * SNAP_STEP;
        },

        // The camera still accelerates and decelerates for feel; it simply settles on one of eight
        // headings instead of anywhere. Applied from the yaw update once motion has died down, so
        // rotation does not feel notched while the player is holding the key.
        applyCameraYawSnap(dt) {
          const cam = this.camera;
          if (!cam || this.artDirectionFreeYaw === true) return;
          if (Math.abs(Number(cam.yawVel) || 0) > 0.06) return;   // still turning - leave it alone
          const target = this.snapCameraYaw(cam.yaw);
          const delta = target - cam.yaw;
          if (Math.abs(delta) < 0.0005) { cam.yaw = target; return; }
          const k = Math.min(1, (Number(dt) || 0.016) * 9);
          cam.yaw += delta * k;
        },

        artProfileValue(path, fallback = null) {
          const parts = String(path || '').split('.');
          let node = PROFILE;
          for (const key of parts) {
            if (node == null || typeof node !== 'object') return fallback;
            node = node[key];
          }
          return node === undefined ? fallback : node;
        },

        // V0.21.0: this is now actually CALLED at boot (game.js). It never was before, which is how
        // the profile came to sit in the build with almost nothing reading it.
        //
        // It VERIFIES rather than writes. DR.CONFIG is frozen, so the migration plan's version -
        // `this.CONFIG.TILE_W = p.tileWidth` - would have thrown in strict mode or been silently
        // discarded otherwise, leaving the profile and the real projection disagreeing with no
        // symptom. core/config.js is the source of truth; a mismatch here means someone edited one
        // and not the other, and that is worth a loud complaint rather than a silent divergence.
        applyArtDirectionProfile() {
          const cam = this.camera;
          if (cam) {
            cam.mode = PROFILE.projection;
            cam.snapAngles = PROFILE.snapAngles;
          }
          this.renderProfile = PROFILE;

          const C = DR.CONFIG || {};
          const drift = [];
          if (Number(C.TILE_W) !== PROFILE.tileWidth) drift.push(`TILE_W ${C.TILE_W} != ${PROFILE.tileWidth}`);
          if (Number(C.TILE_H) !== PROFILE.tileHeight) drift.push(`TILE_H ${C.TILE_H} != ${PROFILE.tileHeight}`);
          if (Number(C.ELEV_STEP) !== PROFILE.elevStep) drift.push(`ELEV_STEP ${C.ELEV_STEP} != ${PROFILE.elevStep}`);
          if (drift.length) {
            console.warn(`[Blackroot] art profile disagrees with CONFIG: ${drift.join(', ')}. ` +
              'core/config.js owns these - update the profile mirror to match.');
          }
          this.artProfileDrift = drift;
          return PROFILE;
        }
      });
    },

    // ART DIRECTION PHASE 16 - spell/combat VFX.
    //
    // Installed SEPARATELY and LATER than install(), because render/effects-renderer.js attaches
    // drawEffect at game.js:4594, after the systems block at 4553. Wrapping it from install() would
    // be silently overwritten - the failure mode this whole file exists to prevent.
    //
    // WHY A CONTEXT INTERCEPT RATHER THAN EDITING THE RENDERER. drawEffect is ~2400 lines across
    // roughly 200 branches, each assigning ctx.globalAlpha ABSOLUTELY. Canvas alpha does not compose,
    // so a wrapper that merely sets globalAlpha before calling through is overwritten by the first
    // branch and does nothing. Editing 200 call sites is the cascade-patch this project forbids, and
    // would leave every future effect needing the same edit. Shadowing the accessor for the duration
    // of one call is ONE place, and every branch - including ones not written yet - respects it.
    //
    // Measured before writing this: shadowing costs ~0.05us per assignment (200k assignments 4.3ms
    // native vs 14.6ms shadowed), so a frame doing 2000 of them pays ~0.1ms. save/restore behaves
    // correctly through the shadow, and deleting it restores the native accessor exactly.
    installVfxPass(Game) {
      const original = Game.prototype.drawEffect;
      if (typeof original !== 'function' || Game.prototype._vfxPassInstalled) return false;

      const ADDITIVE = new Set(['lighter', 'screen']);

      Game.prototype.drawEffect = function (e, layer) {
        const ctx = (DR.runtime || {}).ctx;
        const boost = Number(PROFILE.vfx.additiveBoost) || 1;
        // Opt-out, and the cheap outs first: nothing to do without a context, at boost 1, or when the
        // player has turned it off.
        if (!ctx || !e || boost === 1 || this.uiPrefs?.hdVfx === false) return original.call(this, e, layer);

        // Elements that already sit at or near full brightness clip to flat white if boosted. This is
        // the V0.20.89 lesson, and the exemption list is named in the profile rather than rediscovered.
        const tag = String(e.kind || e.style || '');
        if (PROFILE.lighting.boostExempt.includes(tag)) return original.call(this, e, layer);

        const proto = Object.getPrototypeOf(ctx);
        const aDesc = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
        const oDesc = Object.getOwnPropertyDescriptor(proto, 'globalCompositeOperation');
        if (!aDesc?.set || !oDesc?.set) return original.call(this, e, layer);

        const setA = aDesc.set.bind(ctx), getA = aDesc.get.bind(ctx);
        const setO = oDesc.set.bind(ctx), getO = oDesc.get.bind(ctx);

        try {
          Object.defineProperty(ctx, 'globalAlpha', {
            configurable: true,
            get() { return getA(); },
            // Boost only while an additive pass is current. Clamped to 1: alpha above 1 is not
            // brighter, it is invalid, and silently becomes 1 anyway.
            set(v) {
              const n = Number(v);
              if (!Number.isFinite(n)) { setA(v); return; }
              setA(ADDITIVE.has(getO()) ? Math.max(0, Math.min(1, n * boost)) : n);
            }
          });
          Object.defineProperty(ctx, 'globalCompositeOperation', {
            configurable: true,
            get() { return getO(); },
            set(v) { setO(v); }
          });
          return original.call(this, e, layer);
        } finally {
          // Always hand the context back exactly as it was found, even if a branch threw. A leaked
          // shadow would boost the ENTIRE rest of the frame - terrain, entities, UI.
          delete ctx.globalAlpha;
          delete ctx.globalCompositeOperation;
        }
      };

      Game.prototype._vfxPassInstalled = true;
      return true;
    }
  };
})();
