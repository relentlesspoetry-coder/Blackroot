# Dark Woods authored prop art — generation brief

The renderer, packer and atlas format are built, wired and verified. **This document is the only
remaining input: 40 images.** Generate them, drop them in `art/props/`, run one command, and the
Dark Woods converts.

Machine-readable companion: `tools/authored-prop-spec.json` (the packer reads that, not this file).

---

## Why props first

Measured in the live overworld: **34,705 placed objects across 66 types.** The 12 types below are
**33,575 of them — 96.7%.** Trees alone are 7,744.

The flat green polygon trees are the loudest break from the reference art, and props need one
viewing angle rather than the eight an actor needs. Highest visual return for the least art.

---

## The 40 images

| type | image(s) | frame px | anchor px | count in zone |
|---|---|---|---|---|
| `tree` | `tree_v0.png` … `tree_v10.png` | 128 × 158 | 64, 148 | 7,744 |
| `grassTuft` | `grassTuft_v0.png` | 46 × 32 | 18, 23 | 7,149 |
| `brush` | `brush.png` | 70 × 38 | 30, 23 | 3,408 |
| `rock` | `rock.png` | 54 × 44 | 24, 25 | 3,025 |
| `rootCluster` | `rootCluster.png` | 38 × 18 | 18, 10 | 2,900 |
| `flower` | `flower_v0.png` | 46 × 32 | 18, 23 | 2,402 |
| `mushroom` | `mushroom.png` | 56 × 56 | 27, 40 | 2,303 |
| `rootArch` | `rootArch_v0.png` … `rootArch_v10.png` | 94 × 56 | 47, 43 | 1,355 |
| `ashStump` | `ashStump_v0.png` | 34 × 44 | 17, 32 | 1,081 |
| `fallenLog` | `fallenLog_v0.png`, `fallenLog_v1.png` | 68 × 34 | 32, 17 | 1,023 |
| `deadTree` | `deadTree_v0` … `_v6`, `_v8` | 56 × 88 | 29, 78 | 832 |
| `rootBarrier` | `rootBarrier.png` | 70 × 42 | 34, 28 | 375 |

Per-prop art briefs live in the `brief` field of each entry in `tools/authored-prop-spec.json`.

**Source images can be any size and any aspect** — square is fine, large is fine. The packer scales
each to fit its frame box, centres it on the anchor's x, and sits it on the anchor's y. The frame
sizes above are the on-screen result, not a requirement on your source file.

---

## Hard requirements

1. **Transparent background.** Real alpha, not a checkerboard and not a flat colour to be keyed out.
2. **Ground contact at the bottom centre.** The prop must sit on the ground at the horizontal centre
   of the image. A tree's root flare, a rock's base, a log's underside. The anchor is derived from
   that, and everything — depth sorting, shadow placement, whether the prop looks planted or
   floating — keys off it.
3. **No baked-in ground shadow.** The engine draws its own contact shadow from the tuned values
   already in `render/object-renderer.js`. A painted-on shadow doubles up and reads as a dark smear.
4. **No baked-in ground.** No dirt patch, no grass ring, no base plate. The terrain is drawn
   underneath and any included ground will tile visibly against it.
5. **One prop per image.** No scene, no composition, no companion foliage.

---

## Camera and lighting

Every prop must be drawn as if seen through the same lens, or they will not sit together.

- **Viewing angle: 30° above horizontal.** Not a side view, not a top-down view. This is derived
  from the engine's own projection — `TILE_W` 136 and `TILE_H` 68 give a 2:1 ground foreshortening,
  and `asin(0.5)` is exactly 30°. A circle drawn flat on the ground appears as an ellipse twice as
  wide as it is tall.
- **Key light from the upper left**, warm and low-intensity.
- **Cold blue fill** on the shadow side — shadows go blue, never black.
- **Dark, desaturated, muted earth tones.** The world is meant to stay dark so that magic reads as
  the only real light source. Do not light the prop as if it were a hero asset on a neutral
  backdrop.

---

## Style

> High-detail 2.5D isometric dark fantasy pixel art with pre-rendered 3D depth, realistic
> proportions, hand-painted pixel textures, gothic medieval detail, muted earthy palette, dramatic
> ambient shadows. Objects have substantial physical volume and highly detailed materials while
> remaining clearly pixel-art rather than smooth modern 3D rendering.

Your existing spell and item icons are already at the right quality bar — the difference is that
these are dark, small, and part of a world rather than framed portraits.

**Variants must differ in silhouette, not tint.** Eleven trees that differ only in hue will read as
one tree repeated 7,744 times. Vary trunk lean, canopy mass, branch structure, and damage.

---

## Build

```bash
python3 tools/pack-authored-atlas.py --art art/props --out assets/atlases/props
```

That trims margins, packs into pages of ≤512px, carries the anchors and contact shadows through,
and writes `assets/atlases/props/props_dark_woods.json`. The game picks it up on the next load with
no code change.

To test the plumbing before any art exists, add `--placeholders` — it generates obvious magenta
stand-ins and prints a loud non-shippable warning.

Missing files are named and nothing is written, so a partial set fails clean rather than shipping
half an atlas.

---

## Verified

Measured in the live overworld with placeholder frames, in a tree-dense view:

| check | result |
|---|---|
| manifest against `DR.AuthoredAtlas.validateManifest` | **0 errors, 0 warnings**, 40 frames |
| props drawn from the atlas in one frame | **450 authored vs 2 procedural — 99.6%** |
| authored size vs procedural, 9 types | **1.00 – 1.05** |
| frame cost, authored vs procedural | **4.65ms vs 10.3ms** |
| drift between two identical arms | **0.10ms** (signal 5.65ms — 56× the noise floor) |
| atlas removed from disk | 0 authored, 459 procedural, **0 console errors** |

Two calibration bugs were found and fixed by that verification, both silent:

- Authored props came out **1.38×** too large — the spec had been measured from live exemplars whose
  `obj.scale` was already baked in, then multiplied by it again. Sizes are now normalised to
  `obj.scale = 1.0` with `overworldObjectScale` divided back out.
- `rootArch` was still **1.23×** after that fix. Most prop types ignore `obj.scale` entirely
  (measured: exactly 1.00 at scale 1 vs scale 2); only tree, deadTree and brush respond. The
  `appliesObjScale` flag now carries that per type.

**The cost result is worth noting on its own: authored atlas blitting measured roughly 2.2× cheaper
than procedural prop drawing.** Authored art is not a performance cost here, it is a performance
win. Caveat stated plainly — that was measured with placeholder frames. `drawImage` cost is
dominated by destination rect size, which is identical for real art, but denser pixels will
composite somewhat slower, so treat 2.2× as an upper bound until re-measured with real art.
