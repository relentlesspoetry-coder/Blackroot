// Blackroot authored-atlas pipeline (Art Direction Phase 10).
//
// V0.20.97: the CONTRACT an artist exports against, plus the loader, validator and missing-frame
// diagnostics that consume it. This is deliberately separate from systems/sprite-atlas-system.js:
// that one indexes sprites BAKED FROM THE PROCEDURAL RENDERERS (entities.json, type
// 'dream-realms-entity-atlas'), which is a fundamentally different thing - it has no anchors, no
// emissive masks, no occlusion height and no animation grouping, because a bake of our own output
// needs none of those. Authored art needs all of them.
//
// NOTHING HERE INVENTS ART. No atlas exists yet; every code path degrades to "not available" and the
// game renders exactly as it does today. The value of shipping this before the art is that it fixes
// the format, so work commissioned against it drops in rather than needing a second migration.
//
// ---------------------------------------------------------------------------------------------
// FORMAT  (assets/atlases/<group>/<name>.json alongside <name>_<page>.png)
// ---------------------------------------------------------------------------------------------
// {
//   "schema": "blackroot-authored-atlas-v1",
//   "name": "props_waypoints",
//   "kind": "prop" | "actor" | "terrain" | "vfx",
//   "pages": [{ "file": "props_waypoints_0.png", "w": 1024, "h": 1024 }],
//   "frames": {
//     "<frameId>": {
//       "page": 0,
//       "rect": { "x": 0, "y": 0, "w": 192, "h": 192 },
//       "anchor": { "x": 96, "y": 168 },            // FOOT point, in frame pixels
//       "occlusionHeight": 72,                       // px above the anchor that can hide an actor
//       "contactShadow": { "rx": 44, "ry": 16, "alpha": 0.24 },
//       "emissive": "props_waypoints_0_emissive.png" | false,
//       "light": { "radius": 140, "intensity": 0.85, "color": "#78aaff" }
//     }
//   },
//   "animations": {                                   // actors only
//     "walk": { "directions": 8, "frames": 8, "fps": 12, "pattern": "walk_{dir}_{i}" }
//   }
// }
//
// RULES, and each exists because getting it wrong is silent:
//   - anchor is the FOOT, not the centre. Depth sorting and shadow placement both key off it, and a
//     centre anchor makes props float exactly like the terrain did before V0.20.94.
//   - anchor must lie inside the frame rect, or the prop draws offset with no error.
//   - every animation pattern must resolve to a real frame for every direction and index. A missing
//     frame in one of 8 directions is invisible until a player happens to face that way.
//   - emissive pages must match their colour page's dimensions, or the additive pass misregisters.
// ---------------------------------------------------------------------------------------------
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const SCHEMA = 'blackroot-authored-atlas-v1';
  const KINDS = new Set(['prop', 'actor', 'terrain', 'vfx']);

  function isRect(r) {
    return !!r && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(Number(r[k]))) &&
      Number(r.w) > 0 && Number(r.h) > 0;
  }

  // Validates a manifest OBJECT. Pure and synchronous, so it can run in the boot suite without
  // fetching anything, and so an export tool can call it directly.
  function validateManifest(man, label = 'atlas') {
    const errors = [];
    const warnings = [];
    const push = (a, m) => a.push(`${label}: ${m}`);

    if (!man || typeof man !== 'object') return { ok: false, errors: [`${label}: not an object`], warnings, frameCount: 0 };
    if (man.schema !== SCHEMA) push(errors, `schema is "${man.schema}", expected "${SCHEMA}"`);
    if (!man.name) push(errors, 'missing name');
    if (!KINDS.has(String(man.kind))) push(errors, `kind "${man.kind}" is not one of ${[...KINDS].join('/')}`);

    const pages = Array.isArray(man.pages) ? man.pages : [];
    if (!pages.length) push(errors, 'no pages declared');
    pages.forEach((pg, i) => {
      if (!pg || !pg.file) push(errors, `page ${i} has no file`);
      if (!(Number(pg.w) > 0 && Number(pg.h) > 0)) push(errors, `page ${i} has no usable dimensions`);
      // The V0.20.53 lesson, enforced rather than remembered: 4096-square pages blit ~6.6x slower
      // than small ones and cost 1.28GB of texture, which is why that atlas was reverted.
      if (Number(pg.w) > 2048 || Number(pg.h) > 2048) {
        push(warnings, `page ${i} is ${pg.w}x${pg.h}; pages above 2048 blit far slower (see V0.20.53/54 revert)`);
      }
    });

    const frames = (man.frames && typeof man.frames === 'object') ? man.frames : null;
    if (!frames) push(errors, 'no frames map');
    let frameCount = 0;

    for (const [id, f] of Object.entries(frames || {})) {
      frameCount++;
      if (!isRect(f?.rect)) { push(errors, `frame "${id}" has an invalid rect`); continue; }
      const pi = Number(f.page) || 0;
      const page = pages[pi];
      if (!page) { push(errors, `frame "${id}" references missing page ${pi}`); continue; }
      if (f.rect.x < 0 || f.rect.y < 0 ||
          f.rect.x + f.rect.w > Number(page.w) || f.rect.y + f.rect.h > Number(page.h)) {
        push(errors, `frame "${id}" rect falls outside page ${pi}`);
      }
      const a = f.anchor;
      if (!a || !Number.isFinite(Number(a.x)) || !Number.isFinite(Number(a.y))) {
        push(errors, `frame "${id}" has no anchor - depth sorting and shadows both need the FOOT point`);
      } else if (a.x < 0 || a.y < 0 || a.x > f.rect.w || a.y > f.rect.h) {
        push(errors, `frame "${id}" anchor (${a.x},${a.y}) lies outside its ${f.rect.w}x${f.rect.h} frame`);
      } else if (a.y < f.rect.h * 0.5) {
        // Not fatal, but almost always means a centre anchor was exported by mistake - which makes
        // props float, the exact failure this project spent V0.20.94 diagnosing in terrain.
        push(warnings, `frame "${id}" anchor sits in the upper half; anchors should be the FOOT`);
      }
      if (f.contactShadow && !(Number(f.contactShadow.rx) > 0 && Number(f.contactShadow.ry) > 0)) {
        push(errors, `frame "${id}" contactShadow has no usable radii`);
      }
      if (f.occlusionHeight !== undefined && !(Number(f.occlusionHeight) >= 0)) {
        push(errors, `frame "${id}" occlusionHeight is not a positive number`);
      }
    }

    // Animation groups must resolve for EVERY direction and index. One missing direction is invisible
    // until a player happens to face that way, which is the worst kind of art bug to ship.
    const anims = (man.animations && typeof man.animations === 'object') ? man.animations : {};
    const missingFrames = [];
    for (const [animName, spec] of Object.entries(anims)) {
      const dirs = Math.max(1, Number(spec?.directions) || 1);
      const count = Math.max(1, Number(spec?.frames) || 1);
      const pattern = String(spec?.pattern || '');
      if (!pattern.includes('{i}')) { push(errors, `animation "${animName}" pattern has no {i}`); continue; }
      if (dirs > 1 && !pattern.includes('{dir}')) { push(errors, `animation "${animName}" is ${dirs}-directional but its pattern has no {dir}`); continue; }
      for (let d = 0; d < dirs; d++) {
        for (let i = 0; i < count; i++) {
          const key = pattern.replace('{dir}', String(d)).replace('{i}', String(i));
          if (!frames || !frames[key]) missingFrames.push(`${animName}:${key}`);
        }
      }
    }
    if (missingFrames.length) {
      push(errors, `${missingFrames.length} animation frame(s) missing, e.g. ${missingFrames.slice(0, 5).join(', ')}`);
    }

    return { ok: errors.length === 0, errors, warnings, frameCount, missingFrames };
  }

  DR.AuthoredAtlas = { SCHEMA, KINDS: [...KINDS], validateManifest };

  DR.AuthoredAtlasSystem = {
    install(Game) {
      Object.assign(Game.prototype, {
        authoredAtlases: null,

        // Registers an already-parsed manifest. Refuses invalid ones rather than half-loading, because
        // a partially valid atlas produces missing sprites at runtime with no explanation.
        registerAuthoredAtlas(manifest, label) {
          const name = label || manifest?.name || 'atlas';
          const report = validateManifest(manifest, name);
          if (!this.authoredAtlases) this.authoredAtlases = new Map();
          if (!report.ok) {
            console.warn(`[Blackroot] authored atlas "${name}" rejected:\n  ${report.errors.join('\n  ')}`);
            return { ok: false, report };
          }
          if (report.warnings.length) {
            console.warn(`[Blackroot] authored atlas "${name}" warnings:\n  ${report.warnings.join('\n  ')}`);
          }
          this.authoredAtlases.set(name, { manifest, report, images: new Map() });
          return { ok: true, report };
        },

        async loadAuthoredAtlas(url, options = {}) {
          const man = await this.assetSystem?.loadJson?.(url, { silent: options.silent !== false });
          if (!man) return { ok: false, report: { errors: [`${url}: not found`], warnings: [] } };
          return this.registerAuthoredAtlas(man, man.name || url);
        },

        authoredFrame(atlasName, frameId) {
          const entry = this.authoredAtlases?.get(atlasName);
          const f = entry?.manifest?.frames?.[frameId];
          if (!f) return null;
          return { ...f, page: entry.manifest.pages[Number(f.page) || 0] };
        },

        // Page IMAGES, as opposed to the manifest. The waypoint shrine (V0.21.2) registers a
        // manifest whose pages it renders itself into offscreen canvases, so nothing until now had
        // to fetch a PNG. Authored art produced outside the engine does.
        //
        // Returns the decoded page or null. Never throws and never blocks: a caller that gets null
        // draws procedurally, which is the same contract the rest of this file keeps.
        authoredPageImage(atlasName, pageIndex = 0) {
          const entry = this.authoredAtlases?.get(atlasName);
          if (!entry) return null;
          const img = entry.images?.get(Number(pageIndex) || 0);
          // A pending fetch is stored as a promise; only a decoded HTMLImageElement is drawable.
          return (img && img.nodeName) ? img : null;
        },

        // Loads a manifest AND its pages. One in-flight load per atlas name; repeated calls while
        // loading are cheap no-ops rather than duplicate fetches, because this is called from the
        // draw path once per prop per frame.
        ensureAuthoredAtlas(url, name) {
          if (!this._authoredAtlasLoads) this._authoredAtlasLoads = new Map();
          const key = name || url;
          if (this._authoredAtlasLoads.has(key)) return this._authoredAtlasLoads.get(key);

          const promise = (async () => {
            const man = await this.assetSystem?.loadJson?.(url, { silent: true });
            if (!man) return false;
            const reg = this.registerAuthoredAtlas(man, man.name || key);
            if (!reg.ok) return false;
            const entry = this.authoredAtlases.get(man.name || key);
            const dir = String(url).replace(/[^/]*$/, '');
            const pages = Array.isArray(man.pages) ? man.pages : [];
            await Promise.all(pages.map(async (pg, i) => {
              const img = await this.assetSystem?.loadImage?.(dir + pg.file, { silent: true });
              if (img) entry.images.set(i, img);
            }));
            const loaded = entry.images.size;
            if (loaded !== pages.length) {
              console.warn(`[Blackroot] authored atlas "${man.name}": ${loaded}/${pages.length} ` +
                'pages decoded; frames on missing pages fall back to procedural drawing.');
            }
            return loaded > 0;
          })();

          this._authoredAtlasLoads.set(key, promise);
          return promise;
        },

        // True once real authored art is registered. Every renderer that wants to prefer authored art
        // over its procedural fallback asks this, so there is ONE answer rather than a per-renderer
        // guess - and while it is false, the game looks exactly as it does today.
        hasAuthoredArt(kind = null) {
          if (!this.authoredAtlases?.size) return false;
          if (!kind) return true;
          for (const { manifest } of this.authoredAtlases.values()) {
            if (manifest.kind === kind && Object.keys(manifest.frames || {}).length) return true;
          }
          return false;
        },

        // Boot-suite hook: reports on every registered atlas, and says plainly when none exist rather
        // than passing silently and implying the pipeline is doing something.
        authoredAtlasReport() {
          const out = { atlases: 0, frames: 0, errors: 0, warnings: 0, detail: [] };
          if (!this.authoredAtlases?.size) {
            out.status = 'no authored atlases registered - procedural rendering in use';
            return out;
          }
          for (const [name, entry] of this.authoredAtlases) {
            out.atlases++;
            out.frames += entry.report.frameCount;
            out.errors += entry.report.errors.length;
            out.warnings += entry.report.warnings.length;
            out.detail.push({ name, kind: entry.manifest.kind, frames: entry.report.frameCount,
              warnings: entry.report.warnings.length });
          }
          out.status = out.errors ? 'errors present' : 'ok';
          return out;
        }
      });
    }
  };
})();
