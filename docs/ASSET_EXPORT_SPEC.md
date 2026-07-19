# Blackroot — Authored Asset Export Specification

**Give this document to whoever produces the art.** It is the contract the engine validates against;
anything exported to it drops straight in. Schema: `blackroot-authored-atlas-v1`.

Validate before delivery — the engine exposes the same check the boot suite uses:

```js
DreamRealms.AuthoredAtlas.validateManifest(manifestObject, 'my_atlas')
// -> { ok, errors[], warnings[], frameCount, missingFrames[] }
```

---

## 1. Art direction

High-detail 2.5D isometric dark fantasy pixel art with pre-rendered 3D depth, realistic proportions,
hand-painted pixel textures, gothic medieval architecture, muted earthy environments, dramatic ambient
shadows, and intense localized magical lighting. Objects must have substantial physical volume and
highly detailed materials while remaining clearly pixel art rather than smooth 3D rendering.

The world stays **dark and desaturated**; magical elements are the concentrated light.

## 2. Projection — non-negotiable

| | |
|---|---|
| projection | fixed three-quarter isometric |
| camera angles | **8**, at 45° increments |
| tile footprint | **104 × 58 px** |
| elevation step | **28 px** per level |

Render at 2:1-ish isometric matching 104×58. Do **not** author for 96×48 — the engine ships 104/58/28
and those values are load-bearing for collision and every existing coordinate.

## 3. Anchors — the most common export mistake

**The anchor is the FOOT contact point, not the centre.**

Depth sorting and contact shadows both key off it. A centre anchor makes the object float — the engine
warns when an anchor sits in the upper half of its frame, because that almost always means a centre
anchor was exported by mistake.

- anchor is in **frame-local pixels**, origin top-left of the frame rect
- it must lie **inside** the rect (hard error otherwise)
- for a character: midpoint between the feet, at ground level
- for a structure: the centre of its ground footprint

## 4. Pages

| rule | reason |
|---|---|
| **max 2048 × 2048** | 4096² pages blit **~6.6× slower** and cost 1.28GB of texture — an earlier atlas was reverted for exactly this (V0.20.53 → V0.20.54). The validator warns above 2048. |
| power-of-two preferred | texture upload |
| PNG, straight alpha | — |
| trim transparent margins | pack density |

## 5. Emissive masks

Anything that glows ships a **second page** of identical dimensions, containing only the emissive
channel on black. The engine composites it additively over the lit scene.

Glowing runes, magical flames, beam cores, lit windows, forge coals, enchanted weapon trails.

Mismatched dimensions misregister the additive pass — the validator cannot catch this, so check it.

## 6. Contact shadows

Every prop and actor declares one. **Nothing may sit on the ground without one** — that is what makes
objects look pasted onto the map.

```json
"contactShadow": { "rx": 44, "ry": 16, "alpha": 0.24 }
```

Ellipse radii in pixels, centred on the anchor. `alpha` defaults to the art profile's `0.24`.

## 7. Occlusion height

```json
"occlusionHeight": 72
```

Pixels above the anchor that may hide an actor standing behind the object. Tall props (walls, trees,
pillars) need this or characters walk "through" them visually.

## 8. Actors — 8-direction sheets

Directions are indexed **0–7 starting at south, going clockwise**:

| index | facing |
|---|---|
| 0 | S |
| 1 | SW |
| 2 | W |
| 3 | NW |
| 4 | N |
| 5 | NE |
| 6 | E |
| 7 | SE |

Required animation groups per actor:

| group | frames | notes |
|---|---|---|
| idle | 6 | subtle breathing |
| walk | 8 | full cycle, no foot sliding |
| attack | 8 | contact on frame 4 |
| cast | 8 | — |
| hurt | 3 | — |
| die | 8 | ends on a rest pose |

```json
"animations": {
  "walk": { "directions": 8, "frames": 8, "fps": 12, "pattern": "walk_{dir}_{i}" }
}
```

**Every direction × frame must resolve to a real frame.** The validator errors on gaps and names them —
a missing frame in one of eight directions is invisible until a player happens to face that way, which
is the worst kind of art bug to ship.

## 9. Terrain

Author **families**, not single tiles:

- base × 4+ variations per material
- overlay decals: cracks, pebbles, moss, puddles, dirt breakup
- transition/shoreline edges
- elevation wall faces (28px per level) plus corner pieces

Ground must never read as flat colour — the engine's `terrain.macroVariation` and `decalDensity` knobs
expect variation to exist in the art.

## 10. Folder layout

```
assets/atlases/
  terrain/darkwoods_ground.png  darkwoods_ground.json
  props/waypoints.png           waypoints.json    waypoints_emissive.png
  actors/human_paladin_male.png human_paladin_male.json
  vfx/magic_blue.png            magic_blue.json
```

## 11. Reference subject — the waypoint shrine

Raised circular stone platform engraved with glowing arcane runes; weathered masonry; 2–4 ritual
pillars; cold blue flames; a concentrated blue-white energy core; a vertical teleportation beam;
drifting magical particles; grounded contact shadow.

It must feel **ancient, powerful, permanent and integrated into the world** — not a small glowing puddle.

## 12. Delivery checklist

- [ ] `validateManifest` returns `ok: true`, zero errors
- [ ] warnings reviewed (centre-anchor and page-size warnings are usually real problems)
- [ ] anchors are foot points
- [ ] every prop/actor has a contact shadow
- [ ] tall props declare `occlusionHeight`
- [ ] emissive pages match their colour page dimensions
- [ ] all 8 directions present for every actor animation
- [ ] no page exceeds 2048²
