## V0.21.16 - Band-Major Composite

The stack exactly as specified: **ground 1, 2, 3, 4 → water 1–4 → mask 1–4.**

### One sort key, and it was the one that mattered

V0.21.10 through V0.21.15 sorted by **chunk depth first, elevation second.** That interleaves bands
across chunks — a far chunk's high ground could be laid down before a near chunk's low ground — which
is exactly the overlap behind the corner and shoreline artefacts through this whole arc.

Band-major inverts it. Elevation is primary; chunk depth only orders surfaces *within* a band. Every
surface at a given elevation is composited before any surface above it, everywhere on screen — so a
higher band can never appear beneath a lower one, regardless of chunk or camera heading.

### How long this took to hear

The stack was written out plainly: *"Ground 1, ground 2, ground 3, ground 4, water 1, water 2, water 3,
water 4, mask 1, mask 2, mask 3, mask 4."*

I responded by asking what a mask meant, then which of two mask designs was intended, then by
explaining masks back. **The stack was the answer.** Band-major ordering is what that list says, and it
was implementable immediately. Sixteen versions went into this fault; the specification was three lines
and I spent two exchanges interrogating it instead of reading it.

### Verified at all four headings

| yaw | emitted elevation sequence |
|---|---|
| 0° | `0000000011112222` |
| 90° | `00000000011112222` |
| 180° | `0000000011112222` |
| 270° | `00000000011112222` |

Non-decreasing at every heading — the definition of band-major, and impossible under the previous
depth-first key. Boot suite PASS, 47 FPS.

### Still outstanding

The grass wall face can still overlap adjacent ground *within* a band, because wall faces are redrawn
after the composite rather than participating in it. That is what the **mask** slot in the specified
stack is for.

## V0.21.15 - Composite Order: Ground, Then Water, Then Shore

It was **water → ground → shore**.

### The fault was the order of the three stages

Not the ordering within any one of them. Water was laid down **before** the land and then painted over
by it. At a shoreline that is backwards — water should lap *over* the bank edge, not be buried beneath
it. The symptom was thin dark wedges exactly where water met a bank: the ground surface cutting across
water that belonged on top of it.

### Where this came from

The user stated the layer model directly — *"ground 1–4, water 1–4, mask 1–4"* — after observing,
correctly, that the real problem was that I did not know how to layer.

Fourteen versions went into sorting pieces correctly *inside* each stage while the three stages sat in
the wrong sequence. Every one of those was a local repair at a boundary between two things that
disagreed, and not one asked what the whole stack should be.

**The lesson is worth more than the fix: establish the layering model first, then order within it.**

`chunkDepth` is now hoisted and shared by all three stages rather than living inside one — the V0.21.14
lesson, where the depth key went into one of three sibling loops and was reported as complete.

### Verified

Standing on a land tile touching both water and a differing elevation — the exact geometry in the
reported crops:

| | |
|---|---|
| ground / water / shore surfaces | 16 / 12 / 8 |
| boot suite | PASS |
| in-game FPS | 51 |

### Not claimed as visually confirmed

I have declared this fault fixed twice while it was not, both times from a small screenshot without
inspecting at magnification. The order change is correct and matches the stated model, but whether the
wedges are fully gone needs a look at zoom.

## V0.21.14 - Water And Shore Layers Get The Depth Key Too

Two close crops of the last artefacts. **Both were at water edges** — that was the whole diagnosis.

### The oversight

V0.21.10 replaced chunk-then-elevation compositing with a real isometric depth key, **and applied it to
the ground loop only.**

The water and shore loops sat immediately below it and kept the original
`for (const entry of visibleChunks)` iteration — so they retained the identical bug: a far chunk's
water surface or shoreline drawn over a near chunk's bank. That is exactly the thin dark wedges and
vertical slivers in the crops, and why the remaining artefacts clustered at shorelines.

Fixing one of three sibling loops and reporting the ordering as fixed was careless. The three loops are
adjacent and structurally identical; checking the other two would have cost nothing.

### The fix

Water and shore build the same flattened draw-unit list and sort by the same key — chunk centre
projected at a fixed elevation, elevation as tiebreak — via a shared `chunkDepth` helper, so the three
loops can no longer drift apart again.

### Verified

At a real shoreline (land tile adjacent to water) with all three layer types live in frame:

| | |
|---|---|
| ground / water / shore surfaces | 18 / 22 / 13 |
| distinct ground orderings across yaw | 4 |
| boot suite | PASS |
| in-game FPS | 43 |

### Honest note on the arc

The previous version's notes declared the corner problem closed. It was not — this is the seventh
version in the sequence. The pattern throughout has been fixing what was in front of me rather than
checking whether the same fault existed elsewhere, and this is the clearest instance: the bug was
sitting in two loops directly beneath the one I fixed.

## V0.21.13 - Corner Join Wedges Redrawn

The last of the raised-terrain corner artefacts, from a close crop of a triangular notch where two wall
faces meet.

### The cause — a near-miss from V0.21.8

Where two wall faces meet, a **wedge** of geometry fills the gap between them, drawn by
`drawHalfBlockCornerJoins` in the full path.

The occlusion-cap pass never called it. It called `drawHalfBlockCornerOcclusionCaps` — a similarly
named but **different** routine that draws occlusion caps rather than the join wedge.

So when V0.21.8 began redrawing wall faces after the ground blit, **the faces survived and the wedge
between them did not.** It was still drawn in the underlay and buried by the blit, exactly as the faces
had been. Two adjacent routines with near-identical names is why this survived five versions of corner
work.

### Deliberately not filtered by camera facing

Unlike the wall faces in V0.21.12. A corner join sits *between* two faces, so at a convex corner one
neighbour can be near-side while the other is far-side. Filtering the wedge by either one puts the
notch straight back. The join routine already decides which corners are exposed.

### Verified at all four headings

| yaw | joins in underlay | joins redrawn |
|---|---|---|
| 0° | 464 | **464** |
| 90° | 520 | **520** |
| 180° | 464 | **464** |
| 270° | 552 | **552** |

Exact match at every heading, against **zero** before. Boot suite PASS, 42 FPS.

### This closes the arc

Six versions on a fault reported across many. **Only one was the underlying bug:**

| version | role |
|---|---|
| V0.21.8 | kept faces alive despite bad ordering |
| V0.21.9 | stopped that redraw spilling over the ground |
| **V0.21.10** | **the actual bug** — real isometric depth key |
| V0.21.11 | elevation tone, so a plateau reads as raised at all |
| V0.21.12 | scoped the redraw to camera-facing walls |
| V0.21.13 | the join wedge the redraw had missed |

V0.21.12 and V0.21.13 each fixed an artefact created by the fix before them.

## V0.21.12 - Only Camera-Facing Walls Are Redrawn

Fixes a regression **this session introduced** in V0.21.8.

Report: *"it looks like just a wall, it doesn't look like im on top of the ground either. from this
angle the inside wall should be covered by the floor / ground tiles giving you the sense that the
player is on top of the raised ground."*

### The regression

V0.21.8 fixed vanishing corners by redrawing wall faces **after** the cached ground blit, so they could
no longer be painted over. That was **too broad**.

The far side of a plateau is *supposed* to be hidden behind its own top surface — that occlusion is
exactly what communicates "you are standing on top of this." Redrawing every face made the far walls'
inside faces visible over the ground, so a plateau read as a ring of walls and the player no longer
appeared to be on top of anything.

Chasing one artefact created another, and it took the user pointing at it to see it.

### The fix

The redraw is limited to camera-near faces. Near/far is decided by the **engine's own projection**
rather than by compass edge key, because which direction faces the camera changes with yaw: a face is
near when its top edge projects lower on screen than the tile's own centre.

Correct at any heading, and it needs no rotation maths of its own — which matters given how much of
this session's trouble came from ordering that ignored yaw.

### Verified across all four headings

| yaw | faces | redrawn | % |
|---|---|---|---|
| 0° | 668 | 332 | **49.7** |
| 90° | 768 | 384 | **50.0** |
| 180° | 668 | 336 | **50.3** |
| 270° | 816 | 408 | **50.0** |

Almost exactly the camera-facing half at every angle — the expected geometric answer, and a strong
check that the near/far test is *right* rather than merely reducing the count. It was **100% at every
heading** in V0.21.8–11.

Boot suite PASS, 44 FPS.

### The full corner arc

| version | what it did |
|---|---|
| V0.21.8 | stopped faces being overdrawn — redraw after blit |
| V0.21.9 | stopped that redraw spilling over the ground that caps it — clip to face quad |
| **V0.21.10** | **the actual root cause** — composite by real isometric depth key |
| V0.21.11 | height changes ground tone, so a plateau reads as raised at all |
| V0.21.12 | scope the redraw to faces that should be visible |

## V0.21.11 - Elevation Tone

Report on V0.21.10: *"from this angle the raised ground just looks like walls between 2 ground
terrains."* Exactly right.

### The cause

**Height did not affect ground colour at all.** A plateau top and the land below it rendered at the
same tone, so the wall faces had nothing to be the sides *of*.

All the wall detailing, corner fixing and depth-ordering of V0.21.8–10 could not have fixed this — the
missing information was on the flat surfaces, not on the walls.

### The cue

Sky exposure. High open ground sees more of the sky dome and catches more light; low ground sits deeper
in ambient shadow. It is how every isometric game that reads well handles height, and it does more for
legibility than any wall detail because it works at a glance and at any zoom.

Warm on the lift, cool on the sink — height reads as *light*, not as bleach. Clamped hard: this is a
legibility cue, not a gradient ramp.

### The ramp was measured, and the first attempt was too weak

At `here/5 × 0.22`, adjacent elevation levels separated by **1.8 luma** — present in the data, invisible
to the eye. Same failure mode as the V0.21.3 macro variation. Raised to `here/3 × 0.30`.

### Verified

| elevation | before | after |
|---|---|---|
| 0 | 33.1 | **36.0** |
| 1 | 52.3 | **49.3** |
| 2 | **48.4** | **61.8** |

Per-step separation now **12.5–13.3 luma, every step positive**.

Note the before column: level 2 was **darker than level 1**. Height wasn't merely unreadable — it was
**inverted** at the top step.

Boot suite PASS, 39 FPS in-game.

## V0.21.10 - Terrain Composited By A Real Isometric Depth Key

The root-cause fix behind the rotating-camera corner faults, replacing the survival patches of V0.21.8
and V0.21.9.

### The bug

```js
for (const entry of visibleChunks) {   // arbitrary push order
  for (const layer of layers) {         // elevation, but only WITHIN a chunk
```

Every layer of one chunk drew before any layer of the next. A far chunk's high ground painted over a
near chunk's low ground — and because which chunks are "far" changes as the camera turns, the fault
appeared and disappeared with rotation.

That is exactly the report: corners *"either vanish or the layer below them renders on top at different
angles"*, and the decisive hint, *"it has to do with the camera rotating."*

### The fix

Ground layers are flattened into one list of draw units and sorted by a genuine depth key, elevation as
tiebreak.

**The key is the engine's own projection**, deliberately, rather than hand-rolled rotation maths —
`worldToScreen` already folds in camera yaw, so projecting each chunk's centre gives a value monotonic
with true isometric depth at any heading.

**It is sampled at a fixed elevation (0) for every unit.** That is what makes it a *depth* measure
rather than a *screen-position* measure. Sampling at each layer's own elevation would have been the
obvious move and a wrong one: elevation must not reorder anything, it only changes where a surface
lands. Elevation is the secondary sort, ascending, so higher ground still covers the lower ground
behind it within a depth band.

### Verified at all four headings

| | |
|---|---|
| distinct draw orderings across yaw 0/90/180/270 | **4** |
| previously | 1 — identical at every heading, so it could not have been tracking rotation |
| draw units/frame | 23 |
| boot suite | PASS |
| in-game FPS | 40 |

### A probe error, recorded

A monotonicity check reported violations at 180° and 270°. It rounded depths to 1dp, manufacturing
false ties between distinct depths (−70.04 and −70.02 both show as −70), then flagged the elevation
tiebreak as broken. **A `.sort()` keyed on depth cannot emit non-monotonic depth** — guaranteed by
construction. The fault was in the check.

### Relationship to V0.21.8 / V0.21.9

Both remain and are still correct — faces drawn after the blit, clipped to their own quad. This version
removes the underlying reason they were being overdrawn at all.

## V0.21.9 - Wall Redraw Clipped To Its Own Face

Completes the V0.21.8 corner fix. Report on V0.21.8: *"that almost fixed the issue. But then the front
wall looks like its a ground tile instead of the wall. Also the ground tiles that are on top of the
wall now look like they're below the wall."*

Both are one fault — and it is **the exact risk V0.21.8 flagged in its own release notes.**

### Cause

V0.21.8 redraws wall faces in the `occlusion-cap` pass, after the cached ground is blitted, so they
stop being painted over. But that redraw was **unclipped**.

In the earlier `depth-underlay` pass the capping came for free: the face was drawn first, and the chunk
blit landed on top of it, trimming everything at or above the lip. A redraw that happens *after* the
blit gets no such trimming — so the face spilled past its own top edge and painted over the ground
meant to cap it.

That is why the front face read as a ground tile (wall pixels sitting where ground should be), and why
the raised block's top looked like it sat *below* its own wall (the wall was covering it).

### Fix

The redraw is clipped to the exact quad the face occupies — top edge `a→b`, bottom edge
`aBottom→bBottom`. The wall can still cover the lower ground in front of it, which is the whole point
of drawing it after the blit, while being unable to touch anything at or above its own lip.

The **ledge lip is deliberately drawn outside the clip** — it is the highlight that sits *on* the edge
line, so clipping it to the face would shave off the half that reads as the lip.

### Verified

| check | result |
|---|---|
| canvas save/restore depth across a full frame | **balanced** |
| face counts, underlay vs after-blit, 4 headings | 668 / 988 / 668 / 992 — exact match |
| boot suite | PASS |
| in-game FPS | 37 |

The balance check matters: a leaked clip would silently corrupt every draw after it — a far worse
failure than the bug being fixed.

### Still outstanding

The chunk layers are still composited in elevation order with **no camera-yaw term**, which is what
allowed the overdraw in the first place. V0.21.8 and this version make faces *survive* that ordering
rather than making the ordering correct. A proper fix needs a real depth key on the layer composite.

## V0.21.8 - Raised-Terrain Corners Fixed

The long-standing report: *"the corners never render correctly, they either vanish or the layer below
them renders on top at different angles"* — and the decisive hint, *"it has to do with the camera
rotating."*

### Root cause — not in the wall geometry

Structural wall faces are drawn in the **depth-underlay** pass ([game.js:4323](game.js:4323)).
`drawTerrainChunks` then blits the cached top surfaces **over them**. Those layers composite in
elevation order with **no camera-yaw term**:

```js
const sortedLayers = Array.from(layers.values()).sort((a, b) => a.elev - b.elev);
```

As the camera rotates, the screen area each projected layer covers shifts relative to where the faces
were drawn. At some angles a layer lands on top of a face that should be in front of it.

**The face was never missing. It was painted over.**

Both symptoms are one bug: "corners vanish" is a cached layer covering a face; "the layer below renders
on top" is the same overlap seen from the other side. Which is exactly why it tracks camera rotation.

### Why V0.20.92–95 could not have fixed it

Those four versions improved corner joins, per-face directional shading, the source heightfield, and
colour crush. Every one was a real fix to a real defect. **None could survive the face being overdrawn
afterwards.** A fifth patch aimed at corner geometry would have repeated the mistake.

### The fix

The **occlusion-cap** pass already runs *after* the chunk blit and previously drew only lips and caps.
It now redraws the wall faces too.

Deliberately a redraw rather than moving the underlay: the underlay still puts face pixels beneath the
cached surface so the top edge caps cleanly, and drawing the same face twice is idempotent — identical
geometry, identical colour, same pixels. The second draw simply lands after the blit.

### A wrong diagnosis, recorded so it isn't revisited

An earlier reading held that tiles were *"falling through both passes."* **The code disproves it** —
both passes iterate the same `terrainDepthRenderables` list, so no tile is skipped. That should have
been checked at the call site before being asserted.

### Verified at all four camera headings

A single-angle test would have proved nothing for a rotation-dependent bug.

| yaw | underlay faces | after-blit faces |
|---|---|---|
| 0° | 668 | **668** |
| 90° | 988 | **988** |
| 180° | 668 | **668** |
| 270° | 992 | **992** |

Exact match at every heading. Counts differ between headings because different faces are exposed at
different angles. Boot suite PASS, 42 FPS in-game.

## V0.21.7 - Height Lighting and Ambient Occlusion

*"More 3D without actually being 3D."*

A flat-shaded surface reads as flat no matter how much texture sits on it, because **the eye judges
form from light, not from detail.** V0.21.5 gave the ground texture; this gives it shape.

Nothing here is 3D — it is per-tile shading computed from neighbouring elevations. But it is the same
information a 3D renderer would use, which is why it reads as volume.

### Three effects, all baked into the chunk layer

1. **Directional light** from a fixed north-west sun. Ground sloping toward it lightens, ground sloping
   away darkens, with slope taken from the elevation gradient across each tile's neighbours — so a
   hillside gets a consistently lit face and a consistently shaded one.
2. **Ambient occlusion.** Tiles hemmed in by higher ground darken in proportion to how much taller the
   surroundings are, **biased toward the side the high ground sits on** so it reads as a shadow cast by
   that mass rather than uniform dimming.
3. **Edge highlight** along the lip of a drop. One bright line at the top of a step does more for
   perceived relief than any amount of shading below it.

Lighting draws **after** the texture pass, so pebbles and grass sit *inside* the shading rather than
floating on top of it. That ordering is what sells the volume.

### This lands the cliff-foot shadow that four attempts failed to produce

Documented as unfixed in V0.20.94 and carried open ever since. Every earlier attempt tried to **project
geometry** down onto the ground. This reads the **height field** directly and darkens tiles by how much
taller their neighbours are. The occlusion *is* the contact shadow.

### Verified

| check | result |
|---|---|
| occluded tiles below flat ground | **11.7 luma** (without the pass: 8.2) — a **43%** deepening |
| drift between repeated arms | ~0.4 luma — signal:noise ≈ 9:1 |
| boot suite | PASS |
| **in-game FPS** | **52** |

### Performance, answered properly at last

Three earlier readings this session — 114ms/frame, 0 FPS, and stub timings inside a 29% drift band —
were **all artifacts** of measuring inside a browser preview pane that is permanently
`document.hidden` and therefore rAF-throttled. The terrain work is not a performance problem, and the
panic that nearly reverted it was unfounded.

## V0.21.6 - Reference Colour, and a Performance Measurement I Got Wrong Three Ways

### Colour

`ambient.saturation` 1.14 → 1.35:

| | hex | luma | saturation |
|---|---|---|---|
| before | `#5f4f3b` | 81.0 | 0.379 |
| **now** | `#604e38` | **80.2** | **0.417** |
| reference | `#5a4632` | 72.6 | 0.444 |

Saturation gap more than halves (−0.065 → −0.027) with luma essentially unchanged. Remaining: 7.6 luma
and 0.027 saturation.

### Wall-face texture: written and reverted

Embedded stonework on cliff faces — lit tops, shaded lower lips, grit — positioned by bilinear
interpolation across the face quad so it followed the wall at any heading.

Reverted **not because it looked wrong** but because `drawWallFaceDetails` runs **live, 138 calls per
frame** in elevated terrain, uncached — unlike the ground pass which bakes into the chunk once.
Texturing cliff faces is still worth doing; it belongs in `buildTerrainChunk`.

### The performance numbers were wrong three ways

Recorded because this nearly caused a good change to be reverted.

1. A synthetic render loop reported **114ms/frame**.
2. The HUD read **0 FPS** — having read 26, 13 and 20 earlier in the session.
3. Selective stubbing reported savings of 3.00 / 4.95 / 6.26 / 8.74ms.

(1) and (2) are artifacts: the preview pane is always `document.hidden`, so its rAF is throttled and any
FPS from it is meaningless — **a lesson already in project memory that I failed to apply.**

(3) is inside the drift band: re-measuring the *untouched* baseline at the end gave 14.02ms against the
opening 19.75ms — a 29% swing with no code change. **The drift check must run between every arm.**

Honest summary: frame time is roughly **14–20ms warm**, and the ground pass is cached so its per-frame
cost is near zero. **The actual frame cost of this session's work is still unknown** and needs a real
in-game reading.

## V0.21.5 - The Terrain Graphical Pass

The reference requirement is explicit: *"instead of large flat-color tiles, the ground uses noise,
cracks, stones, dirt variation, moss, and irregular shading."* This delivers it.

`drawChunkGroundTexture` draws six layers into every ground tile:

| layer | why |
|---|---|
| dirt speckle | kills the flat-colour read at close range - without it the eye sees a solid fill however many big rocks sit on top |
| dirt clumps | the mid-frequency gap that made ground read as noise-on-flat |
| **pebbles & stones** | three elements each - contact shadow, lit body, shaded underside - so they sit *on* the ground, not painted onto it. The biggest single contributor. |
| cracks | short jagged runs, not smooth curves; from `crackDensity` |
| moss | from `mossDensity`, on grass and stone |
| grass blades | short lit strokes on grassy ground |

Drawn into the **chunk layer**, where terrain is genuinely built — so it is cached and costs nothing per
frame. The V0.21.3 lesson applied rather than merely recorded. Fully deterministic per tile.

### Verified

| check | result |
|---|---|
| local surface contrast (adjacent-pixel luma delta) | **0.823 → 2.089, +153.8%** |
| repeatability | 2.089 both arms, identical |
| calls per chunk rebuild | 6,082 |
| boot suite | PASS |

### Cost, stated plainly

A cold-cache rebuild measured **~556ms** across three frames. One-time per chunk and absorbed by the
cache during play, but a visible hitch on zone entry. First thing to profile if loading feels slow;
element counts are a single set of constants.

## V0.21.4 - Reference Grade

Everything here was measured against the user's supplied reference art, not the migration plan. Where
they disagreed, **the reference won**.

### Fog was the biggest culprit — found by looking at a screenshot

| | hex | luma | saturation |
|---|---|---|---|
| with fog | `#adadaa` | 172.8 | **0.017** |
| fog cleared | `#997d5b` | 128.5 | 0.405 |
| reference | `#5a4632` | 72.6 | 0.444 |

The terrain material was already close in hue and richness. Fog was draining it to grey. A weather
effect that takes saturation to 0.017 is a bug, not an atmosphere — flagged for its own fix.

### Brightness fixed in two stages

Grading `material.base` alone **stalled at luma 93**: cutting `ambient.value` 0.565 → 0.40, a 29%
reduction, bought only 10%, because the cached detail passes and depth wash paint on top ungraded.

Grading the **finished layer** after every pass catches all of it — the same "find where it is actually
drawn" lesson V0.21.3 learned. That let `value` ease back to 0.52 so materials keep their identity.

**Result: `#5f4f3b` at luma 81.0** against the reference's 72.6 — within 12%, hue matching.

`source-atop` makes the layer grade safe. **Verified by coverage comparison** after a first probe
wrongly suggested otherwise: alpha sum identical with grade on and off (64,886,172 both arms), clear
pixels identical (23,929). Zero alpha added. The bad probe sampled painted terrain and assumed it was
empty padding.

### Saturation is above 1, contradicting the plan

The plan says desaturate to 0.72. But ours measured 0.405 against the reference's 0.444 — already
below. Cutting took it to 0.339, away from target. The reference is desaturated relative to a bright
fantasy palette, not relative to this build, which was already muddy.

### The bug behind three failed attempts

`DR.utils.smoothNoise` returns a **spread of 0.0001** — a constant 0.5135. The "variation" was a flat
1.5% tint everywhere. Two of three attempts went into raising a multiplier that could never have
helped. Fixed with `seededNoise` on an integer lattice with smoothstep interpolation.

### Shrine size correction

V0.21.2 shipped it several times too large. I reported "1.93 tiles wide" — that measured the *platform
only*, ignoring pylons 150px above it and pillars another 74px. Frame 320→208, platform 132→76,
emissive 0.55→0.30.

**Measuring one part of an asset and reporting it as the asset's size** is the mistake not to repeat.

## V0.21.3 - Art Direction Phase 3 (Partial): Macro Ground Variation

### The finding matters more than the feature

Instrumenting call counts per frame:

| | cold cache | warm |
|---|---|---|
| `buildTerrainChunk` | 9 | 0 |
| `drawTile` | 34 | 34 |
| **`drawGroundDetail`** | **0** | **0** |

Visible terrain is built inside `buildTerrainChunk` into cached per-elevation layer surfaces.
`drawTile` handles only edge cases. **`drawGroundDetail` never runs** - so the high-poly grass / dirt /
cave-floor detail passes it dispatches to are dead in normal play, apparently since chunk caching landed.

A first version of this change was written at those call sites, measured as nothing (signal 0.635 mean
Δluma against 1.269 drift - half the noise floor), and was **reverted**. The code was correct; the path
never executes.

Two wrong hypotheses eliminated first, recorded so they aren't retried: `buildTerrainChunk` does **not**
swap `DR.runtime.ctx`, and the detail call sites are **not** inside the chunk builder.

### The feature

The ground fill in `buildTerrainChunk` is two lines - `fillStyle = material.base; fillRect(...)` -
literally the "large flat-color tiles" the spec objects to. `drawChunkMacroVariation` now lays a tonal
wash into the chunk layer right after it: darker in troughs, **warmer** in peaks, so sunlit ground reads
warmer rather than merely brighter. Strength comes from `terrain.macroVariation`, unread since V0.20.96.

Low frequency is load-bearing - sampled at 1/9th tile so neighbours differ ~2% alpha. This file already
learned that a flat per-tile fill shows a hard diamond edge (see the depth-darkening buffer's comment).

### Verified - and the instrument finally works

Sampling the **chunk layer canvases directly** rather than the composited screen removes all animation.
Two identical arms return byte-identical statistics, drift **exactly 0.0%**, where screen sampling
drifted 1.269-1.69 mean luma and swamped the signal.

| check | result |
|---|---|
| `drawChunkMacroVariation` calls per rebuild | **6,082** (reverted attempt: 0) |
| mean luma, 4,323 sampled points | 97.72 → **98.34**, exactly reproducible |
| drift between identical arms | **0.0%** |

### Stated honestly

Layer-wide tonal **spread did not increase** (sd 24.551 → 24.511, −0.2%), because that spread is
dominated by material differences - grass vs dirt vs stone - which a ±9% wash cannot move.

The mechanism is proven in the right place and running. It is **not** proven to visibly break up
repetition. That needs an eye, and the strength is one profile value away from tuning.

**Phase 3 is partial.** The atlas-driven layered terrain stack and per-biome decal families remain, and
both must be built inside `buildTerrainChunk` against the layer contexts.

## V0.21.2 - Art Direction Phase 2: The Waypoint Shrine

The spec is explicit: the waypoint *"must be rendered as one authored shrine asset, not a small glowing
puddle."* It lists what it must contain - raised circular platform, concentric rune rings, weathered
masonry, 2-4 ritual pillars, cold blue flames, bright core, vertical beam, drifting particles, grounded
shadow, optional ruined backplate. All of it is now present.

### How this is "authored" without a PNG from an artist

`systems/waypoint-shrine-asset.js` draws the shrine **once** at high detail into an offscreen canvas and
registers it through the authored-atlas pipeline from V0.20.97, with real anchor / occlusionHeight /
contactShadow / emissive / light metadata.

That is how pre-rendered 2.5D assets genuinely work - a source is rendered down to a sprite. The runtime
path is now the **authored** path, not per-frame procedural drawing. When a hand-painted PNG replaces
the bake, only the page source changes; every consumer already reads it as an atlas frame.

It is also the **first real asset through the Phase 10 pipeline** - the only way to find out whether
that pipeline works. It does: registered with 0 errors, 0 warnings.

### Baked vs live

| baked (object-renderer) | live (effects-renderer) |
|---|---|
| platform, 26 masonry blocks, 20 paving wedges | cold blue flames |
| joint rings, 90 grime/moss patches, 12 cracks | bright centre core |
| 4 ritual pillars, ruined backplate arch | vertical beam |
| emissive page: 2 rune rings, 16 glyphs, sigil | drifting motes |

Baking the animated parts would freeze the thing that sells the effect. The bake is deterministic
(seeded), so every build produces an identical asset.

### A double shadow retired

`drawWaypoint` drew its contact shadow **inline** while `waypoint` is also in the shadowSize table added
in V0.20.99 - so attuned waypoints have stood on two stacked shadows since that version. The V0.20.99
probe counted `drawPropContactShadow` calls and structurally could not see an inline one.

### Two measurement failures worth recording

**`object-renderer.js` destructures `ctx` once at install time.** Swapping `DR.runtime.ctx` to a
recording canvas does not redirect it. A probe built that way saw the shrine blit (live ctx) but not the
procedural dais, and reported the fallback broken at 385 pixels. It was never broken.

**A shadow classifier measured itself.** It reported 26 props with doubled shadows - including ones
never touched - by counting `drawPropContactShadow`'s own ellipse as a second shadow.

### Verified

| check | result |
|---|---|
| atlas registration | **0 errors, 0 warnings** |
| colour / emissive page | 36,366 px (35.5% coverage) / 3,082 px |
| frame metadata | anchor (160,268), occlusionHeight 118, contactShadow, light |
| rendered in isolation | 33,647 px, **1.93 tiles wide** |
| both paths on real canvas | draw with light across 4 alternating runs |
| boot suite | PASS - 15/15, 397/397, 1 atlas / 1 frame, 0 atlas errors |
| frames | 20 clean, 0 console errors |

## V0.21.1 - Tile Scale Restored At The True 2:1 Ratio

**136 / 68 / 45**, replacing V0.21.0's literal-spec 96 / 48 / 32.

### The problem with the literal numbers

Measured in V0.21.0 and reported rather than hidden: 96/48 at zoom 1.0 gives a **53.67px** tile edge
against the previous build's **76.21px** - the whole world drawn **29.6% smaller**.

That contradicts the same specification's own requirement: *"Tile footprint: larger visual tiles than
your current low-detail pass."* The document's prose and its numbers disagree. V0.21.0 followed the
numbers and surfaced the conflict; this version resolves it in favour of the prose, because a
high-detail art style whose subject is *further away* is self-defeating.

### What 136 / 68 preserves

| | |
|---|---|
| ratio | **exactly 2:1** - the part of the spec that actually matters (old build: 1.79:1) |
| apparent size | **76.03px** vs the former 76.21px - a **0.24%** difference |
| `ELEV_STEP` 45 | elevation ratio **0.662** vs the spec's 0.667, still far above the old 0.483 |
| zoom | unchanged at the spec's 1.0 / 0.85 / 1.35 |

The taller cliffs introduced in V0.21.0 are kept, not undone.

### Why now

Phase 2 authors the waypoint shrine against a tile scale. Art produced against the wrong one gets
redrawn.

## V0.21.0 - Art Direction Phase 1, Done To Specification

V0.20.96 claimed this phase but deviated on its two hardest requirements. This version implements them
and corrects the reasoning I gave for skipping them.

### The correction first

V0.20.96 refused to change `TILE_W` / `TILE_H` / `ELEV_STEP`, on the grounds that they were
"load-bearing for collision, prop anchors, every authored landmark coordinate and every saved world."

**That was wrong**, and the claim was repeated in the patch notes, VERSION.txt, README and a docs
report. Auditing every read site found 28, and all are projection or presentation:

| file | use |
|---|---|
| `game.js` | worldToScreen / screenToWorld, render-list projection |
| `render/terrain-renderer.js` | isometric basis vectors |
| `systems/render-backend-system.js` | isometric basis vectors |
| `render/entity-renderer.js` | jump-lift offset |
| `systems/fishing-system.js` | cosmetic line-length clamp |

Nothing in collision. Nothing in the save system. Nothing in stored coordinates. The world grid is in
**tile** space; these constants only decide how it projects to pixels. The migration was safe all along.

### What changed

- **96 / 48 / 32** (from 104 / 58 / 28). 96:48 is exactly **2:1**, the classic isometric ratio, against
  the shipped 1.79:1. Cliffs step 32px instead of 28.
- **Zoom 1.0 / 0.85 / 1.35** (from 1.28 / 0.72 / 1.9).
- **Camera is `snap-isometric-4`.** The spec prefers a fixed camera and names snap-4 as the fallback
  "if Q/E rotation must stay." Rotation is established here, so the sanctioned fallback ships.
  V0.20.96's *eight* angles were not on the spec's list at all. `SNAP_ANGLES = 1` makes it fixed.
- **`applyArtDirectionProfile()` is now actually called.** It never was - the profile shipped in
  V0.20.96 and nothing invoked it. It also no longer tries to *write* the metrics the way the spec's
  sample code does; `DR.CONFIG` is frozen, so that assignment would have been silently discarded.
  `core/config.js` is the source of truth and the profile now verifies against it.

### Honest consequence

**The world is ~30% smaller on screen.** Effective tile edge fell 76.2px to 53.67px, a 29.6% reduction.

This contradicts the spec's own "larger visual tiles than your current low-detail pass" - an internal
inconsistency in the document, not an implementation error. Its literal numbers are what shipped.
Restoring the previous apparent size at a true 2:1 needs either `TILE_W 136 / TILE_H 68` at zoom 1.0,
or zoom 1.42 - which exceeds the spec's own 1.35 ceiling.

### Verified

Gameplay preservation is the phase's own requirement.

| check | result |
|---|---|
| worldToScreen -> screenToWorld, 4 fractional points | **exactly 0 error** |
| tile ratio | **exactly 2.000** |
| elevation delta | **exactly 32px** |
| foot-anchor depth ordering | preserved |
| collision (tile-space) | identical, 49/49 walkable |
| profile vs CONFIG drift | **none** |
| camera | `snap-isometric-4`, snapAngles 4 |
| suite | PASS, 15/15, 397/397, 20 frames, 0 errors |

## V0.20.99 - Art Direction Phase 19: Prop Grounding

"They look like they're floating." That complaint was about terrain, but the same fault ran through the
props - a contact shadow is what stops an object reading as pasted onto the map.

### The measurement changed the answer

Reading the source suggested **118 of 141** prop types had no shadow, since only 24 appear in the
`shadowSize` table. That was wrong: many props call `drawPropContactShadow` directly inside their own
draw function and never appear in the table.

Instrumenting the helper and invoking `drawObject` once per dispatch type gave the real figure:

| | |
|---|---|
| types that draw anything | 105 |
| already grounded | **66** |
| genuinely ungrounded | **39** |

Acting on the source-read would have double-shadowed dozens of props.

### 27 grounded, 12 deliberately not

Left alone, with the reason recorded at the table:

- `cave`, `caveExit`, `caveStairsDown/Up`, `dungeonStairs` - **openings in the floor**. A shadow over a
  hole reads as a lid on it.
- `stalactiteCluster`, `flowstoneDrapery`, `heavyWebCurtain` - hang from the **ceiling**.
  (`stalagmiteCluster`, which does stand on the floor, *is* grounded.)
- `miningVein` - embedded in a rock face.
- `fire` - a **light source**. Darkness beneath a flame is backwards.
- `grassTuft`, `flower` - too small; a shadow only muddies the grass.

The landmarks are the point: `townHouse`, `shop`, `well`, `campStall`, `ruinWall`, `ruinPillar` and the
**waypoint shrine** all sat on the ground with nothing under them.

### A pre-existing bug the same probe found

`barrel` was in the table **and** `drawBarrel` called the helper itself with the identical
`(16, 7, 0.24)` - so every barrel drew its shadow twice, stacking to ~0.42 against an authored 0.24.
The table entry was the duplicate and was removed.

Still outstanding, **reported rather than changed**: `giantWebLair` draws 4 contact shadows. It is a
composite lair of several mounds, so that is plausibly deliberate and I could not confirm intent.

### Another dead profile block made live

`drawPropContactShadow` now honours `PROFILE.shadows.groundedProps` and `contactRadiusScale`. Both hold
their existing values, so this is a **no-op by value** - it converts a dead block into a real knob
without changing appearance, continuing the V0.20.98 finding.

### Verified

| check | result |
|---|---|
| grounded prop types | **66 -> 93** of 105 |
| remaining ungrounded | 12, **all intentional, zero unexpected** |
| barrel shadow calls | **2 -> 1** |
| 14 grounded props, pixel-proven | darken ground by peak **8-39 luma**, 42-2743 px |
| 4 negative controls | **exactly 0** darkened pixels |

Pixel-proven rather than call-proven, because a call is not evidence of visible output.

## V0.20.98 - Art Direction Phase 16: Spell VFX Light Pass

### First, an audit finding

Before writing any Phase 16 code I checked who actually **read** the art profile Phase 1 shipped. The
answer was one caller: `applyCameraYawSnap`. `applyArtDirectionProfile()` was never called, and the
`ambient` / `terrain` / `shadows` / `lighting` / `vfx` blocks were read by nothing.

**Phase 1 shipped a file that was ~90% dead** - exactly the "computed in one place, consumed in another"
failure its own header says it exists to prevent. Phase 16 starts by fixing that.

### The change

Additive spell VFX (`lighter` / `screen` passes) draw brighter by `PROFILE.vfx.additiveBoost`, so
localized magic reads as the only real light source. Structural `source-over` drawing is deliberately
untouched - boosting that washes out silhouettes rather than glow.

### Why a context intercept, not a renderer edit

Canvas `globalAlpha` is **absolute, not multiplicative**. A wrapper that sets it before calling through
is overwritten by the first of ~200 branches and does nothing. Editing 200 call sites is the
cascade-patch the golden rules forbid, and would leave every *future* effect needing the same edit.

Shadowing the accessor for the duration of one `drawEffect` call is one place that every branch
respects, including ones not written yet. Verified before writing it: interception works, `save`/
`restore` behaves through it, `delete` restores the native accessor, and it costs ~0.05us per
assignment. Restoration sits in a `finally` - a leaked shadow would boost the whole rest of the frame.

### Two measurement methods I threw away

| method | why discarded |
|---|---|
| whole-scene pixel diff | repeat of arm 1 drifted **20%** - same magnitude as the claimed effect |
| per-arm baseline diff | within-arm spread still **188%**; renderers animate off `this.time` |

Switched to the deterministic op-recording method from V0.20.0: hand the real `drawEffect` an
instrumented context and record the alpha in force at each drawing op.

### Result

| type | additive ops | boost |
|---|---|---|
| wizardElement | 12 | **1.21x** |
| bolt | 5 | **1.18x** |
| casterMotif | 17 | **1.10x** |
| ring | 1 | **1.00x - no gain** |

Effective gain is below the nominal 1.35 because clamping to 1 absorbs the rest.

**`ring` gains nothing**, and with 99 `spawnRing` call sites it is likely the most common effect in the
game. This is *not* a uniform brightening and should not be described as one. Across sampled types,
71.4% of additive ops had headroom (median alpha 0.343).

### Controls

Source-over alpha byte-identical in every arm; additive alpha never exceeds 1; the `boostExempt` list
is honored with a byte-identical arm; `uiPrefs.hdVfx = false` restores original behaviour exactly; the
context is handed back with zero own properties. Perf: **+1.1ms (1.8%) at 120 simultaneous effects**,
arms overlapping, so within noise at a load far above normal.

## V0.20.97 - Art Direction Phase 10: The Authored Asset Pipeline

The contract an artist exports against, plus the loader, validator and diagnostics that consume it -
shipped **before** the art, so commissioned work drops in rather than needing a second migration.

### The format

`systems/authored-atlas-system.js` defines schema `blackroot-authored-atlas-v1`: pages, frames with
`rect` / `anchor` / `occlusionHeight` / `contactShadow` / `emissive` / `light`, and actor animation
groups. `docs/ASSET_EXPORT_SPEC.md` is the artist-facing version of the same contract.

**Deliberately separate from `sprite-atlas-system.js`.** That one indexes sprites *baked from our own
procedural renderers* - it has no anchors, no emissive masks, no occlusion height and no animation
grouping, because a bake of our own output needs none of those. Authored art needs all of them.

### The validator is the point

Every failure it catches is otherwise **silent**:

| mistake | what you'd see without the check |
|---|---|
| anchor not at the foot | prop floats - the exact bug V0.20.94 chased in terrain (warning) |
| anchor outside its rect | prop draws offset, no error at all (error) |
| rect outside its page | samples garbage (error) |
| missing animation frame | invisible until a player happens to face that way (error, keys named) |
| page above 2048 | ~6.6x slower blits - **the V0.20.53/54 revert**, now enforced (warning) |

Registration **refuses** an invalid atlas rather than half-loading it, and the check runs inside
`runValidationSuite` so a bad atlas fails at boot, where the reason is still visible, instead of at
render time.

### Nothing here invents art

No atlas exists yet. `hasAuthoredArt()` returns false, every path degrades to "not available", and the
game renders exactly as it did.

### Verified by negative control

A validator that passes everything is worthless. A valid manifest is accepted with zero errors, and
each of the seven bad cases above is caught with a specific message; warnings stay non-fatal while
errors block registration.

## V0.20.96 - Art Direction Phase 1: Style Profile + 8-Angle Camera Snap

First step of the requested migration to a high-detail dark-fantasy isometric presentation.

### 1. One source of truth for style

`systems/art-direction-system.js` now owns presentation style. Values were previously scattered - wall
shading in `terrain-renderer`, glow alphas in `object-renderer`, particle densities in
`effects-renderer`. **That is exactly how the V0.20.93 shading regression happened:** a value computed
in one place, consumed in another, with nothing tying them together.

The profile carries ambient / terrain / shadow / lighting / actor / vfx knobs plus `artProfileValue()`
for safe lookup, and records the V0.20.89 night-boost **exemption list** so the elements that clip to
white are named rather than rediscovered.

### 2. Camera settles on eight headings

Chosen over a hard fixed-isometric lock so rotation survives as a feature while still permitting
per-angle art later. It deliberately does nothing while `|yawVel| > 0.06`, so turning feels continuous
while the key is held rather than notching between steps.

### Tile metrics deliberately NOT changed

The plan proposed **96/48/32** against the shipped **104/58/28**. Those three numbers are load-bearing
for collision, camera framing, prop anchors, every authored landmark coordinate and every saved world.
Changing them is its own measured migration, not a line in a style profile - so the profile **mirrors
them read-only** and records the target under `proposed` with status `not applied`.

### Scope, stated in the file itself

This defines the target style and the knobs. **It cannot invent art.** Authored sprite sheets, monster
atlases, terrain tile families and UI art are asset production and must come from an artist or a render
pipeline.

### Two plan assumptions already contradicted by this codebase

1. **99MB of baked entity atlas sits on disk from V0.20.53 - reverted in V0.20.54 for being 5-6x
   SLOWER** (4096-square pages blit 6.6x slower than small ones). "Move to atlases" is not
   straightforwardly correct here.
2. The plan's fixed-camera requirement **conflicts with the four versions of terrain corner work just
   completed** for free rotation. Eight-angle snap preserves both.

### Verified

| check | result |
|---|---|
| profile installs and resolves | ok, `artProfileValue` returns values + fallback |
| camera snaps to grid from 0.37 rad | **yaw 0** |
| camera snaps to grid from 2.9 rad | **yaw 3.1416** |
| yaw untouched while turning | ✅ |
| CONFIG tile metrics, before and after apply | **104 / 58 / 28 unchanged** |
| 20 frames render | clean |

## V0.20.95 - Grass Cliff Faces No Longer Crush to Black

A regression I introduced in V0.20.93, reported as black patches in the terrain.

**They were not holes.** They were wall faces rendered at exactly `rgb(0,0,0)` - which on a cleared
canvas is indistinguishable from a hole.

### Measured per material - west face bottom

| material | side luma | before fix |
|---|---|---|
| DEEP_GRASS | 40 | **rgb(0,0,0)** |
| DARK_GRASS | 34 | **rgb(0,0,0)** |
| FOREST_FLOOR | 40 | **rgb(0,0,0)** |
| UNDERBRUSH | 33 | **rgb(0,0,0)** |
| DIRT | 58 | 9 |
| STONE | 84 | 28 |
| RUIN | 81 | 25 |
| CAMP | 75 | 23 |

Those side colours are dark enough that the **pre-existing** `-42` bottom stop already sat at luma 2-5.
V0.20.93's directional offset of `-13.6` on the west face took the remainder.

### Fix

Negative shading is scaled by the material's **headroom** - `luma / 70`, clamped to `[0.42, 1]`.

Stone, ruin and camp compute headroom **1.0** and are byte-identical to before. The dark materials get
proportionally less darkening and lift clear of black. This fixes the regression **and** the
long-standing near-black bottom on grass walls.

### Verified

| check | result |
|---|---|
| darkest material bottom | **0 -> 6-9** luma |
| stone headroom | **1.0** - unchanged |
| perpendicular face contrast | **13-29** - directional lighting still reads |
| live black area, 4 grass-cliff spots x 3 yaws | **24,958 -> 15,697 (-37%)** |

### Honest note

The black that remains is genuine deep shadow at the foot of tall grass walls, not zeroed pixels. The
**missing ground contact shadow** (four failed attempts, documented in V0.20.94) would do more for how
grounded this reads than further shade tuning.

## V0.20.94 - Ashen Valley Terrain Forms Plateaus, Not a Staircase

**The floating look was my generator, not the renderer.**

Two screenshots settled it: one showed a hairline zigzag with isolated blocks at its corners across
nearly flat ground; the other showed a real cliff into water rendering perfectly.

### Measured

| | Dark Woods | Ashen Valley |
|---|---|---|
| elevation edges per 1,000 tiles | **2** | **107** |
| 1-unit steps in sample | 8 | **4,602** |

One elevation unit is **28px** against a **59.5px** tile - nearly half a tile, so every step is a
full-height wall. A **53x denser** field of them is exactly the endless staircase reported as floating
slabs.

### Root cause

```js
elev = Math.floor(basin * 2.6 + n2 * 1.7 + n3 * 0.7 + ridge - 0.95);
//                              ^ scale 14      ^ scale 7   -> flips by one every couple of tiles
```

### Fixed in two parts - the first was not enough, and the measurement said so

1. Elevation now comes from **low-frequency relief only**, plus **three box-blur passes over the
   continuous height before flooring**. Blurring before flooring is what produces broad flat ground with
   occasional real cliffs. **107 -> 67.**
2. The ridge term keyed off **tile type** - and type is chosen from the same n1/n2/n3 noise just removed
   from elevation, so `type === STONE ? 1.35 : 0` reintroduced per-tile churn through the back door.
   Highland mass is now its own smooth field. **67 -> 52.**

n2/n3 still drive tile **type**, where per-tile variation is exactly what is wanted.

### On the remaining number, honestly

52 is still well above Dark Woods' 2 - but **that target was worthless.** Dark Woods scores 2 because it
is **99.5% flat** (31,533 of 31,684 sampled tiles at elevation zero) and has no relief to speak of.

The meaningful measure is unbroken flat ground between steps: **18.3 tiles**, roughly 1,000px. That is a
plateau. One-unit steps fell **4,602 -> 2,038**.

### Verified the zone is unharmed

City plate flat and walkable, all nine subregion anchors reachable within 8 tiles, roads level, waypoint
and road crossing both in place, renders clean at four camera yaws across four locations, highlands
**5.71ms**.

### Not fixed

**Nothing casts a shadow onto the ground at the foot of a cliff.** Four attempts failed, each for a
different reason - all documented in `docs/V0.20.94_ASHEN_VALLEY_TERRAIN_PLATEAUS.md` rather than quietly
dropped.

## V0.20.93 - Cliff Faces Lit by Direction

The actual cause of *"corners don't render correctly at every angle"*.

### What it really was

A zoomed screenshot settled it: **nothing was missing or misplaced.** Every wall face of a raised block
was drawn in the *same flat shade*, so two perpendicular walls meeting at a corner had **zero contrast**
between them - and a stepped stone cliff read as folded paper.

### Root cause

Each face already carried a per-direction shade (`n -28, e -20, s -32, w -38`, set in
`terrainEdgeDefinitionsForTile`) and `tallFaces` faithfully propagated it - but `drawLayeredWallFace`
**never took it as an argument**, building one identical gradient from `def.side` for all four sides.

The value was computed, carried, and thrown away. It *is* used at one other site (an outline stroke),
which is exactly why it looked wired up.

### The fix

The shade is passed in and applied **relative to its set's midpoint**, not absolutely - applying it raw
would have darkened every cliff in the game by 20-38 points - and widened x1.6 so the distinction
survives the vertical gradient layered on top. Both call sites updated, overworld and cave wall.

### Verified

| check | before | after |
|---|---|---|
| perpendicular face contrast | **0** (identical) | **10-19** luminance points |
| face luminance by direction | all equal | e 115, n 102, s 96, w 86 |
| distinct stone shades on screen | - | 20-21 at every 90 degrees of yaw |
| highlands frame time | - | 5.65 / 7.18 ms repeat |
| all zones, four yaws | - | no errors |

### Three wrong hypotheses came first

All measured and discarded rather than shipped:

1. **Yaw-fixed screen corners** - corner tops proved exact to **0.00px** at every yaw.
2. **Per-tile jitter separating shared edges** - `drawLayeredWallFace` uses the passed corner points
   untouched.
3. **"Thin dark seams" varying with angle** - those are the *intentional* contact-darkening and ambient
   occlusion strokes drawn along every face bottom.

After the second, I asked for a zoomed screenshot rather than guess a third time. It took one look.

## V0.20.92 - Corner Walls on Raised Terrain

Reported from a screenshot of the Ashen highlands: notches along the cliff edges where a slope steps
diagonally.

### Root cause, one line

`resolveHalfBlockExposure` opened its corner loop with:

```js
if (!sideFaces.length) continue;
```

That drops any corner exposed **only diagonally** - which is the common staircase case. A tile level with
*both* cardinal neighbours but higher than the diagonal one has no side faces at all, so nobody drew its
corner column.

**Measured:** 433 of 1,579 interior exposed corners in the highlands - **27.4%** - had zero owners.

**Pre-existing, not an Ashen Valley bug.** Dark Woods measures **34.6%** by the same audit and never
showed it, because it has almost no raised ground. Ashen Valley's elevation made a long-standing fault
visible.

### Two measurement errors of my own, caught before they became conclusions

1. A first audit sampling every 3rd tile reported a 50% orphan rate - an artifact, since a corner is
   shared by four tiles and I was excluding three of them by construction.
2. The contiguous rescan still counted corners on the **boundary** of the scan window, whose owners lay
   outside it. All six of my first "orphan" samples sat on that boundary row. Only corners with all four
   sharers inside the window are counted now.

### The fix is scoped to a genuine elevation drop

Allowing *any* diagonal exposure fixed the gaps but raised double-drawn corners **8 -> 16**, because
`isLowerTerrainExposure` is also true for water and cave-wall adjacency, so both diagonal pairs around a
corner could claim it. Restricting to `tileElev > diagonalElev` returns Dark Woods to its baseline of 4
and leaves water corners to the shore pass that already owns them.

**Honest residual:** the Ashen highlands still carry 8 double-drawn corners above baseline - 0.5% of
1,579, a slightly darker seam - against 433 corners that previously had no wall at all.

The rendering consumer needed no change: it already treats a join with fewer than two side faces as the
lighter single column, which is exactly right for a diagonal notch.

### Verified

| check | result |
|---|---|
| elevation corners orphaned, Ashen highlands | **0** (was 433) |
| elevation corners orphaned, Ashen basin | **0** |
| elevation corners orphaned, Dark Woods | **0** |
| double-drawn, Dark Woods | 4 - back to baseline |
| highlands frame time | **6.06 / 6.02 ms** (165 FPS) with 433 extra columns |
| render across highlands, riverlands, Dark Woods | no errors |

## V0.20.91 - Ashen Valley Was Burning 35ms a Frame on an Empty Zone

Found by the agreed "measure before building the city" step, and it justified that decision immediately.

### The baseline came out backwards

| | draw calls | ms/frame |
|---|---|---|
| Dark Woods camp | 3,691 | ~14 |
| **Ashenfall plate, empty** | **738** | **~38** |

Five times fewer draw calls, three times slower. Not draw-call bound - so building a city on it would
have proved nothing.

### Located by splitting the frame

| | update | render |
|---|---|---|
| Dark Woods | 1.44 ms | 4.26 ms |
| **Ashenfall** | **34.88 ms** | 1.31 ms |

Reproduced on a repeat arm (35.71 / 1.36). Stubbing each external system in turn: **fishing, 32.84ms of
a 34.06ms update - 96%.**

### Two compounding faults, same root assumption

Both are the hardcoded-single-overworld assumption that also broke the map label and fog key in V0.20.83.

1. **`zoneKey()` returned `'dark_woods'` for any overworld**, so Ashen Valley inherited Dark Woods'
   ambient fish, whose stored coordinates are dry land here - every fish re-targeted every frame. It now
   returns the active zone, and `activeMap`/`activeObjects` treat any zone without a `parentZone` as an
   overworld rather than testing `zone !== 'dark_woods'`, which had been sending Ashen Valley down the
   **cave** branch.

2. **`findWaterCandidate` clamped its search to `CONFIG.MAP_SIZE` - a constant of 200** that predates
   both the Dark Woods 360 expansion and this zone. On a 450x450 map it searched only the top-left
   200x200 corner, and Ashen Valley's river lies entirely east of x=280. Every fish failed, fell through
   to a full grid sweep, and repeated it next frame.

   **Dark Woods survived the identical bug purely because its creek happens to sit inside its first
   200x200.** That constant has been wrong there for many versions and never showed.

A failed search now sets a 4-second per-zone backoff - that guard is for the zones not yet built.

### Verified

| | before | after |
|---|---|---|
| Ashenfall update | 34.88 ms | **1.93 ms** (18x) |
| Ashenfall whole frame | ~38 ms | **3.69 ms** |
| Ashen wilderness | 43.31 ms | 11.1 ms |
| Ashen riverlands | - | 9.92 ms |
| Dark Woods | - | unchanged within drift |

Fishing still works in **both** zones (both go active on cast), and each keeps its own fish - 34 in Dark
Woods, 10 in Ashen Valley.

**Noted for the content phase:** Ashen Valley has no fish table of its own yet and falls back to Dark
Woods' fish; the spec asks for 6 new ones.

## V0.20.90 - Waypoint Travel Menu

Requested: interacting with a waypoint should open a menu listing every waypoint you know, like Diablo 2.

Until now interacting only **attuned** the waypoint. `travelTargets()` / `travelTo()` had existed as API
since V0.20.80 with **no interface on top**, so fast travel was reachable only from the console. This is
the interface.

### Behaviour

The interact key **attunes on first touch** - discovery must still be earned by standing there, since
spec 5.5 forbids remote unlock - and then opens the list. An already-attuned waypoint goes straight to
it, which is the Diablo behaviour. Escape closes, matching every other panel.

### The list (spec 5.6)

- **Grouped by region.** Diablo groups by act; this is also the structure the zone list needs as more
  regions land.
- **Discovered** entries show name, region and level range, and are clickable.
- **Undiscovered** entries are shown but masked as **???** and disabled - the player knows something
  exists there without being told what, or being able to reach it.
- The waypoint you are standing on is highlighted and reads **"You are here"**.
- **Every disabled button carries its reason as its own label.** In combat it reads *"You cannot travel
  while in combat."* rather than silently refusing - spec 5.7's *"blocked travel must provide a specific
  reason"*, put where the player is actually looking.

Built as a `panel gameWindow` section filled by `innerHTML` - the same idiom the mount and skills panels
use. No new UI framework, and it inherits the existing window styling.

### Verified by driving the real UI, not the API beneath it

| check | result |
|---|---|
| interact key on a waypoint | opens the panel **and** attunes, in one action |
| zone headings | Dark Woods, Ashen Valley |
| undiscovered entries | both masked as **???**, disabled |
| current waypoint | highlighted, "You are here" |
| **clicking** Ashenfall | travels to `ashen_valley`, lands 226,233, closes the panel |
| reopening at destination | Ashenfall now "You are here", other two re-enabled |
| in combat | all travel buttons disabled, reason as the label |
| clicking back | returns to Dark Woods |
| Escape | closes |

## V0.20.89 - Old Waypoint Aura Removed From On Top of the New Waypoint

Reported with a screenshot: a pale blue blob sitting on the centre of the new dais.

**It was not the new art.** It was the `waypointAura` **effect** added in V0.17.51 to give the old flat
grey disc a pulsing glow, ring and motes. Effects render **after** world objects, so it drew straight
over the rebuilt stonework. The V0.20.88 waypoint already draws its own core, pool, rings, beam and
motes - the aura was pure duplication.

### Removed in full

The spawner in `waypoint-system`, the dispatch branch and `drawWaypointAuraEffect` in `effects-renderer`
(3.2KB).

The system now **purges** any `waypointAura` still present rather than creating them. Those effects carry
`life: 1e9` and would otherwise never expire, so a session already running would have kept an orphan on
the dais forever. The purge runs on init and on the same ~1s cadence the old refresh used.

### One behaviour was worth keeping

V0.17.56 item 3 scaled the aura at night so a waypoint reads as a beacon in the dark. Deleting the aura
would have silently taken that with it, so it moved into `drawWaypoint`, off the same world-light
`nightStrength` everything else uses.

**Getting that right took three measured attempts**, each corrected by pixels rather than by eye:

1. Scaling `pulse` did **nothing measurable** (2225 vs 2223 blue px) - `pulse` already peaks at 1, so
   scaling it can only lift troughs. The old aura scaled **alphas**; now so does this, via an `L()`
   helper across 13 light alphas.
2. That worked (**+22.7%**) but brought the blob **back** at full night - saturated centre run went
   **10px -> 25px**, because boosting an already-bright core additively clips it. The core bloom and the
   beam **root** are now exempt, which is exactly the *"capped so it never blows out"* note V0.17.56
   wrote about its own aura.
3. Still 16px. Locating the runs **by position** showed all 7 were at the **dais centre**, not the
   flames - so the core disc's alpha is divided by `nightBoost`, compensating for the boosted pool and
   rings beneath it.

### Verified

| check | result |
|---|---|
| brighter at night | **+33.9%** blue |
| widest saturated centre run, day | **8px** |
| widest saturated centre run, midnight | **12px** |
| aura effects after 330 live frames | **0** |
| injected legacy aura | purged (1 -> 0) |
| renderer still handles the type | **no** (`undefined`) |
| stray effect of that type | renders without throwing |

## V0.20.88 - Waypoint Rebuilt Properly

Reported: *"Thats not even close to the waypoint image i gave you."* Correct.

### How I got it wrong

V0.20.86 was verified with a coarse **58x32 ASCII map** that confirmed dais, braziers, ring, core and
beam were all **present** - and I reported presence as resemblance. A map that coarse cannot show
proportion, saturation or surface detail, which were exactly the three things wrong.

### The measured faults

| fault | measurement |
|---|---|
| far too small | **75px wide** against a ~150px-tall player sprite |
| white blob in the middle | centre saturated to **255,255,255 across 12px** - the core used source-over `rgba(238,250,255,0.95)`, which is white **paint**, not light |
| no readable masonry | rim was a single flat grey |
| no thickness | a flat disc, not a platform |

### Fixes

- Radius **34 -> 58**. Footprint **75 -> 129px wide, 171 tall**.
- The dais has a real **side wall** with vertical joints - a platform, not a disc.
- The rim is **20 alternating fitted block faces** with mortar (**16 distinct shades** measured around
  the arc, up from one).
- Three engraved courses cut into the inner floor, plus 16 rune segments.
- **Every light element is additive with capped alpha**, so the glow blooms over the stone instead of
  erasing it.
- Core is a 4px disc with a 20px bloom. Widest fully-saturated run through the centre: **8px**, down from
  a 12px band.

### Verified against the four named faults, not "is it present"

| check | result |
|---|---|
| footprint >= 110px wide | **129** ✅ |
| no blown-out blob | widest centre run **8px** ✅ |
| masonry readable | **16 rim shades** ✅ |
| real thickness | **15 rows** of side wall ✅ |

Remaining saturated pixels: **138** in the two brazier flame cores and **17** at the beam base - which is
where a hot core belongs.

## V0.20.87 - Dead Lantern Camp Waypoint

Requested: add a waypoint to Dead Lantern Camp.

Placed at **106,105** - just off the south-east road out of camp, **7.1 tiles from spawn** - rather than
inside the hub, because the camp already carries **60 props in a 26x26 box** and a waypoint needs clear
ground to read as a landmark and to be a gathering spot (spec 5.3). Named per the spec's own example
list (5.11).

### Dark Woods is now the first zone with two waypoints, which broke an assumption

Travel was refused whenever the destination's zone matched the player's current zone - *"You are already
in that region"* - so **Dead Lantern and Stone Hedge could never reach each other.**

The refusal is now **per waypoint, not per zone**: you are refused only if you are standing at the one
you picked. `travelToOverworldZone` takes an `allowSameZone` option so intra-zone arrival runs through the
same safety path as any other travel (walkable landing, transition cooldown, cancelled fishing/gathering).
The arrival log is suppressed for same-zone hops, since "You arrive in Dark Woods" reads wrong when you
never left.

### Two placement faults, both silent

1. The ensure ran inside `generateMap` **before `storeOverworldZone`**. Since it targets the `dark_woods`
   slot *by name* (the V0.20.81 lesson), it wrote into the grid the store was about to replace. It ran,
   returned success, and the object was not in the world.
2. Moving it after the store **still failed**, because `ensureStartingCampRevamp` runs later from
   `game.js` and **clears every object inside the camp ellipse** (`clearAndSet` nulls them). 106,105 sits
   at **0.76 of that radius**, so the waypoint was placed and then wiped on every boot.

It is now called from `game.js` immediately **after** the camp revamp, and the redundant earlier calls
were removed rather than left as decoration.

**The pattern is worth naming:** three versions running, a prop has been placed into a grid that
something later discarded, and each time the function reported success. **"Placed" is not "present"** -
verify by reading the world back at boot.

### Verified

| check | result |
|---|---|
| both Dark Woods waypoints at clean boot | ✅ |
| survives character creation (revamp runs again) | ✅ exactly one at 106,105 |
| distance from spawn | **7.1 tiles** |
| detected + attunable | ✅ |
| camp -> Stone Hedge -> camp | both succeed, stay in Dark Woods |
| standing on one | refuses only itself |

## V0.20.86 - Waypoint Visual Rebuilt

Rebuilt from a supplied reference image. The old `drawWaypoint` was a ~24px grey disc with three
scratched lines - unreadable as a landmark, and nothing like the *"large circular stone platform,
engraved runes, rotating inner ring, particle wisps, faint vertical beam, activated rune segments"* the
Ashen Valley spec (5.4) asks for.

### New structure, back to front

Ground shadow -> two-tier stone dais from **16 radial blocks with mortar lines** (what makes it read as
masonry rather than a flat disc) -> engraved rune ring -> **12 rune segments lighting in sequence** ->
two counter-rotating glyph rings -> radial core glow -> vertical beam -> rising motes -> **the two
flanking braziers last**, so they occlude the beam correctly.

Radius **24 -> 34**, so it reads as a landmark.

### The spec's three states

Dormant keeps the full stonework and cut runes but has **no beam, no lit segments, no flame** - still
obviously a waypoint, which 5.4 explicitly requires. Attuned lights all of it.

### The beam is additive, and that was measured

Source-over blue at 0.2-0.3 alpha over brown ground resolved to roughly **(123,119,112)** - visually
grey. It classified as *stone* in the pixel check, not as glow. `lighter` compositing keeps it blue over
any ground, which matters because this same object stands on dirt in Dark Woods and paving in Ashenfall.
Verified on both: **392** and **1176** blue pixels in the beam column.

### A state bug the new art exposed

`obj.attuned` is baked when the world is generated - when there may be no player yet - and
`tryAttuneWaypoint` does not re-set it on the "already attuned" path. **So a waypoint you had attuned
rendered dormant after every reload.** Attunement now reads `player.unlockedWaypoints`, the single source
of truth (Item 9); `obj.attuned` is kept only as a fallback for objects with no id.

Every ellipse radius is clamped at draw time - a negative radius throws and takes the whole frame with
it, the failure that produced a black screen during the silk-critter work.

### Verified by rendering and reading pixels

| | attuned | dormant |
|---|---|---|
| pixels drawn | **4360** | 2655 |
| blue glow | **1278** | 125 |
| bright | **365** | 0 |
| height | **121px** (beam) | 43px |

An ASCII render of the output confirms dais, both braziers, rune ring, core and beam all present and
correctly stacked.

## V0.20.85 - Mini-Map Regression Fixed

Reported: *"Mini Map doesn't work anymore."* A regression I introduced in **V0.20.80** and did not catch
for five versions.

### Root cause

`setActiveOverworldZone` set `this.staticMinimap = null` to force a redraw at the new zone's size - but
**nothing ever rebuilt it**, and `drawMinimap` early-returns on a null `staticMinimap`. The mini-map went
permanently black.

Worse than a travel-only bug: **`resetCharacterOwnedState` calls `setActiveOverworldZone`**, so this
fired for every new character with no travel required. That is exactly the reported screenshot.

### The fix

```js
this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
```

The exact idiom `portal-system.js` already uses - the fallback keeps the previous image if a rebuild
fails rather than blanking the HUD.

### How this should have been caught

**Every other map-swapping path rebuilds the static minimap right where it swaps the map** -
`portal-system`, `combat-system`, `save-system`, `world-serializer`. Mine was the only one that did not.

When adding a code path that does what four existing paths already do, the correct check is to **diff
against those paths**, not to reason from first principles about what the new path needs. That diff would
have taken a minute and saved five versions.

### Verified by pixels, not by the field being non-null

| check | result |
|---|---|
| on-screen mini-map canvas, Dark Woods | **98.3% non-black** |
| on-screen mini-map canvas, Ashen Valley | **98.3% non-black** |
| static image size, Dark Woods | 360×360 |
| static image size, Ashen Valley | 450×450 |
| present at load / after character start / after travel out / after travel back | ✅ all four |

## V0.20.84 - The HUD Zone Line Was Static HTML

Screenshot showed the mini-map panel reading **"Blackroot / Dark Woods · 200×200"**.

**Two faults in one string.** The size had been wrong since Dark Woods was resized from 200 to 360 many
versions ago, and the zone name could never follow the player - because `#minimapZoneLine` is literal
markup with **no JavaScript writing to it anywhere.** Confirmed by grepping every JS file for the id:
zero references. It was decorative text that happened to be true when it was written.

### The fix

`syncMinimapZoneLine()` derives the text from the live zone - product name, the same `mapZoneLabel()` the
zone-map panel uses (so the two can never disagree), and the actual map dimensions.

**Where it is called from mattered, and the first attempt was wrong.** Hooking `drawMinimap` left the
label showing the *previous* zone, because `drawMinimap` ran **zero times across 10 `render()` calls** -
it only fires on certain HUD events, not per frame. Measured, not assumed. It is now driven from
`setActiveOverworldZone`, the only thing that can change the text, which makes it both correct and free.
The write is still guarded by a cached string, so nothing touches the DOM when the text is unchanged.

The stale markup in the HTML was corrected too, so even the first paint is right.

**Note:** the label deliberately uses the literal `'Blackroot'` rather than `DR.DEFAULT_WORLD.worldName`,
which still reads `'Dream Realms'` because it is part of the persisted save schema - using it would have
regressed the HUD branding to the old name.

### Verified

| check | result |
|---|---|
| at boot | corrects stale markup -> **Blackroot / Dark Woods · 360×360** |
| after travel | **Blackroot / Ashen Valley · 450×450**, immediately, no render needed |
| after walking the road | tracks correctly |
| back home | **Dark Woods · 360×360** |
| 30 identical frames | **0 DOM writes** |

## V0.20.83 - Edge Crossings, Correct Zone Naming, and a Save-Corrupting Bug

Reported: the warp should sit at the edge of the map in both zones, and the zone map should not always
say "Dark Woods".

### 1. Edge crossings

| | was | now | from edge |
|---|---|---|---|
| Dark Woods | x=352 | **x=357** of 360 | 2 |
| Ashen Valley | x=34 | **x=3** of 450 | 3 |

Arrivals still land ~11-12 tiles from the opposite crossing, preserving the V0.20.82 anti-bounce offset.

### 2. The zone map named the wrong zone

`mapZoneLabel()` returned a **hardcoded `'Dark Woods'`** for any overworld.

### 3. Fog - the same bug one level deeper

`fogZoneKey()` also returned a hardcoded `'dark_woods'`, so Ashen Valley wrote into **Dark Woods'
exploration memory** - and at Dark Woods' **360** size against a **450** map. That is exactly why the new
zone opened as *"Dark Woods - Explored 0.2%"* with one tiny revealed circle: it was reading another
zone's fog buffer, sized wrong.

### 4. The serious one - and it is a consequence of the V0.20.80 accessor design

`world-serializer`'s `getOverworldMap` / `getOverworldObjects` read `game.overworldMap`, which **since
V0.20.80 means the ACTIVE zone**, not Dark Woods. The save schema stores exactly one overworld, under the
key `dark_woods`.

**So an autosave that fired while standing in Ashen Valley serialised its 450x450 terrain into the save's
`dark_woods` slot, permanently replacing the starting zone.** Confirmed by a clean boot loading a "Dark
Woods" that was 450 wide, with both zone slots holding the **same array object**.

This is precisely the risk the accessor approach carries: existing code that said `overworldMap` meant
Dark Woods, and now means whatever zone is active. Both readers take the `dark_woods` slot **by name**.

### 5. And the damage lives in the save, not in memory

So it survives every reboot. `apply()` now **rejects** a saved overworld whose dimensions are not Dark
Woods' and falls back to procedural generation - losing editor decoration but keeping the world correct.
A wrong Dark Woods is unrecoverable; a regenerated one is not.

### Verified

| check | result |
|---|---|
| guard vs the actually-corrupted 12MB local save | **rejected** with a specific reason, Dark Woods regenerated at 360, crossing intact |
| serialise **while standing in Ashen Valley** | writes Dark Woods' **360x360** |
| zone map label | "Ashen Valley" there, "Dark Woods" at home |
| fog keys | separate; Ashen Valley buffer sized **450** |
| crossings from edge | 2 and 3 |

## V0.20.82 - Through the Treeline

Reported: there needs to be a path that **exits** the Dark Woods into Ashenfall, with the new zone
lying beyond the dense tree border.

### Root cause

`ensureDarkWoodsTreeWallBoundary` rings the entire 360x360 map in impassable boundary trees - every tile
within 4 of the edge is blocked, elevated, and given a `boundaryTreeWall` object.

The V0.20.81 crossing sat at **x=344 - fifteen tiles inside that wall.** It read as a signpost standing
in the woods with the treeline unbroken behind it. A teleport pad in the forest, not an exit.

### The gate

The road is now carved from inside the forest **through** the wall to the map edge (x=326 to x=359 at
y=249-251), clearing both the blocked tiles **and the `boundaryTreeWall` objects** - leaving the objects
would have kept the gap impassable no matter what the tiles said.

- **3 tiles tall** - a track, not a boulevard.
- The wall above and below is **verified still intact**, so the map is not simply opened up.
- Two standing stones frame the mouth so it reads as a deliberate opening.
- Ordering is safe: this runs late in `generateMap` and again on world load, so it cuts into a wall that
  already exists rather than racing it.

### Walking through now travels

A zone border you must press a key at reads as a signpost, not a way out. `zone-link-system` gained an
`update()` that triggers on proximity. Two guards against the corridor loop the spec's validation list
calls out:

1. `zoneTransitionCooldown` - already ticked by `game.js`, and used by the cave system for exactly this.
2. **Arrival points moved ~10 tiles short of the opposite crossing.** Previously each link's arrival was
   the other link's *exact tile* - which, with walk-through triggering, would have bounced the player
   between zones forever.

The E interaction is kept as well.

### One bug found in testing

The gate markers **silently placed nothing**: the guard only allowed replacing empty ground or boundary
trees, and a flower and a mushroom happened to occupy those two tiles. Decor now yields; authored props
do not.

### Verified

| check | result |
|---|---|
| road continuous x=330 -> map edge x=359 | **no blocked tiles** |
| treeline intact 4 tiles above / below | ✅ both |
| gate markers | placed |
| walk EAST, no key presses | crosses at **(44.5, 300.5)** into Valley Farmland |
| stand still after arrival | **no bounce back** |
| walk further inland | no re-trigger |
| walk WEST | returns to **Gloamroot Depths (340.5, 250.5)**, walkable |
| idle after return | no bounce |

## V0.20.81 - The Road to Ashen Valley

Asked directly whether Ashenfall was connected to Dark Woods. **It was not - and worse, it was
deadlocked.**

### The deadlock

Fast travel requires the destination waypoint be **discovered**; discovery requires standing beside it;
standing beside it required **already being in Ashen Valley**. Measured on a fresh character:

```
REACHABLE_BY_NORMAL_PLAY: false
legitimateRoutes: []
```

Nothing in Dark Woods referenced the zone - no border, no entrance, no neighbour data. Only
`debug.travelZone()` reached it.

So V0.20.80's "you can travel to it" was **true for me and false for a player**. I verified the travel
*mechanism* and never asked whether a character could invoke it.

### The fix

`DR.ZONE_LINKS` defines the walked routes; `systems/zone-link-system.js` owns the interaction (mirroring
the waypoint system rather than inventing a second idiom); the world generators place the crossings.

- **Dark Woods side:** far east, ~157 tiles from the start point - inside **Gloamroot Depths (levels
  7-10)**, a real difficulty step into a level 10-20 region, not somewhere a level 3 character stumbles.
- **Ashen Valley side:** **Valley Farmland (levels 10-12)**, joined by road to the city.
- The waypoint is **not gifted** - the spec forbids remote unlock, so you walk there and attune it.
- **Symmetry is asserted:** every link has a return leg, or a player can walk somewhere they cannot walk
  back from.

### Four more bugs, each found only by walking a fresh character through it

1. **Placed before the object-pruning pass.** `normalizeOverworldCollisionAndDensity` removed it - road
   carved, interactable silently gone. Moved after it, where the herbs already sit for the same reason.
2. **Did nothing on any existing save**, because a saved world bypasses `generateMap` entirely.
   Re-ensured on world load, exactly as the shipped catalogs are merged rather than replaced.
3. **Even then it did nothing**, because it operated on `this.map`/`this.objects` - and during a world
   load the zone grids are populated *before* the live map is assigned. It ran, found nothing, returned
   0. Now targets the `dark_woods` slot **by name**. Same shape as the waypoint nearly placed in the
   wrong zone.
4. **The interaction system registered but was inert.** `installExternalSystems` only stores the
   returned runtime and never calls `init()`; each system calls its own, and this one did not.
   `game.zoneLinkSystem` was never assigned, **with no error anywhere**.

### Verified end to end

Fresh character, no waypoints, no debug: walks to the crossing in Gloamroot Depths -> crosses to Valley
Farmland on walkable ground -> attunes Ashenfall (**deadlock broken**) -> walks the return road home ->
fast travel then **ALLOWED** both ways. Crossing present on the existing 12MB world save. Combat blocks
the road with a reason. Every link has a return leg.

## V0.20.80 - Ashen Valley Phase 1: a Second Overworld Zone

Roadmap Item 26. The zone exists and is reachable; the city, mobs, items, quests and the Crypt are
later phases.

### The game had exactly one overworld

`game.overworldMap` / `overworldObjects` / `overworldEnemies` were plain fields holding Dark Woods, and
`portal-system.js` restores the overworld with a literal `this.map = this.overworldMap`. A second
walkable region had nowhere to live.

**Why this is not a cascade patch.** Those three names have **~70 call sites across 20+ files - but only
eight are writes.** Renaming them to a keyed collection would have meant editing all 70. Instead
`core/overworld-zone-registry.js` turns them into **prototype accessors** onto the active zone's slot:
every existing read works unchanged, every existing write lands in the active zone, and switching zones
is one assignment.

They are installed **first** in `game.js`, before `new Game()` - the constructor assigns all three, and
an assignment with no setter present would create own properties that permanently shadow the accessors.

### What ships

- `ashen_valley`, **450x450**, levels 10-20, with **nine subregions**: Ashenfall City, Valley Farmland,
  Ashen Riverlands, Ashwood Forest, Sunken Marsh, Old Ruins, Rocky Highlands, Abandoned Mine, Abandoned
  Cemetery.
- Terrain in `systems/ashen-valley-world-system.js` - river spine, marsh, highlands, ruins, forest, a
  flattened city plate, roads to every subregion. Uses the **exact** `{type, elev, blocked, waterDepth}`
  contract Dark Woods uses, so collision, pathfinding, swimming, fishing, minimap and the renderer work
  on it with zero changes.
- **Lazy generation** - 202,500 tiles is not worth paying at boot for players who never travel. 42ms on
  first entry.
- **Fast travel.** `waypoint-system.js`'s own header set the condition: *"with exactly one waypoint in
  the game so far, a fast-travel menu would have nowhere meaningful to travel between yet."* There are
  now two. Discovery is per character, undiscovered destinations are refused, every refusal has a reason.
- `activeOverworldZoneId` saved, restored and reset.

### Four bugs found by testing, all mine

1. **The Ashenfall waypoint was nearly placed in Dark Woods.** `Game.placeObject` writes to
   `this.objects` - the *active* zone - and Ashen Valley is generated while Dark Woods is still active.
2. **A new character inherited the previous character's zone**, and would have started at level 1 in the
   level 10-20 region. Same belongings-leak shape as the V0.20.2 mount bug.
3. **That fix initially set only the zone ID, not the live map** - leaving a fresh character on Ashen
   Valley's 450x450 terrain while every readout said `dark_woods`. Nastier than the original, because it
   looks correct from outside.
4. **Subregions were authored largest-first.** Box regions are tested in array order, first match wins -
   so Sunken Marsh was entirely hidden behind Ashen Riverlands, and Abandoned Mine behind Ashwood Forest.
   Neither could resolve anywhere. Now ordered smallest-area-first.

### Verified

| check | result |
|---|---|
| accessor shadowing | none |
| Dark Woods through accessors | intact, 360x360, unaffected by generating another zone |
| travel both ways | ok, arrival walkable |
| all 9 subregions | own real **walkable** territory, **zero occluded** (swept every 2nd tile of the entire zone) |
| new character | resets to Dark Woods 360x360 |
| Ashen Valley save | restores to 450x450 |
| legacy save, no zone field | lands safely in Dark Woods |

Suite ok, 397/397, 15/15, 0 compiler errors, 0 console errors.

## V0.20.79 - Mount Speed Ladder: the Floor Was Too Low to Feel

Reported: *"the mount speed doesn't seem to be faster than walking at all."*

### Not a bug

Worth stating plainly, because the instinct was to go hunting for a broken multiplier. Measured through
the **real movement call** (`tryMoveActorSubstepped`, the same path `game.js:2989` uses):

| | tiles/sec | ratio | authored |
|---|---|---|---|
| on foot | 2.1283 | - | - |
| Black Wolf | 2.4262 | **1.140** | 1.14 |
| Thorn-Crowned Stag | 3.9373 | **1.850** | 1.85 |

Drift 0 on a repeated control arm. The multiplier reaches the world exactly.

### The problem was the authored value

The starter was set to **1.14** to honour *"a little slower than normal tamed mounts"* (tamed floor was
1.18). That works out to **+0.298 tiles/sec - one extra tile every 3.4 seconds.**

Compounded by `PLAYER_WALK_SPEED_SCALE = 0.5` from V0.20.47, which halves walk speed **before** the mount
multiplier applies, so every mount's absolute gain is half what its percentage suggests.

### The new ladder

| mount | before | after |
|---|---|---|
| Black Wolf | +14% | **+40%** (still slowest) |
| Crystal Crawler | +18% | +45% |
| Webling Skitterer | +25% | +50% |
| Cave Bat | +28% | +55% |
| Briar Boar | +32% | +58% |
| Thorn Widow | +38% | +62% |
| Old Tusk | +40% | +66% |
| Gloom Wolf | +45% | +70% |
| Mossfang Alpha | +62% | +76% |
| Hollow Stag | +70% | +80% |
| Thorn-Crowned Stag | +85% | **+85% unchanged** |

Starter's gain: **+0.30 -> +0.85 tiles/sec**.

`PLAYER_WALK_SPEED_SCALE` deliberately left at 0.5 - the halved walk speed was itself a request, and
raising it would change all travel rather than just riding.

**Invariants preserved:** the Black Wolf is still the slowest mount and still below *every* tamed mount,
so taming keeps its purpose; the ceiling does not move. No hardcoded copies of these numbers exist - the
mount panel derives its "Speed +N%" label from `speedMult`, so the UI followed automatically.

**Verified:** all 11 measured ratios match their authored multipliers to within 0.02, drift 0.

## V0.20.78 - The Tail Draws Over the Rider, and Both Seats Match

Reported: *"the tail should be rendered on top of the player. Their legs should have the same position as
the front view."*

### The tail

The rear band was a shallow 14px strip that stopped at the rider's knee, so the tail stayed behind them
entirely. It now runs down past the legs exactly as the front band does (`bandBottom = riderFoot + 4`).

This makes the two views **symmetric**: from the front the rider's legs straddle the animal's **head**,
from behind they straddle its **tail**.

### The seat

`kneeOut`/`footOut` were 27/31 in front and 17/19 behind; both are now **27/31**. The narrow rear seat
existed only because the old rear band was a thin strip - with the band running past the legs, a narrow
seat sits *inside* it and is swallowed. `frontOn` became unused as a result and was deleted rather than
left dangling.

### Width is bounded by the rider, not the animal

This is the one place the two views legitimately differ. Seen from behind the rump is inherently wide -
the black wolf's is **131-139px** across - so there is no narrow "head" band to fall back on.

Measured, the unbounded band came out **147px and buried the rider's left leg**: that zone fell from
**92.6% to 63.2%** non-animal pixels. It is now clamped to **+/-27**, just inside the **+/-31** foot splay
in `buildRidingRig`. Keep those two numbers in step.

### Verified - A/B on the live canvas

| zone | overlay off | overlay on | |
|---|---|---|---|
| strip between the legs | 7.7% animal | **84.4%** | tail draws over ✅ (drift 2.0) |
| left leg | 91.4% | 86.2% | survives ✅ |
| right leg | 68.8% | 65.7% | survives ✅ |
| rider's back | - | 4.9% dark / 92.6% gold | clean ✅ |

Back and front seats now report identical feet at **+/-31**; side-on unchanged at 8,16. All 11 rear bands
sit within the leg line.

**Not verified:** both stags' rear bands measure only 24-25px and sit left of centre, because their rump
silhouette at those rows does. The wolf is the one confirmed by pixels.

## V0.20.77 - Front View: the Rider's Lower Body Goes Behind the Mount

Reported: *"the lower body should be hidden behind the mount's head and upper body."*

**Measured first**, via an ASCII colour map of the live canvas:

| | dy |
|---|---|
| rider's lower body (solid white block) | **-58..-31** |
| rider hip / foot | -51 / -26 |
| overlay band ended at | **-53** |

The band stopped precisely where the lower body begins, which is why it was fully visible.

**Fix.** Facing the camera the band now runs from the head down past the rider's legs
(`bandBottom = riderFoot + 4`), so the head *and* chest do the occluding. Extending is safe by
construction: the band only clips a **redraw of the mount**, so it can paint the animal's own chest and
can never reveal background.

**Width comes from the head and chest rows only.** Sampling the whole band swept in the angled flank -
the black wolf jumps from **81px** wide at dy -56 to **142px** at -53 - producing a 152px box that buried
the rider's legs too, the very thing V0.20.72 splayed them to +/-31 to avoid. Head+withers gives **90px**.

A clamp against the head span was built and then **removed**: measurably inert, byte-identical widths on
all 11 mounts. Dead complexity of exactly the kind deleted in V0.20.75.

### Known, and deliberately not touched

The boars get much wider front boxes (briar boar **141px**, old tusk **202px**) because the shoulder
detection **never fires** for them - their skull merges straight into the shoulders, so `headWidth * 1.9`
is a threshold the silhouette never crosses (old tusk: probe 106, threshold 201, actual max 182) and
`shoulderY` falls back to 42% of height. **Pre-existing, not introduced here.** For a boar that width may
well be correct, since the rider's legs sit behind its bulk anyway. It needs eyes on a boar mount first.

### Verified - A/B on the live canvas

| zone | overlay off | overlay on | |
|---|---|---|---|
| rider lower body | 59.0% white | **0.7%** | hidden (drift 0.0) |
| rider upper body | 36.6% | 33.8% | untouched |
| rider right boot | 13.7% | 13.0% | survives |

## V0.20.76 - The Overlay Is Measured at the Facing It Is Drawn At

Reported: front view still has a slight clipping issue; the back view still shows the head; side-on still
shows the whole chest and both arms.

### Root cause - a bug class hit four times

`mountOverlayBox` probed the beast at a **canned** facing (straight south for front, straight north for
rear) while the game draws **diagonals**. Black wolf, measured:

| | head centre | head width |
|---|---|---|
| probed `south` | dx **-11** | 64px |
| drawn `southeast` | dx **+33** | 43px |

The clip rect sat **44px left of the real head** - clipping one side of it and repainting blank canvas
across the rider's chest. `mountOverlayBox` now takes the entity's real facing and caches per quantised
heading.

This is the same probe-vs-draw mismatch as **V0.20.65** (animal facing), **V0.20.69** (riding pose
reaching the model) and **V0.20.73** (which seat the rider adopts). Fourth occurrence - fixed at the
measurement rather than per symptom.

### The x1.55 stretch is removed

It existed only to reach a muzzle the mis-aimed box appeared to be cutting off. With correct measurement
it was pure over-reach, running to **-39** against a head ending at **-61** and repainting the animal's
neck across the rider's thighs - the reported "slight clipping". Box is now the measured head plus a 9px
jaw pad: **-86..-53** against a head at **-83..-61**.

### Side view - half the body

`buildRidingRig` kept `shoulderW`/`hipW` at full breadth side-on. V0.20.74 moved the **hands** to the near
side but the chest still read face-on with an arm on each edge. Spans now compress to **0.46** side-on:
**7.6-11.5 vs 22** front (35-52%). The standing rig always did this via its own `sideCompress`; the riding
rig never did.

### Measurement - the first version whose render claims come from real pixels

Sampling had failed silently since V0.20.71. The world camera transform is applied to the **context**:
`foot (670,633)` maps to canvas **(482,456)** under `a=d=0.9216, e=-135.07, f=-127.61`. Every window aimed
with `worldToScreen()` or the raw `foot` argument missed the character by ~190px and returned near-zero
with the change both ON and OFF - which reads like "no fault" but means "not sampling the character".
Wrapping the draw call to capture `ctx.getTransform()` fixed it.

**Verified by A/B on the live canvas:** the front overlay adds **+43.4%** black inside the head zone and
only **+2.6 / +1.7** above and below it (both within measured drift). The true back heading reads **5.6%**
black and **90.9%** gold in the rider's torso band - no head.

## V0.20.75 - The Rear Overlay Anchors to the Back Line

Reported: from behind, the black wolf's head renders across the rider's back.

**Root cause.** The rear branch of `mountOverlayBox` measured a band downward from `top`, the topmost row
of the silhouette, on the assumption that from behind the near mass is the rump. It is not - **the topmost
mass is the head from every angle, including from behind.**

| dy | width | |
|---|---|---|
| -84 -> -52 | 21 -> 44 | the skull |
| **-48** | **71** | shoulders / back begins |
| +8 | 89 | haunches (widest) |

The box covered **-90..-49**: the head, almost exactly.

**Fix.** Anchor to the **back line** - the first row where the outline widens to `maxW * 0.6` - so the
band can never start on skull or neck.

### Two wrong turns, both discarded on evidence

1. **Anchoring to the saddle height.** Rejected: the saddle is measured from a *side* view, and at that
   height a *rear* silhouette is still neck and skull. It produced a box at **-64..-40** against a head at
   **-84..-52**, reintroducing the reported bug.
2. **Restricting the width measurement to the lower half** so antlers could not skew `maxW`. I claimed
   this was what fixed the stags, then tested it: **it is not.** `bodyMax` and `wholeMax` select the same
   anchor row on all 11 mounts - a stag's antlers are not wider than its ribcage in a rear silhouette. The
   dead code and the comment asserting it were both removed.

What actually corrects the stags and arachnids is the **pelvis clamp**: on both stags and all three
arachnids the back line sits *above* the rider's pelvis, so the band landed across the **chest** - the
wrong half. `backY` is clamped to the saddle lift.

Depth is **14px**: the foot sits only ~20px below the back line and the legs already looked right, so the
haunch laps thigh and knee while shin and foot stay clear. A null guard covers the case where the band
catches no pixels, so a garbage clip rect can never be used.

**Verified on all 11 mounts:** every box starts at or below the back line, contains real body pixels, laps
hip-to-knee, spares the foot, spares the chest. **Negative control:** re-injecting the old top-anchored
rule fails the check (wolf -89, stag -133, both above their back lines).

## V0.20.74 - Side-On Arms + Full Head Forward

Two follow-ups from screenshots.

### 1. Arms splayed in every view
`buildRidingRig` placed both hands left and right regardless of view. Side-on, the far arm reaches across the rider's own body and belongs **behind the torso** — showing both was the remaining "sitting sideways" tell after V0.20.73 fixed the legs.

Both hands now sit on the near side (near `nearSign*13`, far `nearSign*5` and 2px higher). The `camView`/`frontOn`/`sideOn` resolution was **hoisted above the arm block** — it previously sat below it and was only available to the legs.

### 2. The head box stopped at the shoulders
`mountOverlayBox` ended the head at the shoulder-widening row, but **the muzzle hangs below that line**. Measured silhouette profile for the black wolf:

| dy | width |
|---|---|
| −88 → −60 | 23 → 41 (**the head**) |
| −56 | **67** (body begins) |

The box stopped at −54, so the lower head was still behind the rider. Height is now ×1.55, covering **dy −91 to −34**.

Over-reaching is safe by construction: the box only clips a redraw of the **mount**, so a taller box can reveal more of the animal's own front and nothing else.

### Known limitation, recorded honestly
I still cannot pixel-verify the on-screen result. **`worldToScreen()` does not return the same space `drawEntity` draws in** — the world camera transform is applied inside — so every sample window I aimed with it landed off-target. A head-band probe returned **zero** dark pixels with the overlay both on *and* off, which is what finally exposed the sampling error rather than any render fault.

Geometry, call rate and rig anchors are all verified; the visual result is yours to confirm.

### Verified
Head box covers the full measured head (dy −91..−34 vs head at −88..−60, saddle −56) · side views (east **and south**, which projects to side) put both hands at 5,13 and both feet at 8,16 · front keeps hands −8,14 and feet ±31 · back keeps hands −14,8 and feet ±19.

## V0.20.73 - Riding Pose Per Camera View

**Reported:** side view looks like the rider is sitting sideways; back view needs the mount's lower back and tail over the rider's lower body.

### Root cause — a parity bug, again
`buildRidingRig` chose its leg layout from `d.view`, which is **compass**-derived from `facingName`. The mount overlay used `entityFacingView`, which is **camera-projected**. They disagree — world `south` projects to a **side** view on screen — so heading south handed the rider the wide camera-facing straddle *while side-on*, which is exactly the reported "sitting sideways".

Same trap as the mount facing in V0.20.65, now closed in the rig too: `entity-renderer` publishes `e._cameraView` and `buildRidingRig` prefers it over `d.view`.

### Side view — one leg
Both legs now sit on the **near** side (near foot `nearSign*16`, far foot `nearSign*8`, far leg tucked higher and behind), so it reads as one visible leg with the far one glimpsed past the barrel rather than legs sticking out both ways.

### Rear view — the rump laps the rider
`mountOverlayBox` generalised: `front` measures the **head** (top mass down to the shoulder widening), `back` measures the **rump** (top of the back through the upper third, kept shallow so it laps the pelvis without burying the legs — the report said those already looked right). The overlay redraws that region after the rider for front *and* back; side-on nothing is nearer than the rider, so it returns early.

### Verified across 6 headings

| heading | camera view | legs | overlay |
|---|---|---|---|
| east / west / **south** / **north** | side | both one side (8,16 / -16,-8) | skipped |
| southeast | front | ±31 splayed | head redrawn |
| northwest | back | ±19 | rump redrawn |

## V0.20.72 - Front-Facing Mount Head Draws Over the Rider

Reported: the rider's lower body still hides the mount's head.

### Two approaches tried

**Rejected — cutting a hole in the rider.** Clipping the rider with an even-odd hole across the head box was the literal reading of "hide the lower body". Working it through killed it: the head's silhouette is **rounded** and a clip hole is a **rect**, so the corners would have shown the *ground straight through the character's chest*. Geometry also showed the hole spans y −91..−54 — the rider's **torso** — while the legs sit at y −27, so it would have cut the wrong body part anyway.

**Shipped — draw the head over the top.** The mount is drawn a second time after the rider, clipped to the measured head box. Painting can only ever *add* the animal's own pixels; it can never reveal background.

Plus `buildRidingRig` now **splays the legs wider in front views** (knee 17→27, foot 19→31) so they sit either side of the head rather than in front of it. Side and rear views keep the narrow seat, where a wide splay would just look bow-legged.

### The test harness was broken, and I proved it rather than assuming

Earlier A/B diffs were worthless. The canvas is `{alpha: false}`, so counting "pixels with alpha > 0" returns **100% always** — the metric was meaningless. Re-tested by filling the canvas magenta and re-rendering: **14400 magenta → 0**, so `render()` does repaint on demand and a frozen-time A/B is valid in principle.

A later `overlayCalls: 0` turned out to be **leftover state** — the mount was not actually mounted that run — not a code fault.

### Verified
`mounted: true` · `entityFacingView: 'front'` · `mountLift: 56` · head rect resolves · overlay fires **exactly once per frame** (3 calls / 3 frames).

Pixel-diffing the full scene remains unreliable because effects use `Math.random` per frame, so **the final look is yours to judge**.

## V0.20.71 - Black Wolf Starter Mount + Wolf Palette Resolver Fix + Front-Facing Head Layering

### The black wolf
Added a `black` coat to `wolf-procedural-model` `BASE_PALETTES` (the module that owns wolf colouring) and a `blackWolf` entry to `DARK_WOODS_MOB_VISUALS` — a **real authored visual key**, the same way `mossfangAlpha` and `thornCrownedStag` are, so the mount references real art rather than an invented creature (Item 7.J).

`mount_black_wolf` replaces `mount_camp_packbeast` as the vendor starter; the Drover's Whistle now calls it. **Speed 1.14x is the slowest in the game** (tamed range 1.18-1.85x), so it gets a level-1 character moving without making taming pointless.

### Bug found doing it: wolf coats were unreachable by name
`resolvePalette()` was a hardcoded if-chain — mossfang / cave / dire / else gloom — that **never consulted `BASE_PALETTES`**. The new coat rendered identical to gloom: measured avg RGB **51,60,59 for both**.

Exactly the failure shape as the atlas `inferModelId` chain: *a lookup table that the lookup ignores.* Fixed with a lower-cased name index consulted first, heuristics kept as fallback.

**Measured after:** black luminance **29** vs gloom **57** vs mossfang **85**, with gloom and mossfang unchanged. Any coat added later now works with no code change.

### Front-facing head layering
`drawRiddenMountHeadOverlay` re-draws the mount clipped to its head region **after** the rider, but only when `entityFacingView` reports the `front` view — from behind or side-on the head is not in front of the rider. The head box is **measured** per mount from its front-facing silhouette (top of the mass down to where the outline widens at the shoulders) and cached, because the beasts are different shapes.

### Verification status, stated honestly
**Geometry checks pass:** the head box holds **1063 mount pixels** (well placed, not empty), the rider's body band (y108-174) genuinely overlaps the head band (y139-176), and the overlay is confirmed called once per frame only when front-facing.

**The pixel A/B was inconclusive.** With live time the world animates between captures; with time frozen the second render appears to be skipped — a 0-pixel diff either way. So the layering is geometrically sound and confirmed to run without regression, but **not yet proven by a before/after image**. Your eyes are the check that settles it.

## V0.20.70 - Purchasable Starter Mount

**The gap:** every mount had to be **tamed**, and even the cheapest entry point needs level 3, bait that drops in the woods, and a beast beaten below its threshold. A level-1 character had **no route to a mount at all**.

**Added:** `item_drovers_whistle` — a 120-silver consumable sold by the camp quartermaster — grants `mount_camp_packbeast`, a camp-broke pack boar.

### Three constraints, each enforced rather than assumed

1. **`beastKey` must name a real authored mob** (Item 7.J). The pack boar reuses `briarBoar` — the same species, broke to harness. No invented creature.
2. **It must not shadow the tameable wild Briar Boar.** `MOUNT_BY_BEAST_KEY` now indexes only mounts that *have* a taming block, so `briarboar` still resolves to `mount_briar_boar`. Verified by taming a wild boar afterwards and receiving the wild mount while keeping the vendor one.
3. **Buying must not advance taming rank.** `tamedCount()` now counts only mounts with a taming block (new `ownedCount()` covers the collection total). Result after buying one and taming one: **owned 2 / tamed 1 / rank Novice Handler**.

### Plumbing
The use-effect goes through `mountSystem.unlockMount` via a new `unlocksMountId` branch in `item-compiler-system`, so a bought mount is recorded, saved and displayed exactly like a tamed one — **no second ownership path**. The bait validator skips mounts without a taming block. The panel shows *"Sold by the camp quartermaster"* for a locked vendor mount instead of taming requirements.

### Balance
120 silver is the dearest item in the camp shop (iron breastplate: 84), and the pack boar is the **slowest mount in the game** at 1.18x versus 1.32x for a tamed briar boar — a starter, not a shortcut.

### Verified
Item exists and is listed in the camp shop · using the whistle unlocks the mount · a second use is refused · a level-1 character rides it at 1.18x · wild briar boar taming still grants `mount_briar_boar` · panel shows 11 rows with *"Bought from the quartermaster · Dead Lantern Camp · level 1"* · suite ok, **items 397/397**, 0 bait issues.

## V0.20.69 - Riding Is a Real Posture (two root causes)

Reported: *the character stands on top of the mount.*

### Cause 1 - the pose never reached the model
V0.20.65 added the riding pose to `getStandingPuppetPose` / `drawStandingLegs` in `entity-renderer.js`. Instrumenting proved the player calls **neither** — **0 calls on foot and 0 mounted**. The Paladin renders through the bespoke class-identity model, which builds its pose from `HumanoidAnimationSystem.buildPose` instead.

**Fix, in the right place:** `ride` is now a **first-class action** in `resolveAction` (beside swim/sit/jump), carrying `rideGait`/`rideMoving`, and `humanoid-base-renderer` gains **`buildRidingRig`** alongside `buildSittingEmoteRig` / `buildSwimmingRig` — thigh out across the barrel, shin down the flank, hands forward on the reins. Because it is a rig, **all 14 classes inherit it from one place**. The bespoke Paladin/Fighter models let `ride` fall through to the shared renderer exactly as they already do for `dance` and `sit`.

### Cause 2 - a fixed seat height on animals of wildly different heights
`drawRiddenMount` lifted the rider a flat `26 × scale` (~29px) for **every** mount. Measured back lines:

| mount | back above anchor | old lift | error |
|---|---|---|---|
| Dusk Bat | 38px | 23 | -15 |
| Crystal Crawler | 47px | 29 | -18 |
| Gloom Wolf / Briar Boar | 63px | 29 | **-34** |
| Hollow Stag | 95px | 29 | **-67** |

A wolf rider sat **34px below the animal's back** — precisely why the character read as standing in front of it.

**Fix:** `mountSaddleHeight()` renders the beast once offscreen, samples the topmost pixels in a band across the **saddle area** (the overall top is the head or antlers, not the part you sit on), sinks 5px into the back, and caches per `beastKey+scale`. **0 re-measurements across 30 frames.** Measuring beats authoring a number per mount — it cannot drift when art changes.

### Third bug, found by checking all 14 instead of the one in the screenshot
**Bard and Druid still stood.** Their models pass an **explicit** action via `renderActionForHumanoid`, which overrode the derived `ride`. Added the mounted check there too.

### Verified
14/14 classes resolve `ride` via both derived and explicit paths · rig geometry hip(-5.8, 3.2) → knee(-17, 10.2) → foot(-19, 28.2) (knees splayed, feet below knees) · Paladin silhouette **157px → 124px** when mounted (a seated figure) · every mount seats with hips on the back line and feet hanging below · `rideGait` varies frame to frame · dismount returns cleanly to `idle`.

## V0.20.68 - Mount/Taming Debug Tools (Roadmap Item 23)

Asked for a test mount "here and now". Rather than a throwaway console snippet, these are the tools Item 23 already specifies — *"unlock mount", "remove mount", "spawn beast", "start taming attempt"*. The file's own header and `help()` previously said the mount tools *"arrive with those systems"*, which became untrue the moment Item 7 landed in V0.20.64; both were corrected.

### Added

| command | does |
|---|---|
| `debug.mounts()` | list every beast: level, rank, bait, owned |
| `debug.unlockMount(id?)` | grant one mount, or **all** if omitted |
| `debug.removeMount(id?)` | remove one, or clear the stable |
| `debug.spawnBeast(beastKey)` | spawn a pre-weakened beast and target it |
| `debug.giveBait(beastKey?, qty=3)` | grant the bait a beast wants |
| `debug.tameTarget()` | begin an attempt, or say why not |

### Routed through the owning systems
`unlockMount` calls `mountSystem.unlockMount`, so a debug grant is **indistinguishable from a legitimate tame** and cannot produce a save state the game could not have created itself — Item 23's safety rule.

`spawnBeast` pushes to **both** `game.enemies` and `game.entities` (a runtime spawn missing from `entities` is AI-active but invisible).

### Tools that explain themselves
`tameTarget()` returns the **evaluation**, not a bare boolean — a tool that answers `false` when the character is merely under-levelled is not a debugging aid. It now returns `{started: false, reason: "Requires level 5."}`. `spawnBeast` likewise reports `requiresLevel` / `yourLevel` / `requiresRank`.

### Verified
Debug gate refuses every command before `debug.on()` · unlock one → 1 owned · unlock all → 10 · `removeMount()` → 0 · `spawnBeast` produces a targeted 21/100 Gloom Wolf · `giveBait` adds Darkwater Fish x3 · mount → speed 1.45x · both refusal paths report their reason.

## V0.20.67 - Mount/Taming Keys: All Three Collided

**Reported:** "M is for Map." Auditing the whole binding table instead of swapping one letter found **all three** of my keys were already bound:

| my key | actually bound to |
|---|---|
| `m` | **map** |
| `h` | **hireMerc** |
| `t` | **portal** |

**Root cause — and the real bug:** `taming-system.js` and `mount-system.js` checked raw `event.key` letters instead of going through `Game.defaultKeyBindings` / `bindingForAction`. Bypassing the one table that defines every other control meant (a) the collisions were invisible, and (b) the actions never appeared in the remapping UI — which Roadmap Item 20 requires of every hotkey.

**Fix:**
- Registered `tameBeast` / `mountToggle` / `mountPanel` in `defaultKeyBindings` on the only free letters — **`z` / `x` / `y`** (the table already uses every other letter except `q`).
- Added them to `keyBindingLabels` so they appear under *Interactions* and *Windows* and can be rebound.
- Switched both systems to `game.isActionKey()`.
- The panel hint now renders `bindingForAction()` rather than hardcoded letters, so it cannot go stale after a rebind.

**Verified:** the only remaining duplicate in the entire table is `space` (jump + ascend), which is intentional and pre-existing; all three actions appear in the settings list; **Y** opens the stable; **M no longer touches it**; the hint reads "Press Z … Press X".

### New controls
**Y** stable · **X** mount/dismount · **Z** tame target · **1/2/3/4** answer the beast during taming

## V0.20.66 - Taming Discoverability + Unobtainable Bait

Both found by walking the player's actual path to a first mount rather than re-reading the code.

### Bug 1: silent refusal made the feature undiscoverable
`beginTaming()` computed the rejection reason, passed it to `notify()` — and `notify()` only sets `lastMessage`, which is rendered **nowhere** except inside an active session. Pressing **T** on an ineligible beast produced **zero feedback**: no way to learn it must be weakened first, or which bait it wants.

**Fix:** log the reason. Verified the player now sees `Requires level 4.` and `You need Darkwater Fish to approach it.`

### Bug 2: three beasts were untameable
I chose bait on theme without checking obtainability.

| bait | used by | status |
|---|---|---|
| `item_thornberry` | Briar Boar, Old Tusk | **only a crafting input + quest delivery target** — no source |
| `item_queens_silkroot` | Thorn-Crowned Stag | **defined in `items.js`, referenced nowhere else at all** |

Neither drops, is sold, or is craftable — so **3 of 10 beasts could never be tamed**. Swapped to `item_gloomleaf` (loot + vendor) and `item_mooncap` (loot).

**Why nothing caught it:** `validate.sh` checks that loot references *resolve to* items — the opposite direction. It cannot see an item that no source points at.

**Guard added:** a `mountBaits` section in `runValidationSuite` fails the suite if any bait lacks a loot/vendor/craft source.

**Negative control run** (not just a passing check): re-injecting `item_queens_silkroot` makes the suite report `ok: false` with `mount_gloom_wolf: bait item_queens_silkroot has no loot/vendor/craft source`; restoring the real bait returns `ok: true`.

### Flagged, not silently patched (Roadmap Item 12)
`item_thornberry` and `item_queens_silkroot` remain unobtainable items in the catalogue, and a Dark Woods quest asks the player to **deliver a thornberry** — which is therefore uncompletable. Pre-existing content gaps outside Item 7's scope.

## V0.20.65 - Riding Animation + Mount Facing Parity

### Bug 1: the mount faced the wrong way on half the compass

`drawRiddenMount` passed the rider's raw `facingX/facingY/facingName` to the mob model — but `facingProfile()` in `dark-woods-mob-procedural-model.js` does **not** apply camera yaw, while the humanoid path resolves facing through `entityFacingView()`, which **does**.

Measured across all 8 headings, the two disagreed on **four**: `south`, `southwest`, `north`, `northeast`. A rider heading *northeast* projects to a **side** view on screen, but the compass name contains "north", so the beast drew its **back**. The gap would have widened with any camera rotation.

**Fix:** derive the mount's facing from `entityFacingView(rider)` — the same camera-aware function the rider's own model uses — and express it as a compass name the mob model parses to the identical view. **All 8 headings now agree.**

### Bug 2: the rider ran on the spot

`getStandingPuppetPose()` is the single place humanoid posture is derived, so the riding pose was added **there** — all 14 class models inherit it rather than needing 14 separate edits:

- stride suppressed (`moving: false`), `legSwing: 0`
- `legSpread: 6.5` and `legLift: 4.5` — knees out over the barrel of the animal, feet riding higher
- `bob` driven by the mount's gait at the **same 8.5 rate** the quadruped models use, so rider and beast stay in phase instead of drifting

`legSpread`/`legLift` are `0` for every non-riding pose, so walking and idle geometry is unchanged.

### Verified

| check | result |
|---|---|
| mount/rider facing agreement | **8/8 headings** (was 4/8) |
| riding pose | `mode: ride`, `moving: false`, `legSwing: 0`, `legSpread: 6.5` |
| on-foot pose unregressed | `mode: walk`, `legSwing: 0.81`, `legSpread: 0` |
| mount animates | `moving: true` while walking, `false` when stopped |
| rider bob animates | varies frame to frame |

*Suite ok, 396/396, 0 console errors.*

## V0.20.64 - Roadmap Item 7: Mount and Beast-Taming System (complete)

**New files:** `data/mounts.js` (10 beasts, 6 behaviour patterns, 7 traits, 4 ranks), `systems/taming-system.js`, `systems/mount-system.js`.

### Ownership (Item 7.J / Item 9)
No creature data is duplicated. Every entry is keyed by `beastKey` = the `mobVisualKey` already authored in `data/enemies.js` / `data/npcs.js`, and **all 10 resolve to real authored mobs** — including named variants `mossfangAlpha`, `oldTuskBriarback`, and the `hollowStag` eliteVariant `thornCrownedStag`. **Non-beasts cannot be tamed by construction** (there is no entry for them) rather than by a blacklist someone must maintain.

### Minigame (Item 7.C / 7.D)
Deterministic and frame-driven — seeded mulberry32 PRNG, every transition advanced by `update(dt)`, **zero `setTimeout`/`setInterval`**. Four answers (soothe / hold / feed / give ground) against per-family tells. **4 of 6 patterns include feints** where acting is the mistake and doing nothing is correct — that is what stops it being a one-button minigame. Agitation drifts upward, so standing still is not a strategy either.

### Integration — all through existing owners
- Mount speed multiplies `Game.playerWalkSpeed()`, the single funnel into `tryMoveActorSubstepped`, so mounts inherit collision/terrain/zone rules and **cannot outrun a wall** (7.H).
- Forced dismount hangs off the **one authoritative damage site** in `combat-system.js`, beside the other damage-interrupts.
- Bait is consumed with crafting's `consumeInputs` semantics.
- The collection persists via `serializeState`/`importState` **and is mirrored in `resetCharacterOwnedState`**, so a new character cannot inherit a stable (the V0.20.2 belongings-leak class).
- The rider is drawn on the beast's own procedural model, inheriting its 8-direction facing.

### Verified in-browser
| area | result |
|---|---|
| prerequisite rejections | 7/7 (non-beast, undead, spirit, healthy, no bait, too far, hostiles, level, rank) |
| happy path | bait consumed, 5 correct reads, feints ignored, mount unlocked with source+level, beast removed cleanly |
| failure path | enrage, targets player, not unlocked, 45s retry cooldown |
| interrupts | 5/5 (move, damage, beast death, distance, cancel) |
| duplicate unlock | blocked |
| progression | 0 -> **Beast Handler** over 3 tames; tier-2 gate then opens |
| mount speed | ratio exactly **1.45x** through the funnel |
| damage dismount | 11/12 |
| refusals | dungeon, combat, swim |
| persistence | 3 -> cleared 0 -> restored 3 |
| panel | 10 rows, **all 10 previews contain real drawn pixels** |
| rider model | draws only while mounted (0 -> 3/frame) |

### Two of my own bugs, caught in testing
`session.zone` was read but never assigned — the **zone-change interrupt was silently dead**. And the reaction-window bar divided by an unset `stateWindow`, so it rendered permanently full. Both fixed and re-verified.

*Suite ok, 396/396, 15/15 stat pipeline, 0 console errors.*

## V0.20.63 - Prop Distance LOD, and a WebGL Backend Scoping Report

### 1. Prop LOD (shipped)

- **A webbed bush cost 274 canvas ops — more than a tree (191).** ~200 of that is `drawAnchoredOrbWeb`: 9 spokes, 3 rings and dew, drawn identically whether the bush is at your feet or 20 tiles away.
- **New `propDetailRadius` (11 tiles).** Beyond it, bushes skip the orb web; trees skip branch strokes, 2 of 4 crown blobs, and the sub-20%-alpha moss accents. **Silhouette and palette unchanged.**
- **Not caching** — no bitmaps, no textures, nothing retained between frames. That is what separates it from V0.20.49/53/59.
- **Measured, drift-checked:** prop ops **9,214 -> 6,554 (-29%)**, total frame **29,495 -> 27,090 (-8%)**; drift arm returned 9,214 exactly.

**Fifth measurement trap found:** `DR.CONFIG` (and `.PERFORMANCE`) is `Object.frozen`, so A/B-ing by assigning to it **fails silently** — two arms measured identical because the write never landed. Also, `propDetailRadius: 0` does *not* disable the LOD (it makes everything "far"); raise the radius to disable. The working technique was `Object.defineProperty` on the game instance to intercept `_propFarDetail`.

### 2. WebGL backend scope (investigation only — no renderer changes)

`systems/render-backend-system.js` is a **real prototype, not a stub** (3,401 lines).

**Working:** WebGL2 present, `webglPrototypeReady: true`, and the batcher already reports **`backendBatchDrawablePct: 99.3%` with 0 overflow** across 200 sprite / 120 object / 153 world / 48 terrain batched renderables. The batching design fits this scene.

**Blocked — by its own safety audits, not missing code:**

| gate | state |
|---|---|
| `hybridPromotionBlockedByAudit` | **true** |
| `hybridCameraDepthAuditState` | **blocked** — camera round-trip error **1.313 tiles** |
| `webglVisibleSpriteLastError` | `final-qa-block:final QA projection/depth audit` |
| `webglVisibleTerrainLastError` | `final-qa-block:final QA cave/fringe terrain safety` |
| all visible layers | `enabled: false` |
| sprite/terrain GL programs | not compiled (prototype off) |

**60 FPS is reachable in principle.** The gating work is: (1) make the WebGL projection round-trip match canvas2d within tolerance, (2) clear the depth-order audit, (3) resolve cave/fringe terrain safety, (4) promote layers one at a time behind the existing scene-preview overlay.

## V0.20.62 - Day/Night Shifts (biggest single FPS win, and a content fix)

- **Context:** profiling isolated the camp (user measured **8 FPS at camp vs 20 away**) and the cause as the sheer number of procedural characters drawn at once — **45-46**, at 129-1,212 canvas ops each. Three attempts to make each character *cheaper* via bitmap caching (V0.20.49, V0.20.53, V0.20.59) all regressed and were reverted. The remaining lever was drawing **fewer** of them.
- **Every NPC and ambient bot now has a fixed day or night shift.** Off-shift NPCs walk to a tent and set the **existing `_asleep` flag** — already honoured by the renderer, both interaction pickers and the minimap, so "off shift" inherits all four behaviours instead of needing four new checks. Off-shift bots set `_offShift`, gated once in the render-queue build and once in the entity update loop.
- **Shift assignment sorts ids and alternates**, rather than hashing each id. Hashing is stable but **not balanced** — it split the real rosters **11/19 and 7/10**. Sorting is equally deterministic across sessions and saves, guarantees an even split, and recomputes only when the roster changes.
- **Bug found and fixed in testing:** an off-shift NPC that could not *reach* a tent stayed awake forever and appeared in **both** phases (2 of 28 did exactly that). They now stand down where they are after an 8s grace period.

### Verified across a full day and night

| | day | night |
|---|---|---|
| NPCs awake (of 28) | **14** | **14** |
| bots active (of 16) | **8** | **8** |
| in both phases | **0** | |
| in neither phase | **0** | |

### Measured at camp

| | before | after |
|---|---|---|
| characters present | 46 | **23** |
| canvas ops/frame | 40,603 | **30,631 (-25%)** |

- *Trainers, merchants and quest givers are included, as requested — if your class trainer works nights, come back after dark.*
- *Deliberate exception: a bot already in your party ignores its shift. A party member vanishing at dusk mid-fight is a bug, not atmosphere.*

## V0.20.61 - Asymmetric Object Cull Pad (small, correct, honestly labelled)

- **Objects were culled with `objectCullPadPx: 920` applied equally on all four sides.** Props draw **upward** from their ground anchor, so one anchored above the viewport top is entirely invisible — while one anchored below the bottom can still show its crown (a tall tree genuinely needs 920 there). Sharing the pad kept a measured **68 of 151 props** alive at screen-y -350 to -411.
- **Fix:** new `objectCullPadTopPx: 160`, used only for the `sy < 0` test in the `game.js` render-queue build — so the work is skipped at **queue** time, not merely at draw time.
- **Measured at camp**, A/B by mutating the **memoized** `perfSettings` object directly (mutating `DR.CONFIG.PERFORMANCE` does nothing — V0.17.98 memo), with a drift check: props drawn **151 -> 120**, total canvas ops **41,047 -> 39,261 (~4%)**, drift arm 42,155.
- *Small, because the culled props are cheap grass tufts. **This is not the camp problem** and is not being presented as one.*

### Camp diagnosis (measured this pass)

Standing in camp the frame draws **45 characters — 27 NPCs + 18 entities**. `npcRuntime` is the largest single phase at ~11.7ms.

Tested whether the NPC sprite cache is hurting there as it did in V0.20.59: **it is not.** Cached **11.7ms** vs live **24.3ms** (interleaved, median of 8). NPCs stay cached.

So the remaining camp cost is simply **the number of procedural characters on screen**. The next real lever is a **level-of-detail model for background NPCs** — fewer canvas ops, *no new textures*, which is what distinguishes it from the three reverted caching attempts — or fewer camp NPCs.

## V0.20.60 - Revert of V0.20.59, and Caching Retired

- **Reverted `spriteCacheLiveRadius` 6 -> 18.** V0.20.59 made the change on a real, drift-checked canvas-op reduction (**40,277 -> 29,315 ops/frame**). Reported result: **12 FPS -> 10.**
- **The op count was true and insufficient.** At r=6 the sprite cache grows from **485 entries / 135MB** to **744 entries / 207MB** of offscreen canvas. Each distinct source canvas is a **GPU texture upload** on blit, and with hundreds cycling through animation buckets the upload churn exceeds the vector drawing it replaced.
- **Canvas-op count is not a sufficient cost proxy** when the ops are blits from many distinct sources — the same failure mode as the V0.20.53 atlas revert (19 pages, 1.28GB of texture, 5-6x slower).

### Third strike — caching is a closed avenue

| version | attempt | result |
|---|---|---|
| V0.20.49 | humanoid render cache | 12 -> 7 FPS, reverted |
| V0.20.53 | full sprite atlas | 5-6x slower, reverted |
| V0.20.59 | live-radius 18 -> 6 | 12 -> 10 FPS, reverted here |

Treat sprite/bitmap caching as **closed** on this renderer unless someone first proves texture-upload cost on real hardware.

### What survives (all still in place)

- **V0.20.56** NPC viewport cull — 20 of 27 NPCs skipped away from camp
- **V0.20.57** nameplate `measureText` memo — 66 -> 14 calls/frame
- **V0.20.58** animation-bucket frame-time floor — re-bakes 12.2 -> 3.2/frame
- **V0.20.55** the profiler itself

### Standing diagnosis

**~40,000 canvas ops/frame against a ~5-10k budget for 60 FPS:** `drawEntity` ~21.8k, `drawObject` ~12k, `drawTile` ~3.5k, `npcRuntime` ~3.5k. Reaching 60 needs **fewer things drawn**, or **a different backend** — `renderBackendMode` is `'canvas2d'` and `systems/render-backend-system.js` already contains a WebGL path. It does **not** need another caching layer.

## V0.20.59 - The Actual Number: ~44,000 Canvas Ops/Frame

- **Everything before this was optimising blind.** Your 50% resolution test settled the regime: a ~75% pixel cut moved 9 FPS to "8 to 12" — **draw-call bound, not fill-rate bound.** That also makes this software preview a fair proxy (it is draw-call bound too), and makes **op counting** reliable where timings are not.
- **~44,000 canvas operations per frame**, against a realistic 60 FPS ceiling of **~5-10k**. That one number explains the whole problem.
- **Op budget:** `drawEntity` **21,811 (49%)**, `drawObject` 12,058 (27%), `drawTile` 3,491, `npcRuntime` 3,478, effects 732, shadows 630.
- **The finding:** an entity costs **1,212 ops drawn live vs 129 through the sprite cache** — and `spriteCacheLiveRadius: 18` (set by V0.18.4 for animation fidelity) covers the entire visible screen, so **18 of 20 actors per frame were rejected as "live"** and the cache served almost nothing.
- **Fix:** `spriteCacheLiveRadius` **18 -> 6**. Combat/conversation range still animates fully; the mid-distance crowd blits.
- **Measured knee, drift-checked** (r=18 repeated last: 41,793 vs 43,954): r=18 **43,954** | r=10 28,842 | **r=6 26,697** | r=4 25,122 | player-only 25,344. Chose 6 where the curve flattens — past it you lose animation for almost no gain.
- *Trade-off: actors beyond 6 tiles animate more coarsely. Set `spriteCacheLiveRadius` back to 18 to prefer animation over frame rate.*

### Two measurement traps found (both had produced wrong answers)

1. **`performanceSettings()` is memoized** (V0.17.98) — mutating `DR.CONFIG.PERFORMANCE` mid-run does **nothing**. An earlier liveRadius A/B showed "no difference" purely because the change never took effect. Stub `shouldRenderModelLive` directly instead.
2. **`runtimeSpriteCache.beginFrame()` only runs from `loop(now)`** — synthetic loops leave the cache permanently budget-skipped (see V0.20.58).

### Remaining

`drawObject` is 12,058 ops across 151 props, of which **68 are measured off screen** (screen-y -350 to -411) — the same world-radius-instead-of-viewport pattern fixed for NPCs in V0.20.56. Needs an asymmetric pad, since props draw upward from their ground anchor.

## V0.20.58 - The Slow-Frame Death Spiral (and a correction to V0.20.57)

- **Found:** 25 of 27 sprite-cache keys changed **every frame**, and diffing the key components showed the only difference was the trailing animation time bucket (`t2` -> `t3`).
- **Root cause:** a moving actor's bucket lasts `spriteCacheMovingFrameMs` = **100ms**, but at ~9 FPS **a frame is 111ms**. Every frame lands in a new bucket, the key never repeats, every lookup misses, and the cache **re-bakes** (a full procedural draw into an offscreen canvas) instead of reusing. Re-baking costs *more* than drawing live — **so the slower the game runs, the more work it invents for itself.**
- **Fix:** floor the bucket duration at **3x the measured `perfStats.frameMs`** so the quantization actually quantizes. Provably a no-op when healthy — at 60 FPS the floor is 50ms, **below every configured bucket** (66/100/125/250ms) — and it only engages below ~30 FPS.
- **Measured by counters, not timings** (timings in this preview are noise): **re-bakes 12.2/frame -> 3.2/frame, hit rate 55% -> 88%**, with a **passing drift check** (old-behaviour arm repeated last: 54%, 12.4 re-bakes, matching arm 1).

### Correction to V0.20.57

`runtimeSpriteCache.beginFrame()` is called **only** from `game.js loop(now)` — the real rAF loop. Driving `update()+render()` synthetically never resets `missesThisFrame`, so after the first 96 misses the cache sits permanently in **budget-skip mode and silently draws everything live**.

Every cache measurement I took before this used that broken loop. That is why V0.20.57 concluded *"the runtime sprite cache is NOT the lever"* — **that conclusion was an artifact and is wrong.** `docs/V0.20.57_NAMEPLATE_TEXT_MEMO.md` has been corrected. Any future cache profiling **must** call `cache.beginFrame()` per iteration.

## V0.20.57 - Nameplate Text-Measurement Memo (small, real, not oversold)

- **Found by profiling inside `drawEntity`:** `drawNameplate` cost ~2.7ms/frame across ~20 plates **despite the V0.17.96 image cache hitting 91%** (measured: 16.4 hits vs 1.6 misses per frame).
- **Root cause:** that image cache is checked **after** the layout block has already run **three `ctx.measureText()` calls plus two `ctx.font` assignments per plate** — and the `ctx.restore()` immediately below **discards that font state**. On a cache hit, all of it was pure waste (~66 `measureText`/frame).
- **Fix:** module-level memo in `render/entity-renderer.js` keyed by `(font, string)` — widths are a pure function of those two — touching `ctx.font` only on a real miss.
- **Measured:** `measureText` **66 -> 14** calls/frame; `drawNameplate` **2.7ms -> 0.38ms**.
- **What I could not show:** total render time did **not** visibly move (43.5ms vs a 41.4ms baseline). ~2ms sits inside this preview's noise band, and `update()` drifted 12.9 -> 32.2ms during the same run — the same instability documented in V0.20.55. The function-level win is solid; **the frame-level claim is not, so it is not being made.**

### Also ruled out this pass (so nobody re-checks them)

- **The runtime sprite cache is not the lever** — forcing every non-player actor through it left `drawEntity` identical at **10ms in both arms**.
- **There is no per-frame leak** — entities stable at 435, cache entries stable at 96 across 60 frames.
- **The canvas is correctly configured** — `{alpha:false}`, and it does **not** set `willReadFrequently` (which would force software rendering).
- **Render dominates update** — 41.4ms vs 12.9ms — so render was the right place to look.

## V0.20.56 - NPC Viewport Cull (first measured, verified FPS win)

- **Found with the V0.20.55 profiler:** external system `npcRuntime` was the largest single bucket at **17-18ms/frame** — bigger than every entity in the scene combined.
- **Root cause:** `systems/npc-system.js` culled with `Math.hypot(...) > 36` — a **world radius, not a screen test**. Standing away from camp, all ~27 camp NPCs stayed "in range" and each paid a full `mergedNpc()` + class model + nameplate **while completely off screen**.
- **Why I missed it earlier:** I profiled at *spawn*, where 26 of 27 NPCs are genuinely on screen and the radius looks harmless. The user's screenshot showed them out in the forest — which is exactly where it bites.
- **Fix:** one call to the existing `game.worldPointInsideViewportFast(x, y, elev, 480)` — the same cached-projection viewport test the entity renderer already uses — placed *after* the cheap radius early-out but **before `mergedNpc()`**, so the expensive work is skipped rather than merely not blitted. The 480px pad is far beyond the tallest NPC visual (~90px model above anchor + ~90px nameplate stack), so nothing pops in at the edge.
- **Measured with arms interleaved frame-by-frame** so drift hits both equally (the V0.20.55 lesson): in the forest **20 of 27 NPCs culled, `npcRuntime` median 15.8ms -> 4.2ms**.
- **Regression check at camp: 0 culled, all 27 still drawn, no visual change.**
- *Caveat: the absolute milliseconds come from this software-rendering preview and will not match real hardware. The work **eliminated** — 20 of 27 full NPC draws — is machine-independent.*

## V0.20.55 - A Frame Profiler That Runs On Your Machine

- **I cannot measure your frame rate from here, and I should have said so three versions ago.** This preview is permanently `document.hidden`: rAF is throttled to ~0 and canvas2d renders in **software**. Every performance number in V0.20.49-54 came from it.
- **Worse, my synthetic measuring loop degrades.** Driving `render()` in a tight loop: 127.3ms -> 129.1 -> 130.5 -> **148.2ms on a repeat of the first arm**, with cache hits/misses reading 0 in every arm. I discarded that whole ablation rather than ship another "fix" built on noise.
- **New: `await DarkWoodsGame.profileRenderPhases(120)`.** Wraps the major draw phases *and each external system's `render()` separately* (`renderExternalSystems` is usually the biggest bucket and tells you nothing without the breakdown), samples the **real rAF loop**, restores every wrapper in a `finally`, and returns + `console.table`s the report.
- **Reports `version` and `atlasFramesLoaded`**, so a stale-build mix-up shows up immediately.
- **Lead it already produced** (measured in software here, so a lead and *not* a verdict): external system **`npcRuntime` at 17.21ms**, larger than `drawEntity` (15.82ms / 17 calls), `drawTerrainChunks` (10.29ms) and `drawObject` (7.02ms / 151 calls) — **the camp NPC system costs more per frame than every entity in the scene combined.**
- *Verified by stubbing rAF with a real render tick, since rAF cannot complete in a hidden preview: wraps and unwraps cleanly, 11 frames sampled, hotspot correctly named.*

## V0.20.54 - Atlas Reverted (it made rendering 5-6x slower)

- **The V0.20.52/53 theory failed its test.** I claimed draw calls were the bottleneck and the atlas would fix it. Measured in-world: **311-384ms/frame with the atlas ON vs 55-64ms OFF** — the atlas made drawing **5-6x slower**. That matches the reported **12 FPS -> 9 FPS**.
- **Root cause is page size, not the atlas concept.** Isolated benchmark, identical destination size and op count: `drawImage` from a **4096x4096** page costs **4.17us** warm (45.8us cold) vs **0.63us** (1.17us) from a small per-frame canvas — **6.6x slower** purely because the source texture is huge. 19 pages x 4096^2 x RGBA = **1.28GB** of decoded texture; only **0.03%** of those pixels are opaque.
- **Paladin feet were clipped** — same job. Baked frame is 176x192 with origin at y=150, leaving **42px** below it, but Paladin feet sit **44px** below origin (the class-specific depth found in V0.20.51). Content runs to **row 191 of 192 with 21 pixels still opaque at the edge**. Also: `footAnchorY == anchorY` in every baked frame, so the baker never captured a real foot line.
- **Where the time actually goes** (selective stubbing): baseline 41.4ms -> **26.4ms with entities removed (entities = 36%)**, -> 35.2ms without world objects (**15%**), -> 43.3ms without effects (noise). **~26ms and ~27k path ops remain with zero entities**, and only ~22 actors survive culling. **Terrain/ground is ~63% — actors were never the main cost**, so no actor atlas could have reached 60 FPS alone.
- **Reverted to the placeholder manifest.** Nothing destroyed: the bake is preserved as `entities.baked-v0.20.53.json` / `.manifest.js` beside the 19 PNGs, so a re-pack into small pages can reuse it.
- *Verified after revert: atlas `ready:false`, player renders procedurally, **62ms/frame**, Paladin foot line **+49px below origin** (positive, feet intact).*

## V0.20.53 - Atlas Installed + The Key Mismatch It Exposed
- **The bake ran locally and is installed.** 19 pages / **7,969 frames** in `assets/atlases/`. Runtime load verified: `manifestsLoaded 1`, `pagesLoaded 19/19`, `framesLoaded 7969`, `invalidFrames 0`, `pageErrors 0`, `ready true`. All 19 PNGs validated as real PNGs at their declared 4096² dimensions, with **0 frames referencing a missing page**.
- **Installing it exposed a second, older bug.** `inferModelId()` (`systems/sprite-atlas-system.js:54`) has explicit branches for boar/wolf/rotling/spider/skeleton/bandit/spirit-healer, then falls through to `normalizeToken(renderer || family || kind)`. So **wisps, hollow stags and ashroot horrors** asked for `wisp.*` / `stag.*` / `deadroot.*` while the baker had correctly written `Wisp.*` / `HollowStag.*` / `AshRootHorror.*`. **Their frames existed and were never found.**
- **Measured over every live entity: 133/400 resolved, 267 missed** — and those three families are **265 of ~400 actors** in the opening area, so the freshly-installed atlas would have looked nearly worthless.
- **Fix: three branches in that same function**, matching the existing pattern. The variants already lined up (`duskwisp`, `hollowStag`, `ashrootHorror` all arrive via `mobVisualKey` on the default path at `inferVariant` line 102) — only the modelId token was wrong.
- *Verified after: **404/404 entities resolve, 0 misses**, `node --check` clean.*
- *Not measured: this preview has no save, so `render()` only paints the splash screen. **In-world FPS and `atlasDraws` must be read on your machine.***
- **Backup command changed.** The baked pages are 87MiB of already-compressed PNG that zip cannot shrink, and they are a reproducible build artifact — `RELEASE_CHECKLIST.md` now excludes them via `-x "assets/atlases/*.png"`. Measured: **165MiB with the exclusion, identical to the pre-atlas V0.20.51 backup**, vs ~252MiB without. `entities.json`/`entities.manifest.js` stay in, so a restored tree still records which frames it expects rather than failing silently.

## V0.20.52 - Sprite Baker Rebuilt (the real FPS cause)
- **Root cause of the frame rate found.** The game is designed to blit pre-baked sprites — `SpriteAtlasSystem`, `tryDrawEntityAtlasFrame` and `sprite-bake-system.js` all work — but `assets/atlases/entities.json` is still the placeholder, because **`tools/sprite-baker.html` / `.js` had gone missing from the repo**. With no atlas, 100% of fallbacks report `atlas_not_ready` and everything draws procedurally: **~10,000 path ops/frame vs ~92 `drawImage`**.
- **Rebuilt the missing tool.** Loads the renderer scripts from `_script_order.json`, skipping `game.js` so no game boots.
- *Verified in-browser: 135 scripts load clean (no game booted), 87 definitions found, Paladin smoke bake = 328 frames in 923ms, packing produced a real 4096² page, manifest carries `footAnchor`/`nameplateAnchor`/`clickBounds`.*
- *The full bake downloads tens of MB and must be run locally — see the tool page.*
- *Also established: the adaptive governor is **not** broken (it correctly downshifts to render scale 0.72 under load), so pixel reduction is already automatic and spent — draw-call reduction is the remaining lever.*

## V0.20.51 - Roots At The Feet (class-specific fix)
- **Snare roots wrapped the waist for some classes.** Ground-anchored VFX use `_lastGroundAnchor.groundY`; the shared humanoid renderer derives it from the leg/foot anchors, but the **bespoke class models published `groundY: y` — the model origin, i.e. the hips**.
- **Measured across all 14 classes:** 13 reported the foot line +33px below the hip anchor; **Paladin reported −5px (above it)**. The reporter plays a Paladin.
- **Fixed** both bespoke publishers (`drawPremiumPaladinModel` + fighter-bruiser variant) to derive `groundY` from their own leg anchors, matching the base renderer.
- *Verified end-to-end: all 14 classes positive (Paladin 44px, others 33px, 0 broken), and a live rooted Paladin resolves the effect to drawY 682 vs true foot line 682.*
- *Lesson: two earlier "verifications" were true and irrelevant — a per-class defect needs a per-class sweep.*

## V0.20.50 - Revert of V0.20.49 (humanoid caching)
- **Reverted.** The humanoid sprite-cache routing made performance *worse* (12 -> 7 FPS) and broke snare-root foot anchors.
- **Why it failed:** the cache key correctly includes animation bucket + `moveBlend`, so moving actors churn it. The per-frame miss budget (96) is blown instantly — **2,514 budget skips** in a sampled frame — so `drawModel` declined nearly every call *after* already paying for an entity spread, equipment resolution and key-string build. Pure added overhead.
- **Why verification missed it:** I benchmarked by calling `render()` on a **frozen frame** (no `update()`), so nothing moved and the cache reported a 92% hit rate. A render-only benchmark is not a benchmark.
- **The root bug:** humanoid feet draw ~38px below the body origin; the true foot line is published as `_lastGroundAnchor` during the draw. On a cache *hit* no draw ran, so roots fell back to the hip anchor.
- *Verified: 15/15 humanoids publish `_lastGroundAnchor` again, player foot line +33px below the hip anchor, 0 entities on the cache path, suite ok, 0 console errors.*

## V0.20.49 - Humanoid Render Caching (Roadmap Item 21)
- **Render 31.4 -> 18.3ms in-harness (-42%)**; `beginPath` 6,407 -> 3,713, `stroke` 4,297 -> **1,685 (-61%)**. No content removed.
- **Root cause:** the pre-baked sprite atlas (`assets/atlases/entities.json`) loads its manifest but has **zero frames**, so `isReady()` is always false and 100% of fallbacks reported `atlas_not_ready` — every actor took the procedural path (~140 vector ops each). The *runtime* sprite cache was already healthy (95% hit rate) but only wired into the NPC path.
- **Fix:** humanoid entities route through the runtime cache (`drawCachedHumanoid`). The bake repoints `window.ctx` at the offscreen canvas and restores it in a `finally` — the same pattern already used for cached nameplates. Procedural drawing remains the fallback.
- *Correctness verified: 4 facings -> 4 distinct cache entries, walk/idle differ, player **and** bot gear invalidate and revert, nameplate anchors 16/16, 0 bake failures. Caught and fixed a regression where an empty resolved-equipment object shadowed `botEquipment` in the cache key.*

## V0.20.48 - FPS Readout, Bot Walking & Party Invites
- **FPS counter now genuinely visible.** V0.20.47 placed it at a fixed `top:232px`; the mini-map panel is **310px tall**, so it sat *behind* it. My check only tested `display !== 'none'`, which is not the same as visible. It is now a flex child of `#minimapWrap`. Re-verified by occlusion (`elementFromPoint` returns the counter) and by rendering real values.
- **Bots no longer slide.** One bot was measured moving 1.09 tiles with `moveBlend 0`. Cause: bots can be repositioned while their own update has declared them stationary (casting/busy branches zero it and return early), so an in-update fix got overwritten the same frame. Moved to `Game.deriveBotLocomotion()`, a post-pass after all entity updates. Sliding: sustained -> **1.6% of walking frames**.
- **Party invite window styled and centred.** The markup and handlers existed but there was **no CSS for `.partyInvitePopup`**, so invites rendered as an unstyled block in document flow. Now a centred modal (z-60) with emblem, identity, member count and styled Accept/Decline.
- *A first pass at the bot fix only ever raised `moveBlend`, making stationary bots animate in place (655/871 still frames); a decay was added.*

## V0.20.47 - Walk Speed & FPS Counter
- **Player walk speed halved.** New `CONFIG.PLAYER_WALK_SPEED_SCALE` (0.5) + a single `Game.playerWalkSpeed()` read by *all* movement paths (keyboard, click-to-move, controller) so they cannot drift apart.
- **The speed stat is deliberately untouched** — character sheet, gear and speed buffs keep reading the real value; only distance-per-second changes. The click-to-move `Math.max(0.8, ...)` floor now scales with the knob, or it would have silently cancelled the slowdown.
- **FPS counter restored** under the mini-map. The logic was never removed (`updateFpsCounter` runs every frame); V0.17.06 dropped the `#fpsCounter` element, so it was writing into nothing. Element + `.fpsValue` span + styling added back.
- *Verified: movement 4.55 -> 2.275 tiles/sec (ratio exactly 0.500) through the real move call; FPS element renders "60 FPS"/"20 FPS" when driven at those rates.*

## V0.20.46 - Performance (no content removed)
- **Update loop ~5x faster: 53.8ms -> 13.3ms per frame**, with all 444 enemies, all NPCs and all props still present.
- **Root cause:** `StatusEffects.hasTag` checked `Array.isArray(buffs)` but never `length`, so entities with an *empty* buffs array still ran `slug()` (two regex replaces + allocations) and `.some()` over nothing. Measured: **517 calls/frame, 100% against empty buffs**, costing **26.9ms/frame**.
- **Fixes:** early-out on empty buffs in `hasTag`/`hasCurableTag`/`statusSpeedScalar`; memoised `slug()` (bounded); replaced my V0.20.44 O(n^2) NPC neighbour `hypot` storm with an axis reject + squared-distance compare.
- **Breakdown:** `hasStatusTag` 26.9 -> 2.3ms, `updatePatrol` 15.6 -> 5.4ms, enemy update 30.2 -> 4.3ms, NPC ambient life 7.8 -> ~0ms.
- *Correctness verified by 10 assertions incl. positives (tagged buff still found, slug normalisation intact, expired buffs excluded, `isCurable` respected, root still zeroes speed). Render is now the dominant half and is untouched.*

## V0.20.45 - The Camp Folk Actually Walk
- **Fixed the "teleporting" NPCs.** V0.20.44 got them moving and set the walk state, but two spots in the render discarded it: `classActor` was built with hardcoded `facingX:0, facingY:1, isMoving:false, action:'idle'`, and `drawNpcClassModelDirect` then forced `isMoving = false` one line before the draw. The sprite cache keys its animation bucket off `action`/`isMoving`, so every NPC baked as idle (one frozen frame) and slid around wearing it.
- **Now derived from the live node**: `moveBlend > 0.08` -> `action:'walk'` + `isMoving:true`; real facing passed through; `facingName` derived from the movement vector (8-way), since `faceNodeToward` only writes the vector.
- *Verified at the bridge, not on the node: a forced render frame with walkers mid-stride shows 21/22 NPC draws arriving as `walk`/`true` with varied facings (previously all `idle`/`false`/`south`); a genuinely idle NPC still arrives `idle`. Cache math: `walk` = 5 distinct frames/600ms vs `idle` = 2.*

## V0.20.44 - The Camp Comes to Life
- **Camp NPCs are animated and alive.** By day the whole camp bustles — each NPC strolls to a point near its post, pauses, and wanders on, with a proper walking gait (the old "teleport/slide" was `moveBlend` never sustaining the walk animation; it's now driven by walking *intent*, so a blocked frame in the crowd keeps the gait).
- **Night schedule.** At nightfall almost everyone walks to the nearest tent and sleeps — hidden from the world, the interaction pickers and the minimap — then wakes and returns at dawn. The ethereal Spirit Healer keeps its vigil.
- **Safe by construction** (Roadmap Item 16): bounded to each NPC's authored home post (save-safe, no drift), collision-gated, no NPC-on-NPC or NPC-on-player overlap, holds still while being talked to; all state is runtime and re-derives from the world clock on reload.
- *Verified live through the real game loop: at deep night 26/27 camp NPCs slept in tents, 0 on blocked tiles, 0 console errors. (Wandering adventurer bots are a separate population and are unaffected.)*

## V0.20.43 - Dead Lantern Camp (finishing pass)
- **The camp was already rebuilt in V0.20.8** — 42 objects across 24 types (tents, cooking area, quartermaster supply line, training corner, medical, study, sleeping quarters, torches, banner, clutter), placed by NPC role, with carved paths and no NPC-on-prop overlaps. Verified live.
- **Closed the one residual:** two east-ring quest NPCs still sat ~1 tile from a trainer (`road_warden` 1.41 from `fighter_trainer`, `deepwood_surveyor` 1.00 from `rogue_trainer`) — too close for nameplate/interaction space. Each moved one tile onto a prop-free camp tile, opening ≥2.0 from every other NPC (proximity harness: 2 tight pairs → 0).
- *An honest finishing pass, not a rebuild — the heavy lifting was V0.20.8. (Roadmap Item 2 — complete.)*

## V0.20.42 - Quest Dialogue & Narrative Pass
- **A full dialogue pass over all 26 Dark Woods quests.** Each quest was audited against the roadmap's eight dialogue states, then the real render paths were read to tell genuine gaps from false positives.
- **Failure dialogue for defense events.** A defend hold that breaks used to speak one fixed system line for every quest; now the quest-giver's own words carry the loss (`quest_guides_warning`, `quest_what_the_gap_lets_in`, `quest_the_long_root`), routed through a new `logDefendFailure` in the owning module, with the retryable reset note kept clear.
- **In-character in-progress lines.** 11 quests were reciting raw objectives — one literally spoke `(300s)` and `6 waves` — rewritten into each NPC's voice, with the mechanics left to the task labels and the live HUD.
- **Post-completion for the Rurik ally path** (`quest_ruriks_bargain`), so he no longer replays his turn-in line.
- **Validator hardened** (Roadmap Item 22): `validateQuestDialogue` now also flags parenthetical seconds-notation, proven non-vacuous.
- *False positives were documented, not padded: prereq-only `lockedText`, and `beforeOfferText`/`postCompletionText` for giver-less breadcrumbs, branch/auto-offer quests and repeatable dailies, have no render path and were left alone.* (Roadmap Item 1 — complete.)

## V0.20.41 - Armor Proficiency
- **The first piece of a skill system.** Four armour skills — cloth, leather, chain, plate — climb from level 1 to 20 as you take hits in the armour you wear, and make that armour absorb more of every blow.
- **Earned only from real fights** (not idle chip damage, not faster than once every 1.5s). It levels with a notification, recomputes on gear change, and persists across save/load.
- *Honest limits: starting gear isn't tagged with an armour weight yet (training begins once you equip looted/crafted armour); a progress panel and weapon skills are next.* (Roadmap Item 8.)

## V0.20.40 - Loot & Acquisition Audit
- **A pass over loot and item acquisition.** Every loot drop points at a real item, and every item in the catalogue can actually be obtained — via loot, shops, crafting, gathering, fishing, quests or starting gear.
- **No player-facing change** — the audit found the system healthy; the apparent gaps were cataloguing quirks, not real.
- **Added a build-time guard** that catches any future edit pointing a loot drop at a non-existent item. (Roadmap Item 12.)

## V0.20.39 - High-Contrast Target Ring
- **A new accessibility option for the target marker.** The ring under your selected enemy is normally a thin amber oval; turn this on and it becomes a bold black-and-white ring at full strength, so your current target is never in doubt.
- **Only the marker's look changes** — nothing about targeting. Off by default, remembered between sessions. (Roadmap Item 20.)
- *Note: full interface/font scaling isn't a simple switch in this build (fixed pixel sizes across many panels); written up honestly for a dedicated pass.*

## V0.20.38 - Colourblind Status Markers
- **A new optional accessibility setting** that adds a small up-triangle to beneficial status effects and a down-triangle to harmful ones — telling a buff from a debuff by shape, not colour.
- **The effect symbols and timers already there are unchanged** — each effect still shows its own icon; this only adds the arrows.
- **Off by default and remembered between sessions.** (Roadmap Item 20.)

## V0.20.37 - Reduce Motion
- **A new Reduce Motion accessibility toggle**, beside the screen-shake option. It stops camera shake and calms swirling particle effects to about half their usual density.
- **It removes nothing you need to see.** Every spell, telegraph, health bar and damage number draws exactly as before; only decorative motion is quieted, and timing/damage are unchanged.
- **Off by default and remembered between sessions.** (Roadmap Item 20.)

## V0.20.36 - One Cast Sound, The Right One
- **Fixes a double-sound from the previous version.** Spells were never truly silent — the cast cue already played a sound; V0.20.35 layered a second on top.
- **Lightning played both a whoosh and a thunderclap; melee both a whoosh and a blade.** Now there is a single, correct cast sound per cast — thunder for lightning, a blade for melee, a magic swell for the rest.
- **Now also covers slower cast-time spells** the previous approach missed. Enemies unchanged. (Roadmap Item 18.)

## V0.20.35 - Spells That Make A Sound
- **Spells were casting in near-silence.** Out of nearly 300 abilities, only the three summon spells made any sound at the moment of casting.
- **Now every spell speaks when it goes off**, from sounds the game already ships: thunder for storm spells, a blade for melee, a magic swell for the rest — each pitched a hair differently.
- **Impact and healing sounds are untouched** — the cast sound layers on top. (Roadmap Item 18.)
- *Honest limit: no separate fire/frost/arcane cast sounds exist yet; those share the general magic cast until such audio is added.*

## V0.20.34 - Bosses Get Desperate
- **Bosses now change over a fight.** Stall too long and a boss slowly turns up its damage the longer you take — kiting forever is no longer safe.
- **They escalate as their health falls.** At half health a boss grows enraged (harder, faster); at a quarter it turns desperate and unleashes one last burst — summoned help if it has any, else a heavy telegraphed strike you can still dodge or interrupt.
- **Only true bosses and named enemies.** Ordinary monsters are unchanged; a boss reset to full starts clean. (Roadmap Item 19 complete.)

## V0.20.33 - Stun It And The Fire Never Falls
- **The half-second warning before an enemy area attack is now a chance to STOP it, not just dodge it.** Land a stun, silence or freeze on the caster inside that window and the attack is interrupted — it never lands.
- **A root or slow won't do it** (a rooted caster can still finish the spell), and killing the caster still lets the already-loosed effect fall — but a real interrupt shuts it down.
- **Every stun is now an interrupt tool.** (Roadmap Item 19.)

## V0.20.32 - Every Ground Attack Now Warns
- **The Ashroot Horror's last instant attacks now telegraph.** Its ash cloud, death bloom and blightwood pulse used to land the moment they were cast; they now show the same danger circle and half-second window as every other enemy area attack.
- **No unavoidable ground hit is left** in either the data-driven or the hand-written enemy ability path. (Roadmap Item 19.)
- *Note: boss enrage timers and distinct fight phases the roadmap calls for do not exist yet — a feature still to be designed.*

## V0.20.31 - Step Out Of The Fire
- **Enemy area attacks used to be unavoidable.** A ground AoE spawned its warning ring and dealt its damage on the very same frame — the ring *was* the hit, with no moment to move.
- **Now the danger circle appears first, and the blast lands half a second later.** Long enough to step out, short enough to keep the pressure on.
- **Melee swings stay instant** — only ground-targeted area attacks telegraph. (Roadmap Item 19.)

## V0.20.30 - Bosses Fight Back, Tooltips Tell The Truth
- **Bosses can no longer be stun-locked into helplessness.** The control resistance added earlier now applies to enemies by tier — a boss shrugs off about half a stun's duration, a miniboss less, a normal enemy not at all. Your own resistance is unchanged. (Roadmap Item 19.)
- **Every enemy stays hand-tunable.** The tier value is a fallback; a specific enemy can still be given its own resistance in data.
- **Seven spells stopped lying about channeling.** Whirlwind Cleave, the dagger flurry, the arrow volley and others claimed to "channel for N seconds" but struck all at once. Their descriptions now say what they actually do. (Roadmap Item 6.)

## V0.20.29 - Every Class Now Has A Face
- **The last five casters look generic no more.** Druid, Shaman, Summoner, Enchanter and Ranger each threw the same ring for every spell; now each has its own language.
- **Druid** grows in green and glows pale under the moon. **Shaman** cracks teal storms, bursts amber stone, drifts with spirits. **Summoner** tears violet rifts. **Enchanter** pulses rose — on its charms and mesmerises, not just its damage. **Ranger** marks its quarry with a moss-green crosshair.
- **All fourteen classes now look like themselves** — every melee silhouette, every caster's element and motif. (Roadmap Item 6.)

## V0.20.28 - The Wizard's Elements Finally Look Different
- **Every wizard spell used to be the same blue ring.** A Fireball, a Frost Nova and an Arcane Bolt were impossible to tell apart at a glance — for the one class whose whole identity is elemental force.
- **Now the element shows.** Fire blooms orange and throws embers, frost rings out cyan and scatters ice shards, lightning cracks yellow, arcane traces violet runes.
- **Read from what the spell does, not its colour.** Ignite is authored blue but burns orange like the fire it is.
- *Five casters still to get the same treatment: Druid, Shaman, Summoner, Enchanter, Ranger.* (Roadmap Item 6.)

## V0.20.27 - The Resist That Never Resisted
- **Three abilities promised to resist stuns and roots, and none did.** Unstoppable Footwork, Spirit Walk and Blink carried a control-resistance value that was silently thrown away when the buff was applied. Popping them before a fight did nothing.
- **Now they work.** A root that pins you for 3.2 seconds lasts 1.6 under Unstoppable Footwork, 2.24 under Spirit Walk, 2.56 after a Blink.
- **Only control is shortened.** A poison or burn ticking on you is unaffected — resistance applies to stuns, roots, silences and slows, nothing else.
- **The same gate works on enemies.** Bosses can now be made to resist stun-locking — the machinery is in; the exact numbers are a deliberate balance pass still to come. (Roadmap Item 19.)

## V0.20.26 - Bolts Leave The Hand, Not The Belly
- **Every bolt, missile and dart used to launch from the caster's stomach.** The origin was pinned a fixed distance above the feet that ignored how tall the character stood, landing around the belly instead of the hands.
- **Now it leaves at chest-and-hands height.** The launch point is read from each character's own body, so it is right whether the caster is a slight wizard or a towering enemy.
- **Only the origin moved.** The bolt still lands exactly where you aimed — nothing about aim or hit detection changed.
- *Still honest about what is left: the exact left-or-right hand (which depends on facing) is a larger per-class job for another day. This fixes the height, which was wrong for everyone.* (Roadmap Item 6.)

## V0.20.25 - A Poison You Can See While It Kills You
- **Damage-over-time effects left no mark.** A target could be burning, poisoned and bleeding at once and look untouched between ticks. Now every affliction shows.
- **Colour tells you what is eating them.** Poison green, bleed red, fire orange, shadow violet — read from what the effect does, not the spell's colour. (Ignite is authored blue; it now correctly burns orange.)
- **Stacked afflictions merge into one plume.** A five-DoT enemy shows a single mark, not five — combat stays readable, at a tenth of a millisecond a frame with thirty afflicted enemies.
- **It lasts exactly as long as the effect.** The plume appears when the DoT lands and fades the moment it ends. (Roadmap Item 6.)

## V0.20.24 - A Shield You Can See For As Long As It Protects
- **Shields used to flash once and disappear.** You cast a ward lasting minutes — Guardian Aura lasts half an hour — and saw a half-second sparkle, then nothing. No way to tell at a glance whether you were still protected.
- **Now a shield is a visible dome for exactly as long as it holds.** It forms when the shield goes up and fades the instant it ends — not a timed animation guessing at the duration, but the shield itself, drawn.
- **It shows on your allies too.** A paladin's guardian aura, a shielded companion — you can see who is warded and who is exposed.
- *Damage-over-time effects want the same treatment and will get it; they are common enough in a fight to need their own pass so combat does not turn to soup.* (Roadmap Item 6.)

## V0.20.23 - The Blast You See Is The Blast That Hits You
- **Meteorfall was killing people eleven times further out than it looked.** Its blast covers seven tiles of ground; its graphic showed a circle a fraction of that. Every area spell had the same lie in it — the ring was drawn in one unit and the damage measured in another.
- **Now the ring stops exactly where the damage stops.** Fireball, Flame Wave, Meteorfall, Consecrated Ground, Smoke Bomb, Whirlwind Cleave — 37 area spells across all fourteen classes now draw the ground they actually affect.
- **It never over-promises.** The ring is sized so that even at its widest it never claims more reach than the spell deals. If it is ever wrong, it is wrong by being slightly small — never by pulling you into a blast that reached further than it showed.
- **And the circle is finally circular.** Area rings were drawn at the wrong squash for the ground plane; they now match the projection the world actually uses. (Roadmap Item 6.)

## V0.20.22 - Four Classes With No Face
- **The Shaman, Summoner, Enchanter and Ranger had no look at all.** Last version gave every caster their school's identity — except these four, who had no identity written for them in the first place. They have one now.
- **The Shaman is storm and ancestry** — teal lightning and totem amber, trailing spirit-smoke.
- **The Summoner tears violet**, scattering conjuring runes wherever something is called through.
- **The Enchanter works in mesmeric rose**, bending the air into sigils.
- **The Ranger is moss and worn leather** — no flourish, because a hunter doesn't announce themselves.
- **And the Shaman's storms are finally the Shaman's.** Lightning Spark, Stormcall and Chain Storm were all being drawn as wizard magic — the game read the word "lightning" and stopped looking at who cast it.
- *Known: Bonebreaker, Purify Soul, Barkskin Blessing and Moonfire still borrow the wrong school's colours from words in their names. Left alone deliberately — guessing at intent is how the last four bugs got written.* (Roadmap Item 6.)

## V0.20.21 - Nobody Told The Ring Who Cast It
- **Every caster's spells looked the same.** The Wizard, the Necromancer, the Shaman, the Summoner — all of them threw the same anonymous white ring. **Not because each class lacked a look of its own, but because nothing ever told the effect who cast it.**
- **They had looks waiting the whole time.** Arcane rune fragments, necrotic wisps, druidic growth, bardic sigils — all written, all built, all unreachable. The Wizard's runes have existed for months and had never once been drawn.
- **Now the spell knows whose hand it left.** Arcane magic scatters runes, necromancy trails grave-smoke, druid magic moves like something growing.
- **One fix, not ninety-nine.** Every class spell already passes through a single dispatcher, so that's where the caster's identity is published — which fixes every existing spell and every future one for free.
- **Classes with a hand-made look keep it.** The Cleric's holy light and the Assassin's blades were designed deliberately and are untouched.
- **The Warden was wearing the Cleric's gold.** "Warden" contains "ward", so it matched the holy line before the nature line it was actually written into — a Warden's magic has never once looked like nature. It does now.
- **And every Cleric protection spell has been rendering as necromancy.** "Protect" contains "rot", so the undeath line claimed it first. Your wards were grave-green this whole time.
- *Known: the impact flash when a spell lands is still generic — that one belongs to the damage code, and forcing it here would have broken melee. The Shaman, Summoner, Enchanter and Ranger have no look of their own yet either; that needs colours chosen for them, not wiring.* (Roadmap Item 6.)

## V0.20.20 - The Rogue Had No Knife
- **The Rogue never drew a weapon.** Eleven melee abilities — Backstab, Garrote, Silent Execution — and not one animated a strike. A ring appeared on the floor and the target took damage. **The only melee class in the game with nothing to look at.**
- **Now every knife lands.** Twin Fang uses both blades, Backstab stabs rather than swings, Sap is blunt, Flurry Cut is a mess of crossing cuts, and both executes come down like a decision.
- **The Paladin's hammer falls too**, and the Warden's Stonehand Strike hits like the stone it's named for.
- Some spells were deliberately left plain: a bleed, a garrote wire and a poison aren't shapes this renderer knows, and inventing one would be decoration. (Roadmap Item 6.)

## V0.20.19 - You Can Turn The Shaking Off
- **Settings has an Accessibility section now, and the first thing in it turns off screen shake.** Melee hits, critical strikes and portals all shake the camera. If that makes you ill, it can stop.
- **Nothing else changes.** The hits still land, the crits still crit. Only the camera stops moving.
- **It stays off.** Last version taught the game to remember your settings; this is the first feature that needed it.
- Off by default — a default should never silently change how the game looks for someone who didn't ask. (Roadmap Item 20: 1 of 12.)

## V0.20.18 - The Settings Remember You Now
- **Your settings stick.** Turn off the minimap, reload, and it stays off. It never did — **every UI setting in this game was applied and then forgotten** the moment you refreshed.
- **They were sitting one line above the keybindings**, which have been saving themselves correctly this whole time. The settings just never got the same treatment.
- Settings written by an older version keep your choices and quietly gain any newer ones; a corrupted settings file falls back to defaults instead of breaking the game.
- Found while auditing accessibility (Item 20), where this was the blocker underneath everything: a screen-shake or reduced-motion toggle the game forgets is worse than one it never offered.

## V0.20.17 - What Dying Costs You
- **Dying costs you time and nothing else** — and now that's written down. Food, potions, class buffs, gear, money, experience: all of it survives. You go back to the Dream Spirit and walk out with everything you had.
- **The important part is that it's consistent.** Buffs survive dying **and** survive coming back, so there's no seam where something quietly vanishes.
- **Nothing changed in the game.** This is a written policy of what already happens — measured by killing a character repeatedly, not by reading the code and hoping. (Roadmap Item 24.)

## V0.20.16 - Look At Me When I'm Talking To You
- **People turn to face you when you speak to them.** Cael used to tell you about the road while looking away down it. Everyone in camp now looks at whoever walked up, from any side.
- **And the two who walk now turn as they go.** Last version they patrolled their rounds *sliding* — never facing their direction of travel — because the line meant to turn them called a method that doesn't exist on an NPC, and failed silently. **That was my bug, one version old.**
- Stand exactly on top of someone and they keep facing wherever they were. There is no direction from a person to themselves. (Roadmap Item 16.)

## V0.20.15 - Two People Who Asked To Walk
- **The Mossfang Scout and Road Warden Cael walk their rounds.** Both have carried a patrol — a loop, a radius, a walking speed — since the day they were written, and both stood perfectly still ever since. **Nothing had ever read it.**
- **Cael keeps his post.** He carries six quests, so he orbits his own patch and cannot leave it, he stops the instant you talk to him, and starts again when you're done.
- **The other 31 asked to stand still**, and they do. Only the two who asked to move, move.
- They step around each other and around you, and never onto anything they can't stand on. (Roadmap Item 16.)

## V0.20.14 - The Third Kind Of Dead
- **Nothing changed in the game this time, on purpose.** The next fields on the list turned out to be **deliberate** — `data/resources.js` explains in a comment that they're metadata for a later phase, and that the rule is already enforced physically by where things get placed. So they stay.
- **The tool now knows there are three kinds of "written down and never read":** the **broken** (implement it), the **empty** (retire it), and the **deliberate** (leave it alone). They look identical in a list and want opposite treatment.
- Retired so far: **86 lines** that did nothing. Left alone: everything that was quietly doing something, or waiting to.

## V0.20.13 - The Same Words, Twice
- **33 more dead lines retired.** Every tile wrote its footstep sound, footstep effect and step rate **twice** — once loose, and once inside a profile on the very next line. Only the profile has ever been read.
- **Footsteps are untouched.** Grass still sounds like grass: the profile's `soundSet` was always the one being played.
- **Checked before cutting.** The scanner also flagged `terrainName` and `decalEffectOptional` — but those live *only inside* the profile, which is read wholesale. Cutting them would have been last version's mistake in the opposite direction, so they stay.
- Candidates: 27 → 24.

## V0.20.12 - I Was Wrong About The Heavy Weapon
- **Last version reported a bug that wasn't one.** Thirteen Fighter spells declare they need a heavy weapon and nothing enforces it — which looked like a gate that never gates. It isn't. It's on **every Fighter attack that swings a weapon, including the level-1 basic**, and only **7 of the game's 42 weapons** are two-handed — one of them a wizard's staff. Enforcing it would have left the Fighter unable to attack.
- **53 dead field declarations retired.** A flag that's true of everything says nothing. `requiresHeavyWeapon` and `classMechanic` (identical on all 20 Shaman and all 20 Summoner spells) were **class facts copied onto every spell**, read by nothing.
- **Nothing changed in play** — nothing ever read them. That was the point.
- The scanner's own candidate list drops 29 → 27, closing the loop it opened.

## V0.20.11 - A Map Of What Nobody Reads
- **A tool that finds the bug this run kept finding by accident.** Six times now, a field written with care in the data turned out to be read by nothing: a cone that wasn't, poses nobody could reach, a portrait for every character in the game that was never drawn. Tripping over them isn't a plan.
- **It found more.** Two confirmed: **`classMechanic`** on 40 spells, and **`requiresHeavyWeapon`** on 13 — thirteen abilities that declare they need a heavy weapon and can be cast with a dagger. Plus 27 further candidates to triage.
- **Also triaged:** the tiles' `footstepSound`/`footstepEffect`/`terrainName` are dead but *not* a broken feature — the footstep system reads `footstepProfile`, which carries the same information. Those are superseded legacy, and the honest fix is retirement, not implementation.
- **Advisory on purpose**, not a build failure. It's a heuristic, and it says so — while writing it, both the tool *and* my own triage grep gave confident wrong answers in opposite directions.
- **No gameplay changed here.** This is the map, not the digging.

## V0.20.10 - The Label Nobody Read
- **The game tells you what you can do with what you're standing next to.** A prompt names it — what **E** will do, and what **I** will look at.
- **Waypoints can be attuned, and now say so.** Every waypoint has carried the words *"Attune Waypoint"* since it was written, and there was **nowhere on screen those words could ever appear** — the waypoint system has no panel at all. Nothing had ever told you a waypoint does anything.
- **The prompt reads the object's own words.** The stash authored *"Open Stash"* while the code printed the same phrase from a hardcoded string beside it — so the field was never once read. It is now, and proven so: change a stash's label and the prompt follows it. (Roadmap Item 17.)

## V0.20.9 - Press I And Look At Something
- **You can look at things now.** Press **I** beside anything in camp and it tells you about itself — the quartermaster's tally chalked on his crates, the sparring dummy beaten flat on one side because everyone here favours the same shoulder, the lantern posts the Dead Lantern Trail is named for.
- **Look twice and it says something else.** Nothing repeats the same line back at you.
- **Nothing gives you an item.** It isn't meant to — it's a camp people live in, and now you can read it.
- **Examining has its own key rather than sharing E**, so it can never take a keypress from talking, looting, gathering or crafting. (The E version was built first, measured, and thrown away — see below.) (Roadmap Item 17.)

## V0.20.8 - Two Men In One Pair Of Boots
- **Quartermaster Brann and the Camp Merchant were standing inside each other.** Identical coordinates — two traders in one pair of boots. Item 2 forbids this twice over. Brann has moved to the head of his own supply line.
- **Dead Lantern Camp is a camp now.** It had 5 tents, **one** bedroll and a fire — and zero of the crates, barrels, weapon racks, storage piles, training areas, tables, medical or food/water the spec asks for. It now has a quartermaster's supply line, a sparring dummy and weapon rack, an herbalist's table beside the healer, a study desk beside the arcane trainers, a well, grain sacks and a water barrel by the cook, more bedrolls, a lean-to, two more tents, path torches, a banner and clutter.
- **Everyone has a reason to stand where they stand.** Supplies with the quartermaster, practice gear with the marshal, herbs with the healer, cookware with the cook.
- **Checked, not hoped:** no NPC overlaps anyone, nothing stands on anyone, all 27 camp NPCs are reachable on foot, and all four exits are open.
- The herbalist's table also settles an old debt — V0.18.68 removed it from camp and deferred putting it back to this very item. (Roadmap Item 2.)

## V0.20.7 - Ask Me What I Want
- **You can see what a quest asks before you take it.** The button said *"Accept: Light the Way"* and nothing told you what that meant. The window now lists the work — and once you've taken it, that same list shows how far along you are.
- **Speech looks like speech now.** What an NPC says sits in their voice — italic, behind a speaker's rule. What a quest wants sits in its own frame, upright, with the counts. One is a person talking; the other is a job. They no longer look identical.
- **An offered quest shows what it needs, not "0/5"** — a zero against work you haven't started reads like failure.
- **NPCs are introduced by their role, not their database key**: "Quest Giver", not `quest_giver`.
- The briefing reads the same quest pick the button does, so the two can never disagree — and an NPC with no quest gets no empty frame. (Roadmap Item 5.)

## V0.20.6 - Thirty-Three Faces Nobody Had Seen
- **NPCs have faces now.** Every character you can talk to shows a portrait in the dialogue window — the warden in mail and helm, the cook in her whites, the merchant under his hat, the spirit healers as a coil of light.
- **The portraits were already written.** All 33 NPCs have carried a portrait description — a family, a colour, a badge — since they were authored, and **nothing in the code had ever read it**. Somebody designed a face for every character in this game and not one was ever drawn.
- **It's part of the window, not floating over it.** The portrait sits in the dialogue header beside the name and role, so text can't be overlapped and nothing stretches at any size.
- Drawn from code like every other character in the game, so it matches the style by construction. Unknown or missing portrait data falls back rather than breaking. (Roadmap Item 5.)

## V0.20.5 - What Am I Actually Doing
- **The quest HUD names your objectives now.** It showed a single bar filled by every active quest at once — a percentage of nothing in particular. Track a quest in the journal and the HUD tells you what it wants and how far along you are.
- **Night-only objectives say so.** Three objectives in the game refuse to advance until dark. The engine has enforced that since V0.17.87 and **never told you** — you could stand in the right place doing exactly the right thing and watch the counter not move. They're marked `☾ … waits for dark`.
- **An escort in progress is on the HUD**, with the health of the person you're keeping alive.
- **The tracked-quest limit is one** — the journal's Select button already enforced it; nothing ever used it.
- **Not added:** an optional-vs-required marker. **No objective in the game is optional** (`required` is a *count*, not a flag), so the label would read "Required" on all 38 forever. A word that never varies isn't information. (Roadmap Item 15.)

## V0.20.4 - The Journal Reads What Was Written
- **Your finished quests are a list again, not a number.** The journal counted them — *"Completed 7"* — and showed you nothing else. Every quest you've finished is now there, with where it happened and who sent you.
- **Search, filter and sort.** Search by quest name, by who gave it, or by where it happens. Filter to **Active / Completed / Repeatable / All**. Sort by **level, name or place**.
- **Quest cards now tell you what the quests always knew.** Recommended level, who *sent* you (not just who to return to), and whether it repeats — authored on all 26 quests, never once displayed.
- **Deliberately not added:** a Main/Side split, a quest level separate from the recommended level, and repeatable reset timers. **No quest in the game carries any of that**, so those controls would have been decoration with nothing behind them. They need authoring first. (Roadmap Item 15.)

## V0.20.3 - The Method That Ate Its Twin
- **Webbed bushes and web-strung trees are drawing again.** They had been failing and erroring **every single frame**: `drawOrbWeb` was defined **twice**, so the later definition silently won, the earlier one became dead code, and its three callers passed an options object where a number was expected — `rnd` came through undefined and threw. The per-object render guard swallowed each throw, so the game looked fine and the console scrolled.
- **Cave stairs know which way they go again.** `drawCaveStairs` was *also* defined twice. V0.18.61's Silk Web Cavern version won, so every staircase in the game rendered its steps and lost its **UP/DOWN label** — the exact opposite of what that change's own note promised ("other dungeons keep the old stylised steps").
- The Silk Web Cavern keeps its stone cave mouth. **The working callers were left exactly as they were.**
- **New `tools/check-duplicate-methods.js`** in the release checker. This class is invisible to `node --check` *and* to reading the file, because the code that never runs still looks finished. It found both bugs, reports zero false positives across 193 files, and is negative-tested.

## V0.20.2 - Your Second Character Is Their Own Person
- **Fixed: a new character walked out of the creator wearing your first character's gear.** Reported with a level 1 in full rares at Gear Score 50. They took the inventory, the equipped items, the bags — **and the bank**.
- **It went further than the gear.** A new character also inherited your **completed quests**, your **profession levels**, and your **explored map**. And because the game thought they'd already had a starter kit, they were **denied their own** — so the bug both gave and took away.
- **Root cause:** a character's belongings never lived on the Player. Inventory, equipment, bags, bank and the quest/crafting/gathering states all hang off the *game*, and creating a character only replaced the Player. Loading worked purely by accident of ordering — it overwrites those straight afterwards; creating had nothing to overwrite them with.
- **New characters now start clean:** their own starter gear, an empty bank, no quest history, level-1 professions, an unexplored map.
- **Loading an existing character is unaffected** and was re-verified end to end: gear, bank, quests and profession levels all come back exactly as saved.

## V0.20.1 - Ten Swings, Ten Silhouettes
- **Every Fighter strike now looks like the thing it does.** Eight shared one generic sweep: an armour split, a bone snap, an execute, a shield shatter, a counter-riposte and a reckless wild swing all drew the same arc as level-1 Heavy Swing. Now — **Armor Splitter** rends and parts, **Bonebreaker** cracks, **Shatter Guard** throws shards, **Heavy Riposte** stabs rather than swings, **Reckless Strike** swings off-balance, **Final Swing** lands like a decision, **Crushing Blow** is blunt.
- **Heavy Swing still draws the plain sweep** — it *is* the level-1 basic. Giving it a bespoke look would be decoration, not communication.
- **The effect is authored in the spell's own data now** (`vfxStyle`), beside its damage and its cone — not a hardcoded check on two spell names.
- Unlike the cone, **no validator could have caught this**: nothing was claiming otherwise, no field was inert. It was a design gap, and it needed reading the spells.
- Authoring a style nothing can draw is now rejected by the validator, and the renderer's style registry is checked against the renderer itself — so the list can't quietly become a lie either. (Roadmap Item 6.)

## V0.20.0 - The Capstone That Looked Like Level One
- **Titan Chop and Perfect Masterstroke now land like the heavy hits they are.** Both asked for an overhead **slam** — and nothing in the game had ever drawn one. Only `'claw'` was implemented; every other style fell to the same `else` and drew an identical arc. So the Fighter's **level-20 capstone was pixel-identical to level-1 Heavy Swing** — and sounded identical too.
- **Casters have stopped swinging invisible swords.** Ranged bots and non-undead pets asked for **`'cast'`** and got a melee slash arc. A cast now draws a glyph and rising motes — no blade.
- **Heavy enemy attacks hit with weight.** `'crush'` was never drawn either; it's a blunt pound with debris now.
- Three styles the game had been asking for all along, none ever drawn. Fixing only `slam` would have been a half-fix — the root cause was that `spawnSlash` didn't render every style it was handed.
- **New `tools/check-vfx-styles.js`** in the release checker catches this class at the source. It can't be a runtime validator: the styles are literals in *code*, and the `else` arm means an unimplemented style still draws *something* — just the wrong thing. (Roadmap Item 6.)

## V0.19.9 - The Pose Nobody Could Reach
- **Characters facing due east or west have a proper side profile again.** Two full poses — turned shoulders, one visible eye — were authored into the renderer and then made **unreachable** by a single `|| 1`: `Math.sign(e.facingY || 1)` makes `fy === 0` impossible, so the `fy === 0` branch that selects `'east'`/`'west'` was dead code. Everyone facing straight east or west was drawn as a three-quarter diagonal instead.
- **Casting a fishing line while facing north no longer turns you.** The untargeted cast aimed 45° off — and the next line fed that wrong heading into `setFacingFromDelta`, physically turning the player.
- **Four more sites with the same pattern were checked and deliberately left alone.** They default to `0`, which is the value being defaulted, so they were never broken. Pattern-matching would have churned three files for nothing. (Roadmap Item 6 follow-through.)

## V0.19.8 - Cleave Draws Its Swing
- **Cleave now draws the arc it actually swings.** It tested a 100° wedge *in front* of you and drew a full 360° ring *around* you — a picture telling you the exact opposite of where the blade lands. You now see the real wedge: true angle, pointed where you're facing, reaching exactly as far as it truly reaches.
- **The old ring never showed real dimensions at all.** `spawnRing`'s radius is *screen pixels* (a hardcoded 16), unrelated to the spell's 2.05-tile reach. The new `spellCone` effect is drawn in **world space** — what you see is the area that was tested.
- **Berserker's Roar widens the drawn cone exactly as it widens the real one** (2.05 → 2.65).
- **Groundbreaker and Whirlwind Cleave keep their ring** — a ground slam and a spin genuinely *are* omnidirectional, so the circle is the honest picture.
- The cone deliberately bypasses the effect sprite cache, which keys on `type:color:style:radius:progress` with **no facing** — a baked cone would point the wrong way in every direction but one. (Roadmap Item 6.)

## V0.19.7 - Facing North
- **If you were facing due north or south, your abilities aimed 45° off.** `Number(p.facingX || 1)` — but `facingX` is legitimately `0` when you face north, and `0 || 1` is `1`. Shipping **Cleave** has mis-aimed for any fighter facing straight up or down since it was written. **Blink** and **Illusory Step** teleported diagonally; **Disengage Shot** and **Evasive Step** dodged the wrong way. One shared `actorFacingVector` now serves all six sites.
- **Backstab now knows where your target is looking.** `isRogueBehindTarget` used the mirror-image defaults, so a target facing due **east** (`facingY === 0`) was read as facing 45° — rotating the whole "behind" arc, and landing **Shadowstep** *beside* such a target rather than behind it.
- **Fan of Knives is 108°, not 180° — correcting V0.19.6.** 180 was picked before the VFX was found: `spawnAssassinFanVfx` has drawn a **108° fan since V0.18.29**, so V0.19.6 shipped a hit arc 72° *wider* than the drawn one — closing one mismatch by opening another. 108 is the authored width players have actually been watching, and the visual is now generated **from** that field.
- **One direction.** The cone was centred on your facing while the fan was drawn at the first enemy found — up to half a cone apart. Both now come from a single facing, aimed at your target.
- Fan of Knives (`range` 3 → 3.2) and Cleave (1.85 → 2.05) advertised a **shorter tooltip reach than they really had**. Display-only; the tooltips now tell the truth.

## V0.19.6 - The Cone That Wasn't
- **Fan of Knives is finally a fan.** It called itself a cone in its name, its category (*"AoE Ranged / Cone"*) and its description (*"throw multiple blades in a short cone"*) — and then threw blades in a full 360° circle, hitting people standing **behind** you. It now sweeps a 180° forward arc: everything in front still gets hit, only targets at your back are spared.
- **Cone targeting is no longer a Fighter-only privilege.** The angle test lived as a local closure inside the Fighter's resolver and was hardwired to Cleave, so `coneDegrees` was an inert field for the other 279 spells and no other class could reach the test at all. There is now one shared `spellShapeContains` the whole spellbook uses.
- An enemy standing **exactly** to your side no longer slips out of a half-circle sweep on a rounding error (`Math.cos(Math.PI/2)` is `6.12e-17`, not `0`).
- **Cleave, Groundbreaker and Whirlwind Cleave are unchanged** — verified angle-for-angle (100°/360°/360° before and after). A ground slam and a spin *are* omnidirectional.
- New `validateSpellShapes()` validator section (280 spells) holds the line: a spell that claims a cone must declare one. (Roadmap Item 6.)

## V0.19.5 - What Changed After
- **Every quest-giver now has something to say about what you did for them.** Seven more gained follow-up dialogue that moves their story on instead of repeating a thank-you — Corven has had Aldric's kit carried in and his sister is coming from the coast for it; Cael keeps turning over why bandits would dig in on a road they could just walk away down; Selene warns the quiet at the gap means whatever was coming through has *finished* coming through.
- And at the end of it all, Thalen: *"The seal still holds. The trees have stopped walking — they are waiting now, the same as I am. And that road under the roots has not gone anywhere."*
- **Every quest that can show a follow-up or first-meeting line now has one.** (Roadmap Item 1 — states 7 & 8 complete for all reachable quests.)

## V0.19.4 - The Rurik Choice
- **The bandit fork now talks like a choice.** Both sides tell you what you're trading away before you commit — Rurik names the three wardens on the north road and warns there's no road back; the bounty warns his people will remember your face and no fence will ever deal with you again.
- **The side you turned down says so in their own words.** Cael tells you not to come to him for warden coin if you've been drinking with Rurik; the fence tells you the only ledger you'll be in is the one he keeps for debts.
- **Every locked quest used to answer with "Requirements not yet met."** — a developer string spoken in the NPC's voice. All eight now speak in character. (Roadmap Item 1 — dialogue state 7, and the branch half of state 6.)

## V0.19.3 - Validator Accuracy
- **The content validator stops crying wolf.** Five of its seven warnings were false alarms about content that works fine — it insisted a quest giver must be a townsfolk NPC, so it flagged the bandit king **Rurik** (a mob you hunt, not someone you hand a quest back to) and the dying expedition **survivor** (whose quest is offered by the place you find her, not by a person).
- It now understands a quest can name a **mob or boss**, and that **auto-offered / auto-completing** quests need no NPC at all — while still catching a genuinely unknown name (verified).
- **Two warnings remain, and both are real:** an event points at a starter quest that was never written, and Gloom's Crypt points at a catacombs cave zone that doesn't exist yet. Reported rather than papered over — both are unfinished content, not reference typos.

## V0.19.2 - NPCs Remember What You Did
- **NPCs no longer repeat their thank-you forever.** Once you've helped someone, they now say something that reflects the changed world — Cael tells you a carter followed your lanterns in after dark, Iren tells you she buried the five at the treeline and named them out loud, Selene notes the stone ring has gone quiet since you woke it. (8 quests authored; the rest still fall back to their completion line.)
- **Failure has a voice.** The one quest that can be permanently lost — the fourth expedition member — now has written failure dialogue naming what was lost, replacing a hardcoded system line. That's every failable quest in the game covered.
- A **map coordinate had leaked into the survivor's spoken lines** ("back to the camp (100,100)"); it's gone, and the dialogue check now catches coordinates too. (Roadmap Item 1 — dialogue states 5 & 8.)

## V0.19.1 - Quest Dialogue Pass
- **NPCs no longer read you the controls.** Seven quests ended their spoken lines with instructions like *"press E at each dark post"*, breaking character every time you asked what to do next.
- Those lines are now written in each speaker's own voice — Cael blunt about the lanterns, Iren raw about her people in the cocoons, Selene warning you about waking the stones out of turn — while the practical detail lives in the quest journal where it belongs. The game already teaches the controls in its own tips, so nothing is lost.
- A **new check keeps it that way**: any UI or fourth-wall language written into an NPC's mouth now fails validation. (Roadmap Item 1 — the quest dialogue pass begins.)

## V0.19.0 - Debug Tools (Foundation Complete)
- **Developer debug and content inspection tools** (`DarkWoodsGame.debug.*`) — grant items and money, apply/remove buffs, set skills, set time and weather, inspect any item or loot table, show where every stat comes from, and run the full validation suite. Testing new content no longer needs slow manual setup.
- **Safe by design:** off by default and refuses to run until explicitly enabled, shows a DEBUG badge while active, logs every action, and goes through the game's real systems rather than poking at state. (Roadmap Item 23.)
- **This completes the foundation pass** — data architecture, save migration, effect rules, the stat pipeline, validation, the economy, and now debug tools.

## V0.18.99 - Copper, Silver, Gold & Platinum
- **The whole economy now uses the real currency.** Every price, reward and cost — shops, quests, chests, class training, mercenary contracts and sell-backs — is handled and displayed in copper/silver/gold/platinum instead of a flat "gold" number. All four coins finally mean something.
- **Prices were 100× too high.** Money values were authored on a *silver* scale but were being spent as *gold*, so a basic hood cost ~950 kills. Now: Homespun Hood **22s** (~9 kills), Iron Helm **1g 52s** (~66 kills), Hollowsteel Greathelm **3g 84s** (~166 kills) — and the rare gold coin from a boss is finally a real prize.
- **Selling gear is worth doing again**, with the shop keeping a sane **3–6× margin** (the audit's out-of-scale count went 395 → 0). Class training also no longer disagrees with itself about whether you can afford it (it checked a legacy field but spent from your real purse).

## V0.18.98 - Gold Faucet Fix
- **Letting your bags overflow no longer prints money.** Overflow used to auto-sell the item for its full value *in gold* — roughly **26,000× more** than deliberately selling that same item to a vendor — so overflowing your bags was the most profitable thing you could do, and selling gear was pointless. Overflow now pays exactly what a vendor pays.
- That fix also exposed that **last version's economy audit was comparing gold against copper**, and so reported a reassuring "2× spread" that wasn't real. The audit now compares like for like. The true buy/sell spread is **20,000×–100,000×** on 395 of 396 items — reported honestly as a balance finding for a design decision (no silent rebalance).
- Still true and unchanged: **0 arbitrage** and a perfectly monotonic value ladder.

## V0.18.97 - Economy Audit
- **The shop economy is now checked at launch.** A new audit proves it can't be farmed — buying an item always costs more than selling it back, and the tightest spread in the whole 396-item catalogue is still 2×.
- It also confirms the **value ladder is coherent**: every rarity tier is worth meaningfully more than the one below it (junk 1, common 5, uncommon 52, rare 150, epic 260, legendary 600), so rare gear genuinely feels valuable — and it catches any item that should be sellable but has no value. Runs as part of the validation suite; currently **0 economy issues**. (Roadmap Item 11.)

## V0.18.96 - Poison Resistance
- **Poison resistance is now a real stat.** The silk-cavern venom gear (Venom-Stained Boots, Old Venomsac's Gland, Silk Web Antivenom Charm and the antivenom trinket) and the Antivenom potion all carried a poison-resist bonus that did nothing — it now actually reduces the poison and venom damage you take.
- Generous but **capped** diminishing-returns curve: stacking a full venom kit can cut poison damage by up to 75%, turning the Silk Web Cavern from a war of attrition into a survivable fight. (Follow-up from V0.18.93's data-integrity check, which flagged this as a dead stat.)

## V0.18.95 - Release Validation Process
- **Two more regression checks** — level growth (a higher level gives higher stats) and current-HP ratio preservation (swapping in a +HP item while wounded keeps you at the same percentage, not a free heal) — bring the launch self-test to 14 of 14.
- The checks run by hand each build are now **codified**: a `validate.sh` script runs the JS/JSON/version checks from the command line, and `RELEASE_CHECKLIST.md` documents the full process including the in-browser validation suite. Validation now genuinely runs as part of every release. (Roadmap Item 22.)

## V0.18.94 - Regression Suite: Death & Respawn
- **The launch-time self-test now covers more.** On a throwaway character it proves that respawning restores you to full HP without duplicating any stat bonuses, that two stat items in different slots stack correctly, and (a guard for last version's fix) that gear written with the display-name attributes still grants them.
- The respawn check runs the game's **real respawn code path**, so a future change that breaks it is caught immediately. 12 of 12 checks pass. (Roadmap Item 22.)

## V0.18.93 - Dead-Stat Fix (Intellect / Agility / Spirit)
- **A long-standing bug is fixed: a lot of gear's attribute bonuses did nothing.** Many items listed their bonuses under the game's *display* names — Intellect, Agility, Spirit — instead of the internal attribute keys, so the game quietly ignored them. Affected caster gear (including the Wispflame Focus) and the silk-cavern venom set now grant the attribute they always showed.
- Caught by a **new data-integrity check** that scans every item for stat keys the game doesn't understand — now part of the launch validation suite, which passes clean (0 data issues). (Roadmap Item 22.)
- Note: this restores intended functionality, so those pieces are effectively **buffed** (their previously-dead stats now work).

## V0.18.92 - Consolidated Validation Suite
- **All the launch-time checks are now one report.** Content validation (references, compiler errors, item obtainability) and the stat-pipeline self-test run together and log a single clear line with one overall pass/fail. (`DarkWoodsGame.runValidationSuite()`.)
- Added a **save/load safety check** — loading your gear must reproduce identical stats and never duplicate bonuses.
- Fixed a stale count: the old obtainability check ran before all loot/shop/craft data had loaded and under-reported sources (340/396). It now correctly reads every one of the **396 items as obtainable**. (Roadmap Item 22.)

## V0.18.91 - Stat Pipeline Self-Check
- **An automatic stat-system self-test now runs at every launch.** It confirms that recalculating your stats never quietly duplicates bonuses into your base stats, that equipping adds a bonus exactly once, that unequipping removes it cleanly, and that armour set bonuses apply and drop correctly. The result is logged (7/7 checks pass today).
- It runs on a throwaway character so it can never touch your save — the first automated **gameplay-regression** guard beyond the existing syntax/data checks. (Roadmap Items 14 & 22.)

## V0.18.90 - Stat Breakdown Tooltips
- **See where every stat comes from.** Hover the Damage, HP, Mana, Armor or Speed stats on the character sheet to read a breakdown — the contribution from your equipment, talents, trainer bonuses and set bonuses, on top of base class and level scaling.
- It reads the **same aggregator** the game uses to compute your stats, so the breakdown always matches what combat uses. (Roadmap Item 14 — the "inspectable" half of the stat pipeline.)

## V0.18.89 - Stat Pipeline: Set Bonuses
- **Armour set bonuses are now a first-class stat source.** Set stat bonuses flow through the same single recalculation as your gear, trainer and talent bonuses — added exactly once, and removed the instant a set piece comes off. They are never written into your base stats.
- The **Dark Woods Wanderer** full set now also grants a small aura (**+0.03 speed, +10 max HP**) on top of its +3% experience and faster meditation.
- Groundwork for the character stat-pipeline audit (Roadmap Item 14): one authoritative, inspectable calculation order for every stat. The order is now documented in `docs/V0.18.89_STAT_PIPELINE.md`.

## V0.18.88 - The Dark Woods Wanderer Set
- **The game's first true armour set** — a rare four-piece traveler's outfit (Wanderer's Hood, Garb, Leggings and Boots) with strong stats on their own.
- **Full-set bonus:** wear all four for **+3% experience and 15% faster meditation**. The bonus hooks straight into the existing meditation and XP systems (no separate loop), and the character sheet's Set Bonuses box now tracks your progress (2/4, 4/4, active/inactive).
- **Every piece has a source:** all four drop from the toughest Dark Woods creatures and chests. This **completes the itemization pass** — every equip slot now has a full pool. (Roadmap Item 4.)

## V0.18.87 - Dark Woods Jewellery
- **10 new jewellery pieces** across all four jewellery slots — three amulets, three rings, two earrings and two charms — class-agnostic utility pieces (hp, mana, crit, spell power, healing, resistances) over levels 1–8 in white/green/blue.
- **The earring slot is now filled** (it had no items before). Rings and earrings drop into either of their two slots automatically.
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Wardstone Charm at the campfire. (Roadmap Item 4 C.)

## V0.18.86 - Dark Woods Offhands
- **10 new offhands** in two kinds — four **shields** for the front line (Bark Buckler, Ironbound Shield, Bramblewood Shield, Hollowsteel Bulwark) adding armour and hp, and six caster **focuses** (apprentice orb, gloomweave grimoire, thornroot totem, lumen symbol, bonecarved skull, runespun orb) adding mana, spell power and healing — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Orb for casters, Hollowsteel Bulwark for tanks).
- **Every offhand has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblewood Shield at the campfire. (Roadmap Item 4 B — weapons and offhands now both have pools.)

## V0.18.85 - Dark Woods Weapons
- **10 new main-hand weapons** spread across the class archetypes so every class gains coverage — sword, two daggers, caster staff, shortbow, mace, wand, maul, bonewand and a great reaver — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Hollowbone Wand for necromancers/summoners, Hollowsteel Reaver for the front line).
- Each has a **real damage range and swing speed**; four are two-handed (staff, shortbow, maul, reaver).
- **Every weapon has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Briartusk Fang at the campfire. Offhands come next. (Roadmap Item 4 B.)

## V0.18.84 - Dark Woods Cloaks
- **10 new cloaks for the cape slot** — the light utility slot gets a full pool across caster, agile, healer and front-line profiles, levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Cloak for casters, Warden's Warcloak for tanks).
- Capes are the **light slot**: cloth/leather with lighter armour and utility stats (movement, resistances, crit, healing) rather than raw plate.
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Cloak at the campfire. (Roadmap Item 4 A.)

## V0.18.83 - Dark Woods Boots (Armor Set Complete)
- **10 new boot pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Slippers for casters, Hollowsteel Sabatons for tanks). Armour 1–13 (rarity-scaled).
- **The core armour set is now complete** — head, shoulders, chest, hands, legs, feet and belt each have a full pool across every build.
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Treads at the campfire. (Roadmap Item 4 A.)

## V0.18.82 - Dark Woods Hand Armor
- **10 new glove & gauntlet pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Gloves for casters, Hollowsteel Gauntlets for tanks). Armour 1–13 (rarity-scaled).
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Grips at the campfire. (Roadmap Item 4 A — the hands slot now matches the rest of the armour.)

## V0.18.81 - Dark Woods Shoulder Armor
- **10 new shoulder pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Mantle for casters, Hollowsteel Pauldrons for tanks). Armour 1–13 (rarity-scaled).
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Spaulders at the campfire. (Roadmap Item 4 A — the shoulders slot now matches head/chest/legs.)

## V0.18.80 - Dark Woods Head Armor
- **10 new head pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Cowl for casters, Hollowsteel Greathelm for tanks). Armour 1–13 (rarity-scaled).
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Helm at the campfire. (Roadmap Item 4 A — the head slot now matches the chest and legs.)

## V0.18.79 - Save Migration: New Content Reaches Old Saves
- **New content now appears in existing saves.** The character autosave was baking the whole shipped catalog (items, spells, recipes, quests, mobs…) into your world save, and every launch restored that old snapshot verbatim — so gear added in a newer build (the recent **belts, bags, chest and legs**) never showed up for anyone who had already played once.
- **World load now merges the current game's catalogs *underneath* your saved data:** every new shipped entry appears, while any edits or custom entries in your save still win. Purely additive — no existing save or editor customization is changed. (Roadmap Item 10 — save compatibility & migration.)
- Note: balance changes to an *existing* item and new drops on a *pre-existing* loot table still don't retroactively overwrite your saved copy (saved wins on collision — the safe, non-destructive default). New items stay obtainable regardless, since the camp store and crafting read the live catalog.

## V0.18.78 - Dark Woods Leg Armor
- **10 new leg pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (Runespun Leggings for casters, Hollowsteel Greaves for tanks). Armour 1–14 (rarity-scaled).
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Greaves at the campfire. (Roadmap Item 4 A — the legs slot now matches the chest.)

## V0.18.77 - Dark Woods Chest Armor
- **10 new chest pieces** across all four armor types — cloth (caster), leather (agile), chain (balanced), plate (tank) — levels 1–8 in white/green/blue, including **two class-oriented** pieces (rune vestments for casters, a hollowsteel cuirass for tanks).
- **Every piece has a source:** buy the basics at the camp store, find the rest as drops from Dark Woods creatures / chests, and craft the Bramblehide Cuirass at the campfire. (Roadmap Item 4 A.)

## V0.18.76 - Dark Woods Bags
- **10 new bags** spanning **5–14 slots** across all four tiers — small starter, common field, uncommon reinforced, and rare Dark Woods bags (white/green/blue/purple), levels 1–9.
- **Every bag has a source:** buy the small ones at the camp store, find the bigger ones as drops from Dark Woods creatures / chests, and craft a 10-slot Reinforced Field Pack at the campfire. (Roadmap Item 4 D.)

## V0.18.75 - Dark Woods Belts
- **20 new belts** (the belt slot had exactly one item before). Offensive, defensive, caster, regen, movement and gathering profiles across levels 1–7 in white/green/blue rarity, including **two class-oriented** belts (a nature belt and a caster belt).
- **Every belt has a source:** buy the basic ones at the camp general store, find the better ones as drops from Dark Woods creatures / chests / named rares, and craft a couple at the campfire. (Roadmap Item 4 B — itemization expansion begins.)

## V0.18.74 - Every Item Obtainable
- **The camp general store now stocks the basics a new character needs** — a pickaxe, fishing rods, a herbalist knife and hatchet, and starter bags (pickaxe also at the blacksmith; herbalist knife also at the herbalist).
- Follow-up to last version's obtainability audit: it now also understands **vendor stock and quest-given items**, and every one of the game's **262 items has a real, reachable source** (0 unobtainable). Foundation quality for the gear expansion.

## V0.18.73 - Crafting Redesign & Centered Windows
- **The crafting window got a proper visual pass.** Each recipe is now a clean **card** with the item's icon, what it makes, and **colour-coded material chips** — green when you have enough of an ingredient, red when you're short (each showing have/need) — next to a clear Craft button. Tidier category tabs (pills with counts) and a proper header.
- **Windows open centered.** Any window you open by pressing a button now opens in the **middle of the screen**, overriding wherever it was last dragged. You can still drag it around while it's open.

## V0.18.72 - Crafting Category Tabs
- **The crafting window has category buttons now.** A row of tabs across the top — **All, Armor, Weapons, Cooked Fish, Meals, Health Potions, Mana Potions, Buff Potions** (only the ones the station makes, each with a count).
- **Click a tab to see just that category's recipes** instead of scrolling one long list. The tab you pick stays selected while you craft; the window opens already filtered to the first category.

## V0.18.71 - Obtainability Audit
- **A loot/obtainability audit** (Roadmap Item 12) — a dev/validation tool that checks every item actually has a way to get it, cross-referencing monster loot, boss/chest tables, crafting, quest rewards, gathering, fishing and starting gear. It's folded into the boot validation report (252/262 items sourced today).
- It **already caught a gap**: a *Cooked Forest Stew* with no recipe at all — now brewable at the campfire (gloomleaf + gloomcap) and it grants a Warm Meal food buff.
- Foundation for the loot & itemization expansion coming next. (No other player-visible change.)

## V0.18.70 - Crafting Panel Polish
- **The campfire crafting window is organized now.** Recipes are **grouped by kind** (Armor / Cooked Fish / Meals / Health Potions / Mana Potions / Buff Potions) with headers, and each recipe **shows what it makes** — armor shows its armor + stats; food/potions show the health/mana restored, the buff granted, and the cooldown (Roadmap Item 3 E).
- Fixed a quiet bug behind it: an item's `effectCategory` was dropped when it compiled, so **potions weren't actually sharing their potion cooldown** (and couldn't be told apart from meals). Now health potions share one cooldown and mana potions share another, as intended.

## V0.18.69 - Wildpelt Armor Set
- **A complete craftable Dark Woods starter armor set** — one piece for every armor slot **including the belt**: Wildpelt Hood, Mantle, Vest, Leggings, Gloves, Boots, Cloak and Belt (8 pieces).
- Stitched at the **campfire** from Dark Woods animal materials (Gloom Wolf pelt, Briar Hide, Briar Tusk, Bone Dust) bound with Gloomleaf — finally a use for all those gathered pelts and hides.
- Low starter stats, but a real first upgrade for a poorly-equipped new character (Roadmap Item 3 A).

## V0.18.68 - Herbal Potions
- **Six new potions brewed at the campfire** from gathered Dark Woods herbs: **Minor Healing** & **Minor Mana Draughts** (instant restore, on a potion cooldown), **Regeneration** & **Clarity Tonics** (heal/mana over time), a **Bramblehide Elixir** (+defense/armor) and an **Antivenom Draught** (+poison resistance — handy in the Silk Web Cavern).
- Instant heal/mana potions share a potion cooldown; the tonic/elixir buffs go through the effect policy, so **only one potion buff is active at a time** (a new one replaces the old).
- Part of the campfire cooking & alchemy update (Roadmap Item 3 D), built on the V0.18.67 consumable-buff plumbing. A dedicated alchemist's table lands with the camp overhaul.

## V0.18.67 - Food Buffs
- **Cooked food gives you a buff now.** Foods like Grilled Minnow always *described* a food buff ("Well Fed") but never actually applied it — the buffs were dead data. Eating a food now restores health/mana **and** grants its buff, on a short per-item cooldown.
- **Only one food buff at a time** — eating a new food replaces the old buff instead of stacking (via the shared effect policy).
- First slice of the campfire cooking & alchemy update (Roadmap Item 3), built on the V0.18.65/66 effect foundation. It's the plumbing every future food and potion uses. More foods, fish dishes and herbal potions to follow.

## V0.18.66 - Effect Policy Wired In
- **The effect policy now enforces automatically.** When a categorized effect is applied it's capped/replaced per the central policy (the single enforcement point), and a categorized consumable shares its category cooldown so copies/stacks can't bypass it.
- Inert for all current content — only Bard major songs opt into a category today, and their cap now runs through this one point. It's the mechanism the upcoming food, potions and other consumables (Roadmap Item 3) plug straight into by declaring a category.
- No player-visible change.

## V0.18.65 - Roadmap Foundation: Effect Policy
- **First step of the master roadmap.** Added one authoritative, data-driven **effect policy** (`core/effect-policy.js`) that defines how buffs, debuffs and consumables **stack, cap out, and share cooldowns** — so those rules live in one place instead of being hard-coded system by system (Roadmap Item 13).
- The **Bard song cap** now reads its limit from that policy instead of a hard-coded number, and **food / potion / cooldown categories** are pre-defined so the upcoming campfire cooking & alchemy build slots straight in.
- No player-visible change — it's the groundwork the content systems will sit on. (The roadmap's data-driven *content* architecture is already largely present via the existing descriptor registry.)

## V0.18.64 - Torch Light
- **Torches emit light now.** The Silk Web Cavern is darker, and each torch casts a **warm, flickering pool** of light that projects out through the darkness. (Before, the full-screen darkness overlay was drawn *over* the torch flame, so the torch lit nothing.)
- **Your party carries a faint light** so you're never standing in total black with no torch nearby — torches still clearly dominate.

## V0.18.63 - Wall Cut-Away & Bard Songs
- **Walls no longer render over your player, bots, mercs or pets.** V0.18.62's depth tweak wasn't enough — a tall cave wall in front of one of your party still covered it. Now any cave wall that would cover a friendly actor is **cut away** (drawn only by the base pass, behind the actors), so your characters stay visible at **any camera angle**. Walls still hide **enemies** that are behind them.
- **Bards can keep up to 5 songs active at once** (was 2).

## V0.18.62 - Silk Depth Fixes
- **Webs no longer render over the tops of the walls.** The wall silk (sheet, drape strands, cross-weave, corner orb webs, and the "curtain" variety that used to hang past the face bottom) is now clipped to each wall face, so in the tiered caverns it stops caking the flat wall/ledge tops and the floor in front — it stays strictly on the vertical faces.
- **Wall corners no longer render over players, mercs, pets and mobs** standing at or in front of a wall. The cave-wall depth-sort no longer over-reaches past its own front corner (dropped a hidden `+0.38` forward bias), and on an exact depth tie the character now wins and draws on top. Anyone genuinely *behind* a wall is still hidden by it.
- Re-enter / descend the Silk Web Cavern to see the web change (the occlusion fix is immediate).

## V0.18.61 - Webs, Eggs & Cave Stairs
- **The ground webs look like spider webs now** — a proper woven orb web (radial spokes + capture spiral + silk beads) instead of concentric ripples — and they vanish about 30 seconds after they appear.
- **Bigger, more varied egg piles.** Large and small piles with different-sized eggs, some cracked open with a hatchling inside, draped in webbing and guarded by crawling spiders (royal/pink on floor 3).
- **Natural cave stairs.** The stairs between floors are now rough stone steps descending into a dark cave mouth, flanked by rock and cobwebs, instead of the old flat steps.
- *Still coming: the depth fixes so walls don't render over players and webs don't render over wall tops.*

## V0.18.60 - Fixes & Polish
- **Fixed the dark overlay** not covering the whole screen when zoomed in (it was sized in device pixels instead of CSS pixels).
- **The torch is ~40% smaller now** and the flame animates more smoothly (gentler, slower flicker).
- **A big "Silk Web Caverns" title card** now pops up in the middle of the screen when you enter/descend the dungeon, then fades after ~2 seconds.
- **Fixed:** click-to-move no longer works while you're rooted (it now respects root, like keyboard movement does).
- *More of the request is still coming: redesigned + expiring spider-web shots, better egg piles, natural cave stairs, and the wall-over-player depth fixes.*

## V0.18.59 - Stalactites & a Dark, Foggy Cave
- **Stalactites and size variety.** Stalagmites now come in five sizes (extra-small to extra-large) plus floor-to-ceiling columns, and there are hanging stalactites from the ceiling now too (also in five sizes) — all over the rooms and tunnels, some draped in silk.
- **A dark, foggy night.** The cave is darker inside now, like night (a dark tint + a soft vignette so it feels enclosed), with a slight layer of pale fog slowly rolling across the ground.
- *Re-enter / descend the Silk Web Cavern to see the stalactites — floors regenerate on entry.*

## V0.18.58 - Real Torch & More Stalagmites
- **The torch looks like a torch now.** It was a stick with a solid yellow triangle on top that read as an arrow. It's rebuilt as a proper torch — a wooden handle, a pitch-soaked wrapped head, and a layered flickering flame with a warm glow and rising sparks.
- **Way more stalagmites.** Small ones everywhere, plus large ones and floor-to-ceiling stalagmite columns in every room (not just the big caverns), and stalagmites along the tunnels too — some draped in silk. (They also vary now instead of being identical.)
- *Re-enter / descend the Silk Web Cavern to see the stalagmites — floors regenerate on entry.*

## V0.18.57 - Silk Caverns: The Great Web Lair
- **Way more, and thicker, hanging webs.** About 30% more floor-to-ceiling web columns in every room and denser along the tunnels, and about half of them are now the big super-thick variety (widened further).
- **A massive web lair.** Each floor now has one giant floor-to-ceiling web structure in its biggest cavern, with everything crammed inside it — multiple web nests, a big matriarch spider lurking in the middle, swarms of tiny spiders crawling around it, lots of bones, lots of eggs, cocooned bodies, and webbed stalagmite columns.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.56 - Silk Caverns: Mixed Web Columns
- **Every hanging web column is different now.** Each one independently rolls its own mix of things — egg sacs, a web nest, bones, a cocooned body, crawling spiders — so you'll see some bare, some with one thing, some with two, some with everything, all mixed up across the cavern.
- **Fixed a bug that made them all identical.** Columns (and the junk/bone piles and nests) were placed without a random seed, so they all shared one sequence and looked the same. They're now seeded from their tile position, so every instance is unique.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.55 - Silk Caverns: Web Cleanup & Rich Columns
- **Removed the ugly grid/curtain webs** — the rectangular net-grid webbing (`webCurtain`) and the sparse hanging curtains/fans (`heavyWebCurtain`, `silkStrands`) are gone.
- **The floor spiders crawl slower** now instead of scurrying (movement speed 1.15 → 0.5).
- **More web columns, and each is full of life.** The hanging columns are denser, and every one now has tiny spiders crawling up and down it, a body cocooned in the silk, bones tangled at the base, and egg sacs. The webbed junk and bone piles on the ground have crawling spiders on them too.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.54 - Silk Caverns: Crawling Spiders
- **The tiny spiders actually crawl now.** They were drawn as a static shape, so on the floor they slid around and on the walls they spun in circles. They now have a real stepping leg gait (each leg swings and lifts out of phase), the legs only "walk" while the spider is actually moving, and every spider faces the direction it's travelling — the wall spiders walk back and forth across the web instead of spinning in place, and the nest spiders step as they orbit.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.53 - Silk Caverns: Squish Crash Fix & More Webs
- **Fixed the crash when you step on a ground spider.** Squishing one threw a "CanvasRenderingContext2D.ellipse: Negative radius" render fault that blacked out the screen — the squish-splat fade compared two different clocks (`performance.now()` vs the `Date.now()` the death was stamped with), which drove the splat radius negative. Fixed; squishing spiders is safe now.
- **More little spiders on the ground** to step on (the ambient-crawler spawn count is roughly doubled).
- **Webs in every room and tunnel.** Floor-to-ceiling web columns now appear in every room (including the entry and treasure rooms) and along the tunnels/corridors, so no passage is bare.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.52 - Silk Caverns: Real Spider Webs
- **The hanging web columns look like real spider webs now.** They were still reading as a rectangular net grid however much they were jittered; they're rebuilt as a vertical stack of proper orb webs (radial spokes woven together by a dense capture spiral) hung on organic anchor threads — the net grid is gone entirely.
- **The crawling spiders are faster.** The tiny spiders on the walls and on the nests now crawl ~3–4× quicker so you can actually see them move.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.51 - Silk Caverns: Cleanup & Living Spiders
- **Removed the weird black circle** on the floor (the "pitShadow" prop) and the **tan/yellow triangles** hanging from the ceiling (the "stalactiteCluster" prop).
- **The tiny spiders are alive now.** The little spiders on the wall webs and on the giant spider nests slowly crawl around instead of sitting frozen — drifting across the webs and orbiting the nests, turning as they go — so the caverns feel like they're actually crawling with life.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.50 - Silk Caverns: Organic Webs
- **The webs look less geometric.** The floor webs and the floor-to-ceiling web columns were reading as a rigid mesh — a field of bright dots and straight star-spokes on the floor, and a rectangular net grid on the columns. The floor's harsh junction dots are cut right down and its orb webs now read as soft coiled spirals (dimmed spokes, denser spiral), and the columns are re-spun with heavily jittered irregular cells and more embedded orb webs — so both read as organic spider silk instead of a mesh.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.49 - Silk Caverns: Wall Webs & Crawling Spiders
- **The wall webs come in varieties now.** Instead of every wall looking the same, each stretch of webbing is different — some are heavy curtains hanging all the way down to the floor, some are hung with egg sacs, and some have tiny spiders crawling on them.
- **Little spiders crawl around the dungeon.** Harmless tiny spiders now wander the cavern floor on their own. They don't fight — but step on one (you, a merc, a pet, or a bot) and it gets squished.
- *This completes the "spiders live here" request. Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.48 - Silk Caverns: Spiders Live Here
- **Egg spiders are actually tiny now.** The baby spiders that hatch from eggs were rendering full-size — the sprite cache was quietly forcing every small spider to share one baked size, so shrinking them did nothing. Fixed (cache now keys by exact size), and the hatchlings are proper tiny skitterers.
- **The floor webs look like real spider silk.** The floor was a rigid geometric triangle grid; it's now an irregular woven cobweb (jittered anchors + sagging silk) with orb webs, so it reads as organic silk you're standing in.
- **It looks like an actual cave.** Little rocks (some webbed) and stalagmites — small, large, and floor-to-ceiling columns, some draped in silk — are scattered around.
- **Giant spider nests.** Really large silk nests with a big spider lurking inside (eyes glowing in the dark), egg sacs, and tiny spiders crawling all over them now sit in the big caverns and brood rooms.
- *Still coming next: wall-web varieties (webs stretching to the floor, some with eggs, some with spiders on them) and little free-roaming spiders you can squish. Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.47 - Silk Caverns Web Columns
- **The floor-to-ceiling webs actually look like spider webs now.** The web columns were a bundle of near-parallel vertical threads, so they read as stringy white lines. They're rebuilt as a real woven net — crossing threads that form irregular web cells — with one or two orb webs woven into each (radial spokes tied together by a spiral, the classic spider-web shape), bright silk beads at the junctions, and a translucent silk sheet behind them.
- *The V0.18.46 nests, egg sacs and webbed bones on the columns are still there. Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.46 - Silk Caverns Web Visual Overhaul
- **All the webs are redone.** The floor and ceiling webs now read as thick, woven silk — the floor orb-webs are real radial spokes tied together by a capture spiral with bright silk beads at the junctions, and the floor-to-ceiling columns are cross-woven and beaded instead of loose parallel threads.
- **Ceiling web nests.** The big thick web columns grow a large woven nest partway up — rings and spokes around a dark funnel mouth, hung with egg sacs — so the caverns feel actively infested.
- **Webbed bone piles.** Piles of *actual* bones — skulls with eye sockets, jaws and teeth, knob-ended leg bones, ribcages — are scattered across the ground and cocooned in webbing, in large and small piles. "People die here."
- **Overwhelmingly infested.** The bone piles are mixed in among the web columns throughout the big caverns and tunnels, and the thick columns have bones tangled in the silk at their base.
- *The V0.18.45 hazards (egg baby spiders, the ceiling-drop spider fix, the boss entrance seal) are still in place. Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.45 - Silk Caverns Infestation & Hazards
- **Webs everywhere.** Far more floor-to-ceiling web columns in every room, in varied sizes — from thin wisps up to extremely thick, ~3-tile-wide silk curtains — so the caverns actually read as infested.
- **Baby spiders in the eggs.** Some egg clutches (the "Twitching" ones) hide baby spiders — walk over or smash them and the babies burst out and immediately swarm you.
- **The ceiling-drop spider is visible again.** Spiders that web down from the ceiling now have a proper model the instant they land. They used to be invisible (pushed to the AI list but not the render list), so your bots swung at nothing.
- **…and they drop far less often** — roughly once every 1–2 minutes, at most two at a time — so a ceiling ambush stays a scare, not a nuisance.
- **No escaping the boss.** The floor-1 boss entrance now seals the whole doorway wall-to-wall and floor-to-ceiling as one giant continuous web with no edge gaps, and it only slams shut once you've *fully* walked into the arena — no more sealing at the threshold and letting you slip back out an edge.
- *Re-enter / descend the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.44 - Silk Caverns Floors 2 & 3
- **Floors 2 & 3 rebuilt to the floor plan** (completing the layout rebuild). Floor 2: Echoing Cavern → Webbed Alcove (mini-boss) → Underground Pool → Nesting Grounds (mini-boss) → gate → the Chasm Overlook boss. Floor 3: Silk Cocoon Hall (mini-boss) → The Great Nest → Brood Nursery (mini-boss) → the Chitin Gauntlet → the Matriarch's Lair boss (with a broodpool).
- On both floors the two mini-bosses guard the boss (killing them opens the gate) and there's a dead-end pocket to explore, matching the plan.

## V0.18.43 - Silk Caverns Floor 1
- **Floor 1 rebuilt to the new floor plan.** Entrance → Webbed Tunnels → Spider Cavern (with an underground pool) → Web Bridge Room / Egg Sacs Chamber → a sealed web gate → the Broodmother Arachnis boss → stairs down. The mini-boss (Threadjaw Alpha) guards the way and opens the gate to the boss when killed, and there's a collapsed dead-end pocket to explore.
- Floors 2 & 3 keep their current layout for now — walk Floor 1, and if it plays well the same rebuild comes to 2 & 3.

## V0.18.42 - Boss Seal & Telegraphs
- **No escape from the broodwarden.** When you engage the floor-1 boss, three spiders scuttle to the room entrance and spin it shut with a web barrier that grows across the doorway — you're trapped until the boss is dead, then the web tears open.
- **See the strike coming.** Boss and miniboss ground attacks now telegraph — a red danger marker appears on the floor exactly where the attack will land a moment before it hits, so you can move out of it.

## V0.18.41 - Silk Cavern Revamp
- **Tunnels and pockets.** Narrow tunnels now snake off the main path into small dead-end pocket caverns, alongside the big rooms — the cavern feels like a real spun-out warren.
- **The place is crawling.** Far more spiders in every room — tiny babies, little skitterers, tanky big broodmothers, plus the elites and everything else.
- **Webs everywhere, floor to ceiling.** Thick silk columns spun from the floor up into the ceiling, and big webbed junk piles with armor, weapons and bones cocooned in the silk — the spiders keep their kills' gear.
- *Re-enter the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.40 - Silk Floor Webs
- **The floor is finally webbed.** The dense floor webbing added in the last couple of updates never actually showed — the cavern floor is drawn as cached terrain that was skipping the web layer entirely. It now draws every frame, so the whole floor reads as woven silk with thin dirt paths through it. That's why it kept looking bare no matter what.
- **Walls caked heavier.** The wall webbing is much denser now — a silk sheet over each face plus thick drapes, a diagonal cross-weave, and orb webs in the corners.
- *Re-enter the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.39 - Silk Cavern Entrance
- **Walk in and you're in.** Walking into the Silk Web Cavern mouth now teleports you inside immediately — it used to only trigger after you walked past it and back out.
- **A real cave, not a floating arch.** The entrance is now dug into an earthen hill (grassy crown, dirt banks) and its mouth is choked with webbing — a giant orb web filling the opening, heavy silk drape curtains, and hanging egg-sac cocoons. It finally looks like a spider lair.

## V0.18.38 - Infested Silk Cavern
- **You're standing inside the web now.** The cavern floor is mostly webbing — webs layered on webs, with only thin dirt paths winding through — and the walls are coated in thick layered silk curtains instead of a few loose threads.
- **Baby spiders you can actually see.** Eggs now hatch a swarm of tiny spiderlings with proper little baby-spider models, and smashing an egg plays a shell-bursting animation.
- **Things drop on you.** Spiders web down from the ceiling on silk lines near you as you explore.
- **Break the bodies.** Big web-wrapped victims hang in the webs — walk into one to tear it open and a skeleton tumbles out onto the floor.
- *Re-enter the Silk Web Cavern to see it — floors regenerate on entry.*

## V0.18.37 - Silk Cavern Web Coverage
- **The Silk Web Cavern is actually webbed now.** The last update only scattered a few web props while the ground and walls stayed bare. Now the floor of every room *and* corridor is a dense woven-silk mat — continuous strands strung across the whole floor with orb-webs woven through it — and silk drapes hang down the cavern walls. It finally looks like spiders live here. (Re-enter the cavern to see it — floors regenerate on entry.)

## V0.18.36 - Bug Fixes
- **Snare roots grab your feet, not your waist.** When a rotling roots you (or a companion), the grasping roots now wrap the ankles at ground level instead of clinging to the hips. Humanoids draw their feet well below where the roots were anchoring, so the snare was riding up the body.
- **No more living "Corpse Bag" boars.** When several corpses merge into one loot bag it gets named "Corpse Bag (N)". A respawning monster used to come back alive still wearing that name (and a threat bar) — it now respawns with its real name and no leftover loot-bag state.
- **Companions stop standing on top of you.** When a merc, pet, or NPC shares your tile they no longer paint over you; the player now wins the overlap. An actor clearly in front of you still correctly blocks the view.

## V0.18.35 - Web Silk Cavern Update
- **The caverns are crawling now.** The Silk Web Cavern's floors and walls are blanketed in far more webbing, and every room is strewn with web-wrapped corpses, bone middens and cocooned victims — it finally reads as "spiders live here and people die here."
- **Smashable Spider Eggs.** Pale egg clutches sit in the nests. Break one — just walk into it — and it either hatches a swarm of baby spiders or spills loot stashed in the silk.
- **Venom Eggs.** Small, dead, green venom-filled eggs are scattered through the venom rooms. Walk over one, or smash it, and it bursts and poisons you. Watch your step.

## V0.18.34 - Rendering Fixes
- **Snare roots stay on the ground.** When a rotling roots you, the grasping roots now wrap your ankles at ground level instead of climbing up to your waist.
- **Herbs and resources sit under you.** Herbs, ore, and other gatherable nodes now draw as a ground layer **beneath** players, party bots, monsters, and pets, instead of drawing on top of them.
- **Webbed corpses look webbed.** Silk-wrapped corpses have been redrawn to actually look like a body cocooned in spider silk — woven criss-crossing strands, cinched wraps, a body shape showing through, and web threads anchoring it — instead of a flat striped blob.

## V0.18.33 - Portals Always Return to Camp
- **The portal takes you to camp again.** It was sending you to a random old wilderness spot whenever you cast it near camp. Pressing **T** now always opens a portal to Dead Lantern Camp; walk into it to travel there, then walk back through the return portal to come back to exactly where you cast it.

## V0.18.32 - Walk-Through Portals
- **Portals no longer teleport you instantly.** Pressing **T** now opens a portal a couple of tiles in front of you — you have to **walk into it** to travel back to camp.
- **A return portal waits for you.** When you arrive at camp the return portal opens nearby (not on top of you), so you can restock and then walk back through it to return to exactly where you cast it.
- **One round trip.** After you walk back through, the portal closes.

## V0.18.31 - Cleric Spell Animations Revamped
- **Every Cleric spell now looks holy.** No more generic bolts and rings. Heals bloom in radiant light with a golden cross and rising sparks, Renewing Prayer keeps a gentle glow, and AoE heals (Divine Light, Hymn of Renewal) ripple radiance across the whole party.
- **Wards and blessings.** Holy Ward, Sanctuary, Blessed Barrier and Guardian Prayer raise a shimmering golden dome; Cleanse and Purify Soul flush the harm upward and shake off the dark specks.
- **Wrath of the light.** Smite, Judgment Light and Exorcise Evil slam a pillar of light down onto the target and bloom, Turn Undead bursts a repelling nova, and Radiant Revival raises a fallen ally on a rising column of light.

## V0.18.30 - Bard Spell Animations Revamped
- **Every Bard spell now looks like what it is.** No more generic bolts and rings. Songs bloom as expanding waves of music, colored to their purpose — **green** for healing (Song of Mending), **blue** for mana (Mana Melody), **red-gold** for war (Battle Hymn, Chorus of War), **cyan** for the drumbeat, **teal** for harmony — and the big anthems (Legendary Ballad, Dreamsong Crescendo, Hymn of Courage…) swell into a grander wave with buff-flashes on your allies.
- **Sonic attacks cut.** Quick Note, Dissonant Chord, Mournful Note and Final Refrain fly as crescent sound-blades in their own colors.
- **Lullaby, Dirge, and the weaves.** Lullaby drifts drowsy purple notes over the target, Dirge of Weakness bursts a harsh discordant corona, and the self weaves (Echoing Verse, Songweave) shimmer around you.

## V0.18.29 - Assassin Spell Animations Revamped
- **Every Assassin spell now looks like what it is.** No more generic purple bolts and rings. Thrown knives tumble end-over-end; crossbow bolts fire as distinct shots — a quick light bolt, a heavy armor-piercing quarrel that punches clean through, a green venom bolt, and a lethal crimson executioner bolt.
- **Signature spells feel signature.** Fan of Knives throws a real fanned cone of blades, Repeater Burst rattles off five staggered bolts, and Ricochet Blade visibly bounces to a second target.
- **Traps and zones read clearly.** Tripwire, Poison Snare and Springblade deploy as wires (poison ones drip green, springblades snap steel), and Death Box lays down a mechanical kill-zone of tension wires and blade nodes.
- **Buffs have their own flourish.** Quick Reload snaps a crossbow ratchet, Silent Step vanishes into shadow smoke, Shadow Fuse whips out violet fuse-lines, Black Lotus Venom sweats venom, and Perfect Ambush flares a lethal sigil.

## V0.18.28 - Capes Fixed on Every Class (and K Works Again)
- **K opens the Professions & Skills window again.** Merging the two windows last update accidentally left two K handlers that cancelled each other out, so K did nothing. There's now a single handler — K opens the window, K closes it.
- **Capes cover your gear on every class.** The cape fix now applies to all classes, not just the Bard. When you face away, the cape drapes over your belt pouches, quiver, instrument and weapons instead of them showing through — Paladin, Ranger, Wizard, Cleric, Druid, Bard and the rest. Front and side views are unchanged.

## V0.18.27 - One Skills Window
- **Professions and Skills are now a single window.** They used to be two separate panels that both popped up on K and could get out of sync. Press **K** to open one "Professions & Skills" window showing all six professions plus Meditating, and press **K** again to close it. The menu's Skills button opens the same window.

## V0.18.26 - Cape Covers Your Gear
- **No more gear poking through the cape.** On a Bard seen from behind, belt pouches, the instrument and other back-worn items were drawing on top of the cape. The cape now drapes over all of it when you're facing away, so nothing shows through — front and side views are unchanged.

## V0.18.25 - Spider Webs Hold Still
- **Spider webs keep their shape now.** The new webs looked great but subtly shifted and re-wove themselves as you walked past. Their random shape was tied to where they sat on screen, so it re-rolled every time the camera moved. Each web is now pinned to its spot in the world, so it holds one fixed shape no matter where you stand.

## V0.18.24 - Spider Webs Revamped
- **Spider webs actually look like spider webs now.** The old webs were flat rings — like a radar target — sitting on the ground. They're now drawn the way a real orb web is built: uneven spokes with a spiral capture thread that sags between them, an off-centre hub, and a faint silky sheen.
- **Webs are attached to things.** Every web now has support threads tying it to whatever it hangs on — the sprigs of a bush, the branches of a dead tree, or the ground around a cave web — so it looks strung in place instead of floating.
- **Right-sized.** A sizing bug was blowing webs up to more than double their size (like a building); they now sit at their proper, natural size.

## V0.18.23 - Fishing Line Fix (Bard & Druid)
- **The fishing line attaches to the pole again.** For Bard and Druid characters the line was hanging from the body instead of the tip of the rod. Their fishing rods weren't reporting the tip position the way every other class does, so the line had nothing to anchor to. Both are fixed — the line now runs from the rod tip to the bobber.

## V0.18.22 - Seamless Ground
- **The ground darkening is smooth now.** The last update swapped the overlapping ground circles for flat tiles, which left a diamond grid pattern across the forest floor. The Dark Woods depth-shading is now blended into a seamless, even gradient — no circles and no grid.

## V0.18.21 - Object Sizes & Ground Fix
- **Tents, wells and buildings are the right size now.** Structures were drawing far too small — smaller than your character. Tents, wells, huts, stalls and other built objects now scale to a believable size, so a tent or well is clearly bigger than a person, the way it should be.
- **Objects sit properly on the ground.** Everything grows upward from its base, so the bigger props stay planted on their tile instead of floating.
- **Removed the weird overlapping circles on the ground.** The Dark Woods depth-shading used to tile out as an overlapping ring/scale pattern across the forest floor — it's now a smooth, even darkening with no circles.

## V0.18.20 - Bug Fix: Combat Effect Crash
- **Fixed a visual-effect crash in combat.** A bad colour value in some spell/impact effects was making the game's effect renderer throw an error every frame (the effect would silently fail to draw and spam the error log). The colour handling is now crash-proof, so those effects render correctly.
- A full review of the rest of the game (all classes, panels, combat, saving/loading, death, zone changes) came back clean.

## V0.18.19 - Bigger Talent Icons
- **Cleaner tiers.** Removed the "T1 / T2 / …" tier labels down the side of each talent tree — the greyed-out locked talents already make the tiers clear, and the point requirements still show when you hover a talent.
- **Bigger, bolder icons.** The talent icons are now noticeably larger and spread out to fill each tree, so they're much easier to see and read. The whole tree still fits on screen with no scrolling.

## V0.18.18 - Talent Tree Cleanup
- **The whole talent tree fits on screen now.** No more scrolling or cut-off rows — the tree was compacted and the window is centred and clamped so all three specs and every tier are fully visible.
- **Everything lines up.** Talent names now reserve a consistent height, so the rows align neatly across all three specialization trees.
- **A cleaner route.** The connecting lines are now a single continuous glowing "spine" running down each tree (lighting up in the spec's colour as you unlock tiers), with the paired talents joined by clean links — much tidier than before.

## V0.18.17 - Talent Tree Revamp
- **New spec backgrounds.** Each specialization's talent tree now has its own painted background art, giving every tree a distinct look.
- **No more lock icons.** The padlock icons are gone — locked talents are simply greyed out, which is cleaner and easier to read.
- **Connected talent routes.** The talents in each tree are now joined by lines that show the route through the tree, lighting up in the spec's colour as you unlock each tier.

## V0.18.16 - A Living World (Adventurer AI Complete)
- **The living-world adventurer update is complete.** A cast of a dozen recurring adventurers now lives its own life in the Dark Woods — choosing daily activities, travelling and questing in parties, hiring mercenaries, earning gold and gear, building reputation and titles, falling and recovering at the spirit healer, and answering caravans, beast hunts and calls-to-arms — all whether or not you're there to see it.
- **This final update tuned it all for real play** so the world stays lively and believable, and confirmed it runs with no impact on your frame rate. Check in with `/who` across your journeys and you'll watch names like Arlen the Hunter grow from unknowns into renowned heroes.

## V0.18.15 - Something's Always Happening (Phase 8)
- **The world stirs with events.** From time to time a **merchant caravan** rolls through, a **rumored beast** is sighted in the deep woods, or a **call to arms** rings out over the camp — announced in your log.
- **Adventurers answer the call.** Those of a fitting level drop what they're doing and head out to join in — trading with the caravan for coin, hunting the beast for glory (and sometimes dying trying), or rallying to defend. When the moment passes, they drift back to their routines.
- **A little camp life.** When several adventurers are in town for the day, they gather to rest and swap stories around the campfire.

## V0.18.14 - Legends in the Making (Phase 7)
- **Adventurers build a reputation you can see.** As they quest and survive, they climb through standings — Unproven, Known, Respected, Renowned, Famed, Legendary — shown right in `/who`.
- **They earn their names.** An adventurer who rises to renown without a title earns a fitting one for their class (a Fighter might become "the Bulwark", a Cleric "Lightbringer"), and word of the notable ones spreads in your log — so over a campaign a handful become recognizable, recurring heroes of the Dark Woods.

## V0.18.13 - Danger, Death & the Spirit Healer (Phase 6)
- **Adventuring is now risky for the adventurers too.** When one gets battered down to critical health out in the field, it can fall — and gets carried back to the spirit healer, losing a bit of experience and gold before recovering and heading out again. No one is ever gone for good.
- **Healers keep people alive.** An adventurer with a healer in the party (or a hired cleric) takes far fewer casualties — so the tanks and clerics earn their keep, while the reckless glass-cannons rack up the war stories.
- `/who` now shows a `†` count for adventurers who've fallen and come back.

## V0.18.12 - Adventurers Hire Help & Mind Their Purse (Phase 5)
- **Adventurers hire mercenaries.** When a group is missing a tank or a healer, whoever can afford it hires a mercenary to fill the gap — and a wealthy lone adventurer will pick up a bodyguard. They pay upkeep each day, and if they run short, the mercenary walks.
- **They earn and spend like you do.** Adventurers buy supplies before heading out, repair their gear, sell off the equipment they've outgrown, and — when they're broke — go gather resources instead of paying to adventure.
- `/who` now shows each adventurer's gold and how many mercenaries they're keeping.

## V0.18.11 - Adventurers Grow Over Time (Phase 4)
- **The adventurers now level up and prosper on their own.** Even when you never cross paths with them, they gain experience and levels, earn gold, upgrade their gear, and build a reputation as they adventure day after day — so over time some naturally become seasoned, well-known names.
- **Their days have consequences.** Resting in town heals them up; hard group raids level them fast but leave them battered; they spend a little gold on supplies before each trip.
- Check in with `/who` over several in-game days and you'll see levels and reputations climb.

## V0.18.10 - Adventurers Live by the Day (Phase 3)
- **Every dawn, the adventurers decide what to do.** Each new in-game day they pick an activity — resting or crafting in town, gathering, or heading out to adventure solo or in a group — following a natural spread across the population.
- **They band together and travel.** Adventurers who choose a group hunt form small (3–4) or large (5–6) parties and set out together, journeying farther and deeper the higher their level.
- **The world shifts day to day.** Because they travel to their destinations, where you run into a given adventurer changes from one day to the next — the woods feel less static.
- Your own companion squad stays with you as before. Use `/who` to see everyone's current activity.

## V0.18.9 - Adventurers Appear in the World (Phase 2)
- **The named adventurers now actually show up.** As you explore, adventurers like Arlen the Hunter or Doran come to life near you as real characters wandering the Dark Woods — and quietly fade back into the background once you've moved far away, so the world stays populated without ever slowing down.
- **They remember where they were.** When one fades out, the game remembers their spot and state, so they're still there (roughly) when you return.
- Type `/who` to see the roster — a `●` marks the adventurers currently active in the world near you.
- Foundations for the next steps: they'll soon pick daily activities, travel, quest, and hire mercenaries.

## V0.18.8 - A Living World Begins: Named Adventurers (Phase 1)
- **The world now remembers a cast of adventurers.** A dozen recurring named adventurers — like **Arlen the Hunter**, **Mira the Kind**, and **Sable the Grey** — now exist as persistent characters saved with your game.
- **See who's out there with `/who`.** Type `/who` in chat to list the known adventurers with their race, class, level, and reputation.
- This is the **first step** of a larger update that will bring these adventurers to life — traveling, questing, hiring mercenaries, and adventuring the world on their own. For now it's the persistent foundation; more to come.

## V0.18.7 - New Music
- **A main menu theme.** The title/menu screen now has its own music that starts as soon as you interact with it, and fades into the game's music once you enter the world.
- **New Dark Woods music.** The overworld's ambient track has been replaced with a proper new recording.
- **The Silk Web Caverns have their own dungeon theme.** That dungeon now plays its own dedicated track instead of the generic cave ambience (other caves are unchanged).

## V0.18.6 - High-Poly Spider Webs (Art Groundwork)
- **Behind-the-scenes art upgrade for the Silk Web Cavern.** Produced detailed high-poly source geometry for all the cavern's webs — twisted rope-like anchor cables, sagging debris-laden web curtains, mummiform prey cocoons (some with a victim's hand pressing through), teardrop egg sacs with tiny spiderlings, three-clawed tears the Broodwarden ripped through her own webs, dusty corner web-fill, and odds and ends caught in the silk (a coin, a vial, an arrow, a torn page).
- **This is groundwork, not a visible change yet.** It's the high-detail source used to bake richer surface detail onto the in-game webs later — the dungeon's layout, room shapes, and pathing are provably untouched (the structural geometry is byte-for-byte identical).

## V0.18.5 - Meditation Tidy-Up
- **Cleaner message when you're already rested.** Pressing meditate at full health and resource used to flash "you begin settling into meditation" and then immediately "meditation complete." Now you just get a single "You are already fully rested." line.
- **Under-the-hood cleanup of the meditation code.** Removed some unused leftover code. No change to how meditation actually works — the same restore rate, levels, bonuses, Bard auras, group synergy, and Great Stillness event as before.

## V0.18.4 - Full Animation Everywhere (Not Just in Debug)
- **Characters animate fully in normal play now.** You'd noticed everything only truly animated with the Debug overlay open — your own character and nearby creatures looked nearly frozen otherwise. That's fixed: **you and everything around you now animate at full frame rate all the time**, whether Debug is open or not.
- **What was happening:** to stay fast with hundreds of creatures on the map, the game re-uses pre-drawn "snapshots" of far-off models instead of redrawing them every frame — but that trick was being applied to your character and the monsters right next to you too, so they'd flip between just a couple of frozen poses. Now anything within a short distance of you (and always your own character) is drawn live every frame; only the distant crowd keeps using the fast snapshots, where you can't tell the difference anyway.
- **No performance cost where it matters.** Only a handful of things are ever right next to you at once, so the frame rate stays put — the speed-saving snapshot system still does its job on everything far away.

## V0.18.3 - A Fuller, Blacker, Wetter World
- **More monsters out in the wilds.** The zone thinned out the further you got from town, leaving the eastern and deep-southern reaches nearly empty. Creatures now populate the **whole** map, the far regions are denser, and there are **13 new monster camps** spread across the previously-bare east, south, and deep corners (tougher families the deeper you go).
- **The world map is properly dark now.** Undiscovered areas are **fully black** until you explore them, instead of faintly showing the terrain underneath. (Your small corner minimap keeps its softer look.)
- **The map is uncluttered.** Opening the world map now **hides the rest of the interface** (health bar, hotbar, minimap, menu) so nothing overlaps it — just the map and its Close button.
- **Monsters swim now.** Creatures crossing rivers and lakes render **partially submerged with a water ripple**, so they look like they're swimming instead of walking on top of the water — just like your character.

## V0.18.2 - Boss Summons, Charges & Teleports
- **The last of the boss abilities are live.** Some enemies had abilities that still did nothing — now they all work: bosses can **summon adds**, **charge/lunge** in to close the gap, **blink** (teleport) to you, **cocoon-prison** you (a hard root), and **retreat** to reposition. Notably, the summon-only miniboss that used to just stand there now actually calls in help.
- Summoned adds are weaker, family-appropriate creatures (spider bosses call spiders, etc.), and all this damage is still tied to the enemy's normal hit — tuned, not random.
- **Bot allies were reviewed and left as-is.** Their skill AI is already smart — they heal hurt allies, emergency-heal at low health, crowd-control, manage pets and mana, keep their distance as ranged classes, and each of the 14 classes casts to its role. It passed the game's own AI health check, so nothing needed changing there.

## V0.18.1 - Patch Notes Actually Update Now
- **Fixed the in-game Patch Notes being stuck.** The Patch Notes panel (both on the main menu and in the pause menu) had been frozen on an old entry for a long time — it was showing a copy of the notes baked into the game instead of reading the real, current list. It now loads the live patch notes, so this very entry — and every future one — shows up.
- If you're running the game from a local server it reads the notes file directly; the built-in copy is also refreshed so it's current even when opened as a standalone file.

## V0.18.0 - Smarter AI III: Bosses Actually Use Their Abilities
- **Minibosses and bosses now use their full kits.** Enemies had special abilities defined — AoE blasts, cleaves, poison clouds, snares, protective shields, frenzies, self-heals — that the game **never actually cast**. They just auto-attacked. Now they use them: expect **ground-targeted AoE, lingering poison, web-snares that root you, damage shields, and enrage/heal moments** in tougher fights. Damage is tied to each enemy's normal hit (scaled per ability), so it's tuned, not random spikes.
- Trash mobs that only have basic attacks are unchanged — this brings the **elites and bosses** to life.
- Performance is unaffected (abilities only fire when a mob attacks, never idle), and it all still runs at the fast frame rate from V0.17.98.
- **This wraps up the big AI + performance overhaul** (V0.17.96–V0.18.0): faster nameplates, ~10× faster AI loop, swimming, smart pathfinding, ranged casters, and now full boss ability kits.

## V0.17.99 - Smarter AI II: Ranged Casters Fight Like Casters
- **Casters and spirits finally use their range.** Ranged enemies like **Grave Wisps and Duskwisps** used to float right up and bonk you in melee — completely wrong for a ranged spirit. Now they **hover at a distance and hurl bolts**, and when you close in they **back away (kite) while still casting**. Same damage as before, just delivered the way it should be — so ranged packs are more dangerous and can't be trivially walked away from.
- **Enemies pick smarter targets.** When choosing who to hit, they now lean toward **wounded targets** (to finish off near-dead ones) and **squishier targets** (casters/healers over heavily-armored tanks) — while still mostly going for whoever's closest and honoring taunts/threat.
- Melee enemies behave exactly as before; this only adds the ranged behavior on top. Performance is unaffected (still fast after V0.17.98).

## V0.17.98 - Performance: The Big One (AI Loop ~10× Faster)
- **Found and fixed the real frame-rate killer.** The enemy-AI loop — the single biggest cost every frame — was spending almost all its time rebuilding the same settings data thousands of times per frame and throwing it away (a hidden memory-churn storm), not on actual thinking. One fix (caching that settings data) cut it dramatically.
- **Measured results:** the AI update went from ~82 ms to ~17 ms per frame, and overall drawing/simulation time dropped **~4.7×** in testing. The fix speeds up the **whole game**, not just the AI, because that same settings data is used all over rendering and the UI too.
- On a fast machine like yours this should be the difference that gets you to a **steady 60**. Nothing changed about how anything looks or behaves — it's pure speed.

## V0.17.97 - Smarter AI I: Swimming & Pathfinding
- **Everything can swim now.** Enemies, mercenaries, pets, and bots can finally **cross rivers, lakes, and cave pools** just like you — they'll wade in, swim across, and follow you through water instead of stopping dead at the shoreline. (A creature can be individually marked as unable to swim if needed, but by default everything swims.)
- **No more getting stuck on trees.** Enemies used to walk straight at their target and jam against trees, rocks, and water edges. They now **path intelligently around obstacles** — when the direct line is blocked they route around it, so they actually reach you (or their home) instead of grinding into the scenery. Your companions already did this; now the monsters do too.
- Under the hood this is done efficiently: the smart routing only kicks in when a creature is actually blocked, and it's throttled so lots of chasers won't tank performance.
- (Coming next: smarter **combat and skill use** for enemies, plus the enemy-AI **performance** pass — the AI loop is still the biggest frame-rate cost.)

## V0.17.96 - Performance: Faster Name Plates (Big Draw-Time Win)
- **The name plates over characters' heads were the single most expensive thing on screen.** Each one was fully re-drawn from scratch every frame — text, outline, drop-shadow, gradient, and its beveled frame — which is heavy CPU work your graphics card can't speed up. With a dozen on screen that was **more than half of all drawing time**, and it's why even a powerful PC could chug.
- **Now each name plate is drawn once and reused**, and only re-drawn when something on it actually changes (name, level, action, health, threat). They look **exactly the same** — this is purely a speed change. Expect a **big jump in frame rate**, especially in busy areas like the camp with lots of NPCs.
- **New tool: `Blackroot GPU Check.html`** in your game folder — double-click it to see, in plain English, whether your browser is using your graphics card, plus a quick speed test and your display info.
- (Next up: the enemy AI is now the largest remaining cost — that's the next thing to optimize.)

## V0.17.95 - Performance: Smoother Frames & a Render-Resolution Option
- **New: Render Resolution setting** (Settings → Graphics). A slider (50–100%) that scales how sharply the world is drawn internally. Turn it down for **higher FPS** on large or high-DPI monitors; the HUD, text, and menus always stay crisp. **Default is 100%, so nothing looks different unless you change it.**
- **Automatic resolution scaling under load.** If the frame rate drops and stays down, the game now gently lowers the world's internal resolution to keep things smooth, then **restores full sharpness automatically** once the frame rate recovers. Big or high-DPI displays get an automatic cap so they don't waste effort drawing far more pixels than the screen needs.
- **Fixed a startup bug** that was silently throwing a storm of errors on **every** launch (a settings system that kept rebuilding itself until it overflowed). Startup is now clean — no functional change you'll see, but it's one less thing dragging on load.
- Under the hood: this build is a full performance review. The renderer and creature AI were already well-optimized (off-screen culling, cached creature art, distance-based AI), so the focus was the one real bug above plus giving you direct control over resolution vs. speed.

## V0.17.94 - Resource Icons & New Ambient Music
- **The last of the item art is in.** Every gathering and crafting material now has its own **icon** instead of a generic colored badge — all the **ores, bars, herbs, mushrooms, fish, pelts, gems, essences**, the **fishing rods / pickaxes / hatchet / herbalist knife** tools, and quest pieces like **Gloom's Crypt Key**. Your bags, the bank, vendors, and loot now show proper pictures across the whole resource economy (61 new icons).
- **New zone music.** The four background loops (**dark woods, cave, town, combat**) were a flat, buzzy drone — they've been **completely re-recorded** as proper evolving ambient tracks: warmer pads that move through real chords, a soft air/wind texture underneath, a gentle lantern-town melody, distant cave chimes, and a driving heartbeat pulse for combat. Each loops seamlessly with no click. If all you heard before was a hum, this should sound like actual music now.
- You can still adjust or mute music anytime in **Settings → Audio**.

## V0.17.93 - Ashroot Horror Fix
- Fixed the **Ashroot Horror** (and the Ashroot Elder) having its top cut off — these are unusually tall creatures that were overrunning their sprite frame. They now render in full, with the rest of the creatures unaffected.

## V0.17.92 - Quest Markers You Can't Miss
- Quest-giving NPCs now float a **large, bobbing, glowing marker** above their heads so you can spot them across the camp:
  - a gold **!** when they have a quest **available** to take,
  - a gold **?** when a quest is **ready to turn in**,
  - a silver **?** when a quest is **in progress** (come back later).
- Markers update live as you take and complete quests, and NPCs whose quests you can't access yet (prerequisites unmet) show nothing.

## V0.17.91 - Fog of War: Explore to Reveal the Map
- The world map now begins **unknown**. You reveal the land by **walking it** — the terrain around you is uncovered as you go, with soft feathered edges, and stays revealed **permanently** (surviving logout and death).
- **Landmarks, camps, caves, and NPCs stay hidden on the map until you actually find them.** Discovering a landmark pops a **"Landmark Discovered"** notice, updates your map, and grants a little exploration XP.
- The **world map screen (M)** shows your **exploration %** for the zone, with everything you haven't found yet still shrouded.
- Every cave and dungeon floor keeps its **own** fog-of-war map.
- (Coming later: exploration reward milestones at 25/50/75/100%, a Cartographer NPC, and survey points that reveal a small area from high ground.)

## V0.17.90 - A Livelier Dark Woods
- The Dark Woods no longer feels empty out past the starter camp. Creatures now populate the **whole** zone — the old build left Bandit's Fall, the Stone Hedge, and the deep Gloamroot reaches nearly bare, and they're now inhabited.
- **Level scales with distance from camp.** The creatures nearest the camp are low-level and safe; the further out you push, the tougher they get — a smooth gradient from ~level 3 near town to ~level 9-10 in the deep woods.
- **Encounter variety.** Instead of a uniform scatter, you'll meet **lone roamers**, **small packs (2-3)**, **medium groups (3-5)**, and the occasional dangerous **large group (5-7)** — and everything **roams** rather than standing still.
- Density is tuned to keep the zone lively without hurting performance; it can be dialed up or down from here.

## V0.17.89 - Dark Woods Quests, Rebuilt (Part 6): The Long Root — Finale
- The Dark Woods questline is **complete**. Two final quests at the **Gloamroot Depths** close the zone:
  - **Offerings** — Elder Thalen Mossroot sends you to the Root Shrine with a gift from each of the three regions: a blackroot from the deep, a wispbloom from the stones, a thornberry from the bramble. A full lap of everywhere you've been.
  - **The Long Root** — the **zone capstone** (level 10). The Ashroot Horrors were never monsters — they're the forest's immune response to a rot under Gloamroot, and they've been losing for years. Find the rot, kill the forest's oldest voice, and **hold the shrine through six waves** while Thalen seals it. Choose the zone's finest reward — the Heart of the Long Root, or Thalen's Seal.
  - **And the world changes.** When the rot is sealed, the whole **Dead Lantern Trail flares to life and stays lit** — the very first quest you took, at last finished, at level 10. The seal holds, but it does not cure: under the roots is the thing that made the rot, and it did not come from these woods. There is a road.
- This completes the 25-quest rebuild of the Dark Woods across V0.17.84–V0.17.89.

## V0.17.88 - Dark Woods Quests, Rebuilt (Part 5): The Silk Web Approach & a Life in Your Hands
- Three quests at the **Silk Web Approach**, and the first quest in Blackroot you can **permanently lose**.
  - **Cut Them Down** — Deepwood Surveyor Iren sends you to the expedition camp at the cave mouth. Five of the cocoons hold the dead. The sixth one is breathing.
  - **The Fourth Expedition Member** — **escort** the wounded survivor home. She's slow, she's at death's door, and the spiders are still out there. Get her to camp alive. If she dies, she does not come back — the Quartermaster she would have become, and everything she'd have offered, are lost on this character forever.
  - **Anti-Venom Supply** — *if* you saved her, the survivor sets up as the Silk Web Quartermaster and keeps you stocked with anti-venom for the cavern ahead.
- New quest type: **Escort** — keep a fragile NPC alive across a distance. Some quests now carry real, permanent stakes.

## V0.17.87 - Dark Woods Quests, Rebuilt (Part 4): Stone Hedge & the Night
- Four quests at the **Stone Hedge Clearing**, from the enchanter Selene Glasswhisper — and the night finally matters.
  - **The Order of Stones** — remember that old coin you've been carrying since level 2? Its worn rim is a key. Wake the eight standing stones **in the right order** (sunwise from the north stone). Get it wrong and the wisps answer.
  - **Wispbloom Under Moonlight** — wispbloom only opens after dark. You'll have to wait for night to gather it.
  - **Lumen** — a wisp brighter than all the rest burns at the ring's heart, but only at night. Put it out, and choose a shard of its light — a Lumenshard that relights lanterns as you pass, or a caster's Wispflame Focus.
  - **What the Gap Lets In** — the gap in the stone ring was **left** open, facing the road. Stand in it at night and hold through five waves before the assault overwhelms you. What comes through tells you where the real danger sleeps.
- The **day/night cycle** now gates content for the first time, and standing stones can be woken as a puzzle.

## V0.17.86 - Dark Woods Quests, Rebuilt (Part 3): Bandit's Fall & the Rurik Choice
- A whole new region questline at **Bandit's Fall**, built around Blackroot's **first real branching choice** — and both paths are permanent on your character.
  - **Blood on the Road** & **Cut the Supply Lines** — Road Warden Cael sends you to break the bandits holding the ruin. Be warned: destroying their caches makes them hate you, and that has consequences you won't see coming.
  - **The Lookout's Last Watch** — a hidden quest with no giver, found at a collapsed watch post. What the bandits are really running from starts to surface here.
  - **Rurik's Offer** — reach the bandit king Rurik the Fallen and **choose**: hear his bargain and turn on Cael's wardens, or cut him down. But if you've spilled too much bandit blood already, Rurik won't deal with you — the bargain simply closes, and you never learn it was there.
  - Each path **permanently changes** who will speak to you and which repeatable work you can take: kill Rurik and the Warden posts bounties; spare him and a **Bandit Fence** opens for business (and pays better — crime does).
- The reward-choice screen is now a real **picker** — when a quest offers a choice of rewards (like **Old Tusk**), you choose which one you get.

## V0.17.85 - Dark Woods Quests, Rebuilt (Part 2)
- **The Guide's Warning** — a new quest from Road Warden Cael that finishes the Dead Lantern Outskirts. Stand at the camp's south gate and **hold it through three waves** of rotlings and gloom wolves. Cael fights right beside you this time — a defense with training wheels before the zone asks you to hold a point alone. Reward: an Ironbark Shield.
- New quest type: **Defend** — hold a point through waves of enemies. Wander off or fall in battle and the assault resets so you can try the hold again. (A hidden **timed** system also went in, used by later timed/race quests.)

## V0.17.84 - Dark Woods Quests, Rebuilt (Part 1)
- The Dark Woods quests have been **completely rebuilt**. The old quests are gone; in their place is a new hand-authored questline that will grow across the next several updates. This first part covers the **Dead Lantern Outskirts** and **Bramblefen Thicket**:
  - **Light the Way** — walk the Dead Lantern Trail and rekindle the dark lantern posts (press E at each). Your first act of pushing back the dark.
  - **What the Well Remembers** — find the old forest well and recover three very old coins from it. Keep them; they matter later.
  - **The Pilgrim's Road** — carry a coin to the lost pilgrim shrine on the old road and leave it there.
  - **Camp Supply Run** — a repeatable gather that asks for a **different herb each day**.
  - **The Hunter Never Came Back** — find the lost hunter's camp and recover his journal.
  - **Follow the Blood** — no quest marker, no giver: the journal is your only clue. Follow the blood trail into the thicket and see where it leads.
  - **Old Tusk** — kill the thing in the gore pit, and choose your reward.
  - **Thin the Pack** / **Thornberry Harvest** — repeatable wolf-culling and thornberry gathering.
- New quest types the game can now track: **discover a place**, **deliver an item to a person or shrine**, and **interact with things in the world** (lanterns, the well). More quest types (defend a point, escort a survivor, timed races, branching choices) and the rest of the zone are coming next.
- Note: because the old quests were removed, any old quest still in your log from a previous version is cleared automatically.

## V0.17.83 - Summoner & Necromancer Capstones
- The Summoner's **Gate Opens** capstone now really summons 4 elemental servitors, and the Necromancer's **Grave Sovereign** now really raises a skeleton from a slain enemy — previously these were damage-buff stand-ins. All 42 talent capstones now do exactly what they say. Summoned minions also now benefit from your minion-damage talents.

## V0.17.82 - Talent Balance Tweaks
- Trimmed two of the strongest damage specs slightly: **Ranger Beaststalker** (Predator Shot) and **Druid Mooncaller** (Crescent Surge) now give a little less bonus damage per point, bringing them closer in line with other specs. Other specs are unchanged — the damage builds were tunable with confidence, while the tank/healer/pet/support builds need real play testing to tune properly.

## V0.17.81 - Talent Panel Polish
- Talent tooltips are now properly styled instead of the plain browser tooltip: they show the talent name, your current rank, what it does now, what the **next rank** would do (in the spec's colour), and the point requirement if the tier is still locked. Hovering a talent also gently lifts its icon.

## V0.17.80 - Themed Talent Backgrounds by Name
- Each specialization's talent-tree background is now a themed emblem drawn from the spec's **name** instead of a faint spell icon — crossbones for Bonecaller, a skull for Plaguebinder and Soulreaper, a flame for Pyromancer, a snowflake for Frostbinder, a moon for Mooncaller, a leaf for the nature specs, a blade for the weapon specs, a shield for the guardians, and so on — all tinted in the spec's colour. If you drop in custom painted art (see V0.17.79) it replaces the themed emblem.

## V0.17.79 - Custom Talent Backgrounds (Drop-in Art)
- You can now give any specialization its own hand-painted background: drop an image named after the spec (e.g. `assassin_boltweaver.png`) into `assets/talents/` and it appears behind that talent tree the next time you open the panel — no other setup. Specs without a custom image keep the built-in themed background. (See `assets/talents/README.md` for the full list of names.)

## V0.17.78 - Themed Talent Trees
- Each specialization in the talent window now has its own themed background instead of a flat dark panel — a coloured glow, a tinted gradient, a subtle grain, and a large faint emblem of that spec's signature ability behind the tree (a bolt for the crossbow spec, a dagger for the throwing spec, a flame for the fire spec, and so on). Applies to every specialization of every class.

## V0.17.77 - Talent Capstones Made Faithful
- Talent capstones (the top-tier passive of each specialization) now do what they say instead of a placeholder single-target hit or a plain buff. They fire their real effects: area explosions, chain lightning, spreading damage-over-time to nearby enemies, freezing/rooting/staggering/mesmerizing groups, and cooldown resets.
- Examples: the Necromancer's Plaguebinder capstone now spreads every rot/disease on a slain enemy to those around it; the Shaman's Stormcaller calls five lightning strikes; the Wizard's Pyromancer explodes all nearby foes and the Frostbinder freezes them; the Rogue's Shadowblade re-enters stealth and resets its key abilities; the Enchanter's Mesmerist mesmerizes everything nearby.
- Two summon-based capstones (the Summoner's element gate and the Necromancer's corpse-raise) still use a stand-in until the game gains a way to spawn summons on the fly.

## V0.17.76 - Talent Balance Pass (Diagnostics)
- Added an internal balance-measurement tool and used it to pull three over-strong damage builds (Ranger Beaststalker, Assassin Nightblade, Druid Mooncaller) back toward the intended power level. Fine tuning continues.

## V0.17.75 - Visual Talent Trees
- The talent window is now a proper visual tree of ability icons instead of a text list. Click an ability icon to spend a point; right-click to refund. Tiers are joined by connector lines that light up as you progress, and each tree shows a progress bar toward its capstone.

## V0.17.74 - Companion Talent Specs
- AI companions and other players now pick a talent specialization at level 5, shown on their nameplate (e.g. "Judicator Paladin", "Exorcist Cleric"), so the world's characters have visible builds.

## V0.17.73 - Talent Balance Safeguards
- Hardened the talent math so no single talent or combination can exceed safe limits (damage, damage reduction, and cooldown/cost floors) — builds stay powerful without becoming game-breaking.

## V0.17.72 - Talents for Every Class
- All 14 classes now have full talent trees: 3 specializations each, 294 talents in total, built on the system introduced for the Paladin.

## V0.17.71 - Full Action Bar + Spellbook
- You can now use all 20 of your class abilities. Added a second action bar (Shift + number keys) and a Spellbook window — drag any ability onto an action-bar slot to bind it, click to cast, right-click a slot to clear. Previously only about half of your abilities were reachable. Press V (or the Spells button on the bar) to open the Spellbook.

## V0.17.70 - Damage Type Fix
- Fixed elemental and other non-physical damage (fire, frost, nature, lightning, arcane, shadow, poison, and more) so it correctly uses your magic power and magic critical-hit chance instead of being treated like physical damage. Mainly benefits spellcasters.

## V0.17.69 - Talent System
- Added the Talent System. From level 5 you earn 1 talent point per level (16 by level 20) to spend across your class's 3 specialization trees, empowering your existing abilities and unlocking a passive capstone. Open it with N. Early respecs are free; later respecs cost coin.

## V0.17.68 - Bug Fixes: Fishing Line Rod-Tip Anchor + Silk Web Cavern Object Renderers

- **Fixed: the fishing line was not attached to the fishing pole.** While fishing, the line started up near the top of the screen instead of at the tip of the rod. Every player class draws its rod through a shared rig that never told the fishing system where the pole tip actually was, so the line fell back to a rough guess that sat far too high. The rod tip is now published exactly where it is drawn, so the line starts right at the end of the pole for every class and every facing.
- **Fixed: render errors in the Silk Web Cavern.** Several cavern objects (egg clusters, chitin columns, brood growths, web-wrapped bones, the Queen's royal pylon, and silk reliquaries) pointed at drawing code that was never written, causing a render error every frame those objects were on screen and leaving them invisible. They now render correctly with their own distinct looks.

## V0.17.67 - Dark Woods 360x360 Expansion: Phase 28 (Final Documentation) — EXPANSION COMPLETE

The 28-phase Dark Woods Zone Expansion + Resource Identity pass (V0.17.40–V0.17.67) is complete. Summary of the whole expansion:

- **Dark Woods expanded to 360x360.** The starter zone is now a large 360x360-tile wilderness with better exploration pacing, named subregions, and landmark spacing.
- **Dark Woods now has exactly 2 caves.** Extra cave entrances were removed so the zone has precisely two cave locations.
- **Silk Web Cavern is the only dungeon cave** — the main 3-floor elite spider dungeon.
- **Hidden Tree Cave added/refined as a secret cave** — a small hidden exploration cave concealed by dense trees, not a dungeon.
- **Old Ruins bandit area (Bandit's Fall) added** — a ruined outpost occupied by bandits (Scouts, Thugs, Archers, a Lookout, and a named Leader).
- **Stone Hedge Ruins added** — a mystical standing-stone landmark.
- **Waypoint added in the Stone Hedge Ruins centre** — a fast-travel waypoint you can stand on/near.
- **Waypoint aura animation added** — a pulsing, glowing rune aura with a rotating ring and rising motes (stronger at night).
- **Wisps placed around Stone Hedge Ruins** — outer and inner wisp encounters guarding the waypoint.
- **Dark Woods herbs and fish added** — 5 overworld herbs (Lantern Moss, Thornberry, Gloomcap Mushroom, Wispbloom, Blackroot Herb) and 5 overworld fish (Duskmud Minnow, Lanternfin, Brambleback Pike, Ghostscale Trout, Gloamroot Catfish).
- **Silk Web Cavern-only herbs and fish added** — 3 cave herbs (Webcap Fungus, Widow's Veil, Queen's Silkroot) and 3 cave fish (Blind Silk Minnow, Venomgill Eel, Broodpool Angler), found only inside the cavern.
- **Resource level / EXP / respawn rules added** — Gathering and Fishing level 1–10 progression, per-resource level requirements, EXP rewards, first-discovery and rare-node bonuses, vendor values, and randomized respawn timers; harvested nodes persist across saves/reloads/zone changes so rare nodes can't be farmed by re-entering.
- **Zone identity improved with dead lanterns, props, terrain detail, overlays, and ambient life** — the Dead Lantern Trail, varied trees/bushes/props, region-based terrain darkening and overlays, micro-landmarks and story scenes, creature-territory signposting, and ambient wildlife (crows, deer, squirrels, frogs, bats, and more) with light time-of-day atmosphere.

Also in this pass: performance kept stable across the larger zone (day/night lighting computed once per frame; off-screen content culled), collision/reachability audited (all nodes, pools, landmarks, and the waypoint reachable; map edges walled off), and several long-standing rendering bugs were fixed along the way.

## V0.17.66 - Dark Woods 360x360 Expansion: Phase 27 (Performance + Culling)
- Performance pass for the expanded 360x360 zone: confirmed the new props, resource nodes, atmosphere, and dungeon content cull off-screen and don't add duplicate render loops or per-frame randomness.
- Optimized the day/night lighting so it's calculated once per frame and shared, instead of being recomputed separately for the sky, atmosphere, each lit lantern, wisp, and the waypoint glow - reducing redundant per-frame work with no visible change.

## V0.17.65 - Dark Woods 360x360 Expansion: Phase 26 (Collision + Readability Cleanup)
- Internal audit pass: confirmed everything added across the expansion (herb/fish resource nodes, the new dungeon fishing pools, landmarks, the waypoint, and cave entrances) is reachable and doesn't block movement. No gameplay changes.
- Verified the whole 360x360 zone stays connected, all resource nodes are reachable, the Silk Web Cavern fishing pools have proper shorelines to fish from, no water was placed in a boss arena, and the map edges are properly walled off.

## V0.17.64 - Dark Woods 360x360 Expansion: Phase 25 (Resource UI Messaging + Feedback)
- Resource nodes you can't yet gather now say clearly "Requires Gathering Level X" (and the same for the nearby-node panel), so it's obvious when a node needs a higher profession level.
- Gathering and fishing now show how much profession EXP you earned each time ("+N Gathering EXP" / "+N Fishing EXP"), alongside the existing first-discovery and rare-node bonus messages.
- No HUD redesign - this reuses the existing resource/fishing panels and message feed.

## V0.17.63 - Dark Woods 360x360 Expansion: Phase 24 (Resource Persistence + Anti-Farming)
- Resource nodes stay gathered until they actually respawn: a harvested node's respawn timer now persists across saving/loading, leaving and re-entering a zone or dungeon, and moving off-screen and back - so rare herbs like Blackroot and Queen's Silkroot can't be farmed by re-entering Silk Web Cavern or reloading.
- Respawn times are now randomized within each resource's intended range (instead of a fixed interval), so respawns are less predictable to farm.
- No change to how you gather, and existing saves keep working.

## V0.17.62 - Dark Woods 360x360 Expansion: Phase 23 (Silk Web Cavern Cave Fish)
- Added 3 Silk Web Cavern-only cave fish: Blind Silk Minnow (shallow cave pools), Venomgill Eel (deeper pools near the spider nests), and the rare Broodpool Angler (only the deepest pool on the final floor).
- Silk Web Cavern now has real cave pools you can fish in - small pools are carved into the dungeon floors, and fishing now works inside the cavern with the same controls, level requirements, and first-catch/rare bonuses as overworld fishing.
- These cave fish only appear in Silk Web Cavern's pools, never in the overworld, and the deepest pool on the final floor is the only place the rare Broodpool Angler bites.

## V0.17.61 - Dark Woods 360x360 Expansion: Phase 22 (Dark Woods Overworld Fish)
- Added 5 Dark Woods-only overworld fish to catch: Duskmud Minnow (starter ponds), Lanternfin (near the dead lantern trails), Brambleback Pike (Bramblefen waters), Ghostscale Trout (wisp-touched Stone Hedge pools), and the rare Gloamroot Catfish (deep shaded pools).
- Fishing now respects your Fishing level: you can only catch fish up to your skill level, so the higher-tier fish require more experience - and the rare Gloamroot Catfish only bites in deep water.
- Each fish has its own EXP and vendor value, plus a first-catch discovery bonus and (for the Gloamroot Catfish) a rare bonus.
- These fish only appear in Dark Woods overworld water, never in the caves.

## V0.17.60 - Dark Woods 360x360 Expansion: Phase 21 (Silk Web Cavern Herbs)
- Added 3 Silk Web Cavern-only herbs you can gather inside the dungeon: Webcap Fungus (entrance/mid floors), Widow's Veil (deeper spider tunnels), and the rare Queen's Silkroot (only in the deepest final chamber).
- These herbs never appear in the overworld - they are exclusive to Silk Web Cavern - and their higher gathering levels, EXP, and vendor values reflect the danger of reaching them (Queen's Silkroot also gives a rare-node EXP bonus).
- Gathering now works inside the dungeon using the same controls and cast bar as the overworld, so you press G to gather these herbs just like any other node, with the same level requirements and first-discovery bonuses.

## V0.17.59 - Dark Woods 360x360 Expansion: Phase 20 (Dark Woods Overworld Herbs)
- Added 5 Dark Woods-only overworld herbs to gather: Lantern Moss (near the starter roads), Thornberry (Bramblefen Thicket), Gloomcap Mushroom (shaded mid-forest), Wispbloom (around the Stone Hedge stones), and the rare Blackroot Herb (deep in Gloamroot Depths).
- Each herb has its own gathering level, EXP, respawn timer, yield, and vendor value, and each drops its own material for cooking/alchemy and selling.
- Herbs are placed by region: the low-level ones sit near town, and the rarer ones are found deeper in the woods, well away from the starter area. Blackroot gives bonus Gathering EXP as a rare node.
- Herbs only appear in the Dark Woods overworld - never in the caves or other zones - and low-level characters can't gather the higher-level herbs yet.
- These herbs also appear in existing save games, not just new ones.

## V0.17.58 - Dark Woods 360x360 Expansion: Phase 19 (Profession EXP Tables + Resource Rules)
- Gathering and Fishing now use the intended level 1-10 EXP progression: reaching each level costs 100 / 150 / 225 / 325 / 475 / 675 / 950 / 1300 / 1750 EXP (5,950 total to reach level 10), matching the Dark Woods tier design.
- Fixed a long-standing inconsistency where Fishing tracked two separate levels that could drift apart; there is now a single Fishing level shared across the fishing panel, the professions panel, and the skills panel.
- Added a first-time discovery bonus: the first time you gather or catch each resource species you earn bonus EXP scaled to its tier (+15 to +75), and this is remembered in your save so it only applies once each.
- Added support for rare-resource EXP bonuses, wired up for the rare herbs and fish arriving in the next phases.
- No new professions, gathering, or fishing systems were added, and existing resource level requirements and gather/catch behavior are unchanged.

## V0.17.57 - Dark Woods 360x360 Expansion: Phase 18 (Resource System Audit)
- Internal read-only audit pass ahead of adding the Dark Woods herbs and fish. No gameplay changes: existing resources, gathering, and fishing behave exactly as before.
- Documented how every resource system fits together (herb/ore gathering nodes, the separate fish-anywhere fishing system, profession EXP, vendor values, loot tables, and save persistence) so the upcoming resource phases can be built cleanly without duplicating systems.
- Confirmed the groundwork already in place: region-to-resource hooks were authored back in the regions pass, and harvested-node respawn timers already persist across reloads and zone changes (so nodes can't be farmed by reloading).
- Flagged the main thing to solve later: Silk Web Cavern is a dungeon, and the current gathering/fishing systems don't operate inside dungeons, so its exclusive herbs and fish will need a dedicated path.

## V0.17.56 - Dark Woods 360x360 Expansion: Phase 17 (Atmosphere / Time-of-Day Identity)
- Morning fog now pools in the Dark Woods: at dawn and morning, fog gathers in low-lying valley ground and thins out on higher terrain, then clears through the day. Night fog is unchanged.
- The Stone Hedge waypoint now reads as a beacon after dark - its aura, rune ring, rising motes, and ground glow all brighten and widen at night, so it stays clearly visible when the world darkens.
- Wisps around Stone Hedge Ruins now give off a soft ghost-light glow at night, making them easier to spot in the dark without changing their behavior.
- Lit lanterns along the roads now cast a faint warm halo that strengthens at night (wisp-lit lanterns glow pale green), reinforcing the Dead Lantern Trail as a guide through the dark. Broken and fallen lanterns stay dark.
- Ancient trees now cast a deeper, wider pool of shade, selling the heavy gloom of the old-growth deep woods.
- All of these are subtle, driven by the existing in-game day/night clock (no new weather system, clock, or background loops), and camera-culled so there is no meaningful performance cost. Fireflies already brightened at night from an earlier pass and were left as-is.

## V0.17.55 - Dark Woods 360x360 Expansion: Phase 16 (Creature Territory Signposting + Ambient Life)
- Each Dark Woods territory now shows a warning before you reach its resident danger: broken arrows near Bandit's Fall, floating magical motes near Stone Hedge, webbed bushes and egg sacs approaching Silk Web Cavern, claw marks through Bramblefen Thicket, and heavy roots deep in Gloamroot Depths.
- The forest now has real ambient wildlife: crows, squirrels, deer, frogs, and bats join the existing fireflies, butterflies, moths, and beetles - all purely cosmetic, camera-culled, and biased to appear in fitting spots (bats near cave mouths at night, deer in the calmer outer woods, crows deeper in).
- Fixed a real bug from the Dark Woods 360x360 resize: ambient fog, fireflies, and wildlife were silently failing to render for roughly the outer half of the expanded zone because the system was still using the old, smaller map-size bound. They now render correctly across the whole 360x360 area.

## V0.17.54 - Dark Woods 360x360 Expansion: Phase 15 (Micro-Landmarks + Environmental Storytelling)
- Added 4 small hidden exploration scenes to the Dark Woods: an Abandoned Hunter Camp with a dead firepit and a blood trail leading away, a moss-covered Old Forest Well, a Collapsed Watch Post overlooking Bandit's Fall, and a Root Shrine deep in Gloamroot Depths.
- Added 4 authored story scenes that tell a small piece of the zone's history at a glance: the remains of a Bandit Ambush along the road, a Failed Spider Hunt near Silk Web Cavern, a Lost Pilgrim Shrine with melted candles, and an Old Road Collapse where roots have overtaken a broken path.
- All 8 scenes were placed well clear of the zone's existing creature spawn points and landmarks so they read as their own discoveries rather than overlapping combat areas.
- These are visual/environmental only - no new quest chains, resource nodes, or persistent day/night triggers were wired up in this pass.

## V0.17.53 - Dark Woods 360x360 Expansion: Phase 14 (Trees, Bushes, Terrain Props)
- The Dark Woods forest now has real tree variety: rare, larger ancient trees with gnarled trunk knots, and dead trees now come in a range of sizes instead of one fixed size.
- Underbrush is more varied too - berry and flowering bushes show up more near the safer outskirts, while dead and mossy bushes become more common the deeper you go.
- Rocks can now appear moss-covered, and stumps in the general forest use a natural brown/moss look distinct from the burnt stumps at Bandit's Fall.
- Added new forest-floor detail: non-blocking fallen logs and small root clusters scattered through the woods, plus a rare, large blocking root barrier that only appears deep in the most dangerous regions.
- All of this scales with how deep into the Dark Woods you are (reusing Phase 13's region-depth system), so the outskirts near town still read as calm and the deep woods read as wilder and more overgrown.

## V0.17.52 - Dark Woods 360x360 Expansion: Phase 13 (Terrain Tile Detail + Overlays)
- Dark Woods terrain now reads noticeably darker and more overgrown the deeper you travel from town - a new depth-based darkening wash and increased moss coverage scale smoothly with each region's danger level, while the starter area around town is untouched.
- Fixed forest floor tiles, which previously fell back to a flat, undetailed shape in the game's performance-optimized cached rendering path (every other ground type already had rich per-tile detail) - they now get the same soil/leaf-litter-style treatment as dirt.
- The Stone Hedge Ruins now has a subtle terrain-level magical shimmer underfoot, distinct from (and in addition to) the waypoint's own aura.
- All of this is deterministic and baked once per terrain chunk (not recalculated every frame), so there's no performance cost.

## V0.17.51 - Dark Woods 360x360 Expansion: Phase 12 (Animated Waypoint Aura)
- The Stone Hedge Waypoint now has a full animated aura: a slight ground glow, a soft pulsing glow around the emblem, a subtle expanding ring of light, a slowly rotating rune ring, and a few faint motes rising from the symbol - all smoothly looping.
- Built entirely on the existing VFX/effects pipeline (no new render loop or animation timer was created) - the aura is just one more effect type ticked, culled, and drawn by systems already running every frame.
- The underlying emblem stays clearly readable through the aura; particle count is kept deliberately low (4 motes, 6 rune-ring ticks) to avoid any performance cost.

## V0.17.50 - Dark Woods 360x360 Expansion: Phase 11 (Wisps + Waypoint Integration)
- Added the game's first waypoint: the Stone Hedge Waypoint, placed in the exact center of the Phase 10 stone ring. Walk up and press the interact key to attune it - this is tracked in the player's save data (a field that already existed but had never been used by anything until now).
- Built a new, small, dedicated waypoint system (systems/waypoint-system.js) to handle this - proximity detection and attunement only. No fast-travel menu was added yet, since there's only one waypoint in the game so far.
- The waypoint's appearance is deliberately static for now (a readable carved emblem, no pulsing glow or particles) - the animated aura is Phase 12's job.
- Wisps now occupy the Stone Hedge Ruins: an outer-ring Duskwisp patrol and an inner-ring named Lumen-Wisp, both reusing the existing wisp enemy data rather than adding new mob types.

## V0.17.49 - Dark Woods 360x360 Expansion: Phase 10 (Stone Hedge Ruins Static Landmark)
- Built the static Stone Hedge Ruins: a partial ring of standing stones (8 of 12 possible positions - a deliberate gap faces the road approach), inner glowing rune stones, drifting magic-residue motes, and a couple of fallen/mossy broken slabs, using a grey-blue megalith palette distinct from the Phase 9 bandit ruins.
- The center of the ring is kept completely clear (nearest prop is 5 tiles out) - ready for Phase 11 to place the Dark Woods waypoint and wisps there, without needing to touch this landmark again.
- No waypoint object, waypoint animation, or wisps were added yet - this phase is the static stone layout only.

## V0.17.48 - Dark Woods 360x360 Expansion: Phase 9 (Old Ruins / Bandit Area)
- Built the Bandit's Fall landmark: an outer broken wall ring with a single south entry gap flanked by barricades, a central ruined structure (a broken archway and pillars, one toppled), two flanking rubble pockets with partial walls for ambush line-of-sight breaks, and a full bandit camp (crates, barrels, sacks, bedrolls, a firepit, weapon rack, broken cart, rope bundle, target dummy) spread across the interior courtyard.
- Placed in the fresh territory added by the Phase 2 resize rather than the older, already-crowded ruin remnants near the old map edge, so it doesn't compete for space with roughly a dozen unrelated pre-existing mob camps and named-rare anchors (nearest is over 40 tiles away).
- Added the Bandit's Fall enemy family: Bandit Scout, Bandit Thug, Bandit Archer, Bandit Lookout, and a named leader, Rurik the Fallen - all using the game's existing generic bandit renderer/animation/sprite-bake pipeline, which was already fully wired but had never had any actual bandit stat data to draw from.
- Added 6 new ruin/camp props (broken archway, rubble pile, barrel, sack pile, rope bundle, barricade) plus moss/vine/fallen variants on the existing ruin wall and pillar props.

## V0.17.47 - Dark Woods 360x360 Expansion: Phase 8 (Hidden Tree Cave Exterior + Interior)
- Hidden Tree Cave's entrance (76,74) now has a dense two-ring concealment belt - mossy tall trees, root arches, hanging vine-like roots, brush, and thick grass - so the cave reads as tucked away and discoverable-but-not-obvious rather than sitting in an open clearing.
- Added the cave's one small interior feature: a hidden, stationary lore NPC (Hollow Root Hermit) placed in its deterministic 'nest' room. No quest chain, no named rare mob, no multi-floor logic or boss - the cave stays a small secret exploration cave, not a second dungeon.
- **Fixed a real "second dungeon" conflict**: removed the `underwater_cave_blind_pool` entrance, which force-carved a live entrance to a separate 2-floor dungeon (`dungeon_blind_pool_depths`) inside this exact cave every session, invisible to and independent of the cave's own generation. This directly violated the cave's "not a dungeon" design rule. That dungeon's data (including its boss) is left fully intact, just no longer reachable, pending a future decision.
- Fixed leftover "Mossfang Cave" text in the cave's intro quest and NPC dialogue to correctly say Hidden Tree Cave.

## V0.17.46 - Dark Woods 360x360 Expansion: Phase 7 (Silk Web Cavern Dungeon Interior) - Audit, No Functional Changes
- Audited the existing Silk Web Cavern dungeon implementation before building anything new, and confirmed it is already a mature, fully wired 3-floor authored dungeon: hand-designed room graphs for each floor, spider-only encounters that scale in level (6-7 / 8-9 / 10) and difficulty across floors, 2 minibosses per floor, 3 unique named bosses with real phase-based ability logic (web snares, adds, cocoon-prison mechanics, poison, shields, frenzy), web-anchor gate puzzles, a 5-quest chain with dedicated NPCs, boss-gated stairs/treasure, and a dungeon-specific exit flow.
- No gameplay, prop, or enemy changes were made - the dungeon already matches this phase's goals.
- Documented 3 small pre-existing gaps for future cleanup: an unused `poisonDrip` prop render case (kept, since it may be useful for later phases), and a legacy/superseded `dungeon_silk_web_depths` + `boss_silk_mother` data draft that no code path reaches (kept in place, not deleted).

## V0.17.45 - Dark Woods 360x360 Expansion: Phase 6 (Silk Web Cavern Exterior + Approach)
- The Silk Web Approach region (Phase 3) now visually reads as spider territory: webbed bushes, thorn bushes, webbed dead trees, bones, wrapped corpses, broken weapons, and loose web strands are scattered across it, deterministically placed (not random-per-frame).
- The actual Silk Web Cavern entrance is kept clear - nothing is placed within a 10-tile radius of the cave mouth, so the entrance stays fully readable and accessible.
- Added 3 small new non-blocking props (thorn bush, webbed bush, broken weapon) to the shared object renderer, plus an optional webbed overlay on the existing dead tree prop; reused the existing bones/cave-web/silk-cocoon props rather than duplicating them.
- No changes to the cave's interior, entrance mechanics, or cave count - purely exterior dressing.

## V0.17.44 - Dark Woods 360x360 Expansion: Phase 5 (Cave Count Enforcement)
- Dark Woods now has exactly 2 caves, per the design rule: Silk Web Cavern (unchanged) and a new Hidden Tree Cave.
- Hidden Tree Cave is a re-themed Mossfang Cave: same save-schema slot (kept the `mossfang_cave` id to avoid a save migration), new identity as a small secret exploration cave (not a dungeon), level range updated from 1-3 to 4-8. Full exterior concealment and interior content are Phase 8 work.
- Removed the Ashroot Hollow, Crystal Grotto, and Forgotten Mine cave entrances and zone descriptors entirely - none were part of the save schema, so this has no save-compatibility impact. Their cave-only fish/loot tables are left in place as harmless unreferenced data.
- Removed the Blackroot Catacombs entrance. Its floor-4 hook was the only access point to the "Gloom's Crypt" dungeon (3 bosses, puzzles, full room plan) - that dungeon's data is fully preserved but is now unreachable pending a future decision on whether to re-attach it elsewhere.
- The general Dark Woods road network is unchanged - roads that used to lead to the removed cave mouths still lead to their ruin/stone terrain, which Phase 3 already folded into the Bandit's Fall / Stone Hedge Clearing / Gloamroot Depths regions.

## V0.17.43 - Dark Woods 360x360 Expansion: Phase 4 (Main Paths + Dead Lantern Trail)
- Extended the Dark Woods road network into the Phase 2 resize area: a maintained spur reaching Stone Hedge Clearing, a rougher side path reaching deep into Gloamroot Depths, and a narrow, unmarked, lantern-free trail representing a hidden/overgrown route - none of them cross into the other's territory.
- Added a Dead Lantern Trail variant system for lantern posts - intact, broken, hanging, fallen, wisp-lit (faint ghost light), bandit-marked, and webbed - all rendered from the existing `drawLanternPost` procedural drawer (no new render loop or duplicate prop system).
- Every lantern in Dark Woods (existing and new) is now automatically assigned the correct variant for the Phase 3 named region it physically falls in - safer roads stay intact, Bramblefen Thicket roads read as broken, Silk Web Approach lanterns are webbed, and deep Gloamroot Depths lanterns are dead/wisp-lit - verified directly against every new lantern coordinate.
- Lanterns remain fully non-blocking (no collision change) regardless of variant.

## V0.17.42 - Dark Woods 360x360 Expansion: Phase 3 (Named Regions + Level Bands)
- Added named subregion metadata for Dark Woods: Dead Lantern Outskirts (lvl 1-3), Bramblefen Thicket (lvl 3-5), Bandit's Fall (lvl 4-7), Stone Hedge Clearing (lvl 5-8), Gloamroot Depths (lvl 7-10), and Silk Web Approach (lvl 6-10), stored in `data/default-zones.js` alongside the rest of the zone's descriptor data.
- Added `Game.prototype.getDarkWoodsRegionAt(x, y)` and `getDarkWoodsRegionLevelRange(x, y)` lookups in `systems/world-system.js` - verified to resolve every tested coordinate across the full 360x360 map to exactly one region with no gaps.
- Each region carries identity/hook metadata (description, intended mob families, intended resource IDs, territory signpost props) for later phases to consume - this phase adds no new mobs, resources, terrain, or props, and does not change existing mob-spawn leveling.
- Region boundaries are anchored to the real spawn point (100,100) and the real Silk Web Cavern entrance (52,139), not a re-centered map - a first draft to be refined once Phase 4 draws real paths through this geography.

## V0.17.41 - Dark Woods 360x360 Expansion: Phase 2 (Expand Dark Woods to 360x360)
- Dark Woods (overworld) now generates at 360x360 tiles via a new `DR.CONFIG.OVERWORLD_MAP_SIZE`, while every cave and dungeon zone is untouched and stays 200x200 (`DR.CONFIG.MAP_SIZE` unchanged) - this phase does not rework caves.
- Fixed the movement clamp, the main render visible-tile window, the object-chunk render index, click-to-move targeting, the ground-item-drop bounds check, and post-load player position clamps, all of which previously hardcoded the old 200-tile limit and would have silently blocked movement/rendering/interaction beyond tile 199.
- Fixed the minimap (`buildStaticMinimap`/`drawMinimap`) to size itself from the active map's real dimensions instead of the old fixed 200x200 assumption.
- World save/load (`systems/world-serializer.js`) now tracks Dark Woods and Mossfang Cave as independent per-zone sizes instead of one shared value, since they are no longer the same size; save schema bumped v2 -> v3 with the existing migration path extended to carry old saves forward automatically.
- The starter camp, roads, ruins, water features, and cave entrances are all preserved exactly where they were (still anchored at the original spawn point); the new outer band of the map is filled by the same procedural forest generation already used for the rest of Dark Woods. No new named regions, landmarks, resources, or enemies yet - those are later phases.
- See `docs/V0.17.41_DARK_WOODS_360_EXPANSION_PHASE2_RESIZE.md` for full implementation notes, deferred items, and manual test steps.

## V0.17.40 - Dark Woods 360x360 Expansion: Phase 1 (Audit + Blueprint)
- Read-only audit of every system a future Dark Woods 360x360 expansion will touch: zone/map generation, cave system, mob spawn, resources/fishing/professions, collision, terrain/props, waypoint/travel, VFX, rendering/culling, minimap, and save/world-state persistence.
- Identified 7 hard blockers that must be resolved before Dark Woods can safely become a different size than its cave zones, including several hardcoded `CONFIG.MAP_SIZE` references in movement clamping, main-loop render culling, and the minimap renderer that bypass the zone-size-aware pattern already used elsewhere in the collision system.
- Documented that Dark Woods currently has 6 attached cave zones against a target of exactly 2 (Silk Web Cavern + a new Hidden Tree Cave), to be resolved in a later Cave Count Enforcement phase.
- Produced a first-draft proposed 360x360 region layout (Dead Lantern Outskirts, Bramblefen Thicket, Bandit's Fall, Stone Hedge Clearing, Gloamroot Depths, Silk Web Approach) for later phases to refine against real generated terrain.
- No gameplay, map, balance, or content changes in this phase. See `docs/V0.17.40_DARK_WOODS_360_EXPANSION_PHASE1_AUDIT_BLUEPRINT.md` for full findings.

## V0.17.39 - Player HUD Class Background Restore + Transparency Fix
- Fixed the Player HUD so it no longer relies on a hidden/covered absolute backdrop for class art.
- Restored the Player HUD class background image by making `.playerHudCore` the actual visible class-background owner.
- Removed the transparent/unfinished Player HUD look while preserving readable name, class line, HP/resource bars, and class icon.
- Preserved the already-correct Party HUD layout, card backgrounds, slot counts, and companion command behavior.

## V0.17.38 - Player HUD Class Background Ownership Fix
- Fixed the Player HUD top card so it now uses the same class background treatment as Party HUD cards instead of the overly dark black treatment.
- Scoped the class background to the Player HUD top card only while preserving the already-correct Party HUD cards.
- Preserved Player HUD readability for name, class line, HP/resource bars, and class icon.

## V0.17.37 - Player HUD Top Card Class Background Crop Fix

- Fixed the Player HUD class-background surface so it is clipped to the top player card instead of the entire HUD container.
- Corrected the root cause where the full-HUD cover crop sampled the dark top band of class background art, making the Player HUD look black even though the resolver was working.
- Kept the Party / Companions cards visually unchanged and preserved command button behavior.
- Preserved Player HUD layout, class icon placement, HP/resource bars, and existing HUD data behavior.

## V0.17.36 - Player HUD Class Background Surface Ownership Fix

- Fixed the Player HUD class background by making `.hudClassBackdrop` the single visible class-art surface instead of relying on optional child image/veil nodes.
- Removed the black `background-image: none` override that was still winning over the resolved class background in the Player HUD.
- Preserved the already-correct Party HUD card layout, companion command behavior, and Player HUD foreground layout.

## V0.17.34 - Player HUD Class Background Visibility Fix

- Fixed the Player HUD class-background compositing so the resolved class art is visibly rendered instead of being buried under an over-dark black overlay.
- Preserved the solid Player HUD panel base and readability for name, class line, HP/resource bars, and class icon.
- Preserved the already-correct Party HUD companion card layout and behavior.

## V0.17.33 - Player HUD Transparency + Class Background Correction

- Fixed the Player HUD so it no longer renders as an overly transparent / see-through panel.
- Restored a solid readable Player HUD class-background surface using the canonical class visual resolver.
- Preserved the already-correct Party / Companions HUD card layout, opacity, command buttons, and behavior.
- Kept the Player HUD layout intact while improving panel opacity, class-art visibility, and foreground readability.

## V0.17.32 - Summoner Action Bar Spell Icon Scaling Fix

- Fixed action bar spell icon scaling so Summoner spell icons fill their spell slots instead of rendering as small thumbnails.
- Adjusted action bar slot icon layout while preserving keybinds, spell labels, mana costs, cooldown overlays, and Auto Attack behavior.
- Kept the fix generic through the shared action bar spell slot renderer.

## V0.17.31 - Player HUD + Party HUD Visual Layout Unification

- Updated the Player HUD to use the same class background treatment previously used by the party companion cards.
- Revamped party/companion HUD cards to follow the Player HUD layout style for a more unified interface.
- Preserved player/companion data visibility, party slot counts, and companion command button behavior.
- Kept the changes inside the owning HUD systems without adding duplicate UI paths.

## V0.17.30 - Class Background Duplicate Preview Fix
- Drew the resolved class background image directly into the Character Model preview canvas before the player model so green fallback panels can no longer visually override the art.
- Applied the canonical class background image to the actual Player HUD backdrop surface with stronger visibility while preserving existing HUD layout and readable text/bars.
- Corrected the remaining Character preview CSS ownership so the class background image is used as the active surface instead of a dark/green fallback wash.
- Preserved player stats, class stats, gear score, equipment, combat, inventory, meditation, camera, and HUD layout behavior.

## V0.17.28 - Class Background Resolver Runtime Correction
- Fixed the Player HUD class-background fast path so it applies the canonical class visual resolver instead of recursively calling itself.
- Re-applied class-background variables after Character window rebuilds so the Character Model preview receives the active class art every render.
- Updated HUD and Character Model preview CSS to use explicit class background image layers, preventing green/dark fallback panels from hiding loaded class art.
- Preserved HUD layout, Character window layout, player stats, class stats, combat, inventory, and gear behavior.

## V0.17.27 - Player HUD + Character Model Class Background Fix
- Fixed class background rendering so the Character Model preview uses the player’s actual class background instead of the incorrect green/dark fallback surface.
- Updated the Player HUD to render the player’s class background treatment instead of a plain generic panel background.
- Consolidated class background lookup through the canonical class visual resolver and preserved readable HUD text/bars.
- Preserved player stats, equipment, combat, item icons, model rendering, and HUD layout.

## V0.17.25 - Rotling Root Visibility + Character Preview Background + Stats Header Polish
- Fixed Rotling root VFX anchoring and layering so roots visibly appear at the target's feet/lower legs instead of being hidden behind the character.
- Fixed the Character Model preview background to use the actual class background instead of the incorrect flat green fallback.
- Enlarged the Character Stats header class icon for clearer class identity.
- Cleaned up Gear Score box alignment so the score number is centered while preserving the existing formula.

## V0.17.24 - Meditation XP Bonus Wiring + Patch Notes Consolidation
- Wired the previously-defined-but-dormant Meditation XP bonus multipliers (safe zone, Great Stillness, per-environment) into Meditation skill EXP.
- Fixed a latent bug where a genuine zero-XP tick was silently floored up to 1 XP.
- Consolidated the two independently hand-duplicated in-HTML patch-notes panels into a single canonical source, reusing the existing panel-sync function so both panels always agree.
- Backfilled the patch-notes panel with the previously-missing V0.17.19 through V0.17.23 entries.
- Preserved Meditation HP/resource recovery, tick timing, interruption behavior, and all other gameplay systems unchanged.

## V0.17.23 - Full Codebase Review + Meditation Root-Cause Fix
- Reviewed the full codebase for duplicate systems, patch-cascade risks, timing issues, skill/EXP ownership problems, regeneration bugs, and UI feedback risks.
- Fixed Meditation to use the intended 15-second recovery tick instead of uncontrolled fast healing.
- Restored Meditation skill EXP gain on valid Meditation ticks without granting player level EXP.
- Preserved valid kill/quest/player EXP sources, Meditation visuals, and existing interruption behavior.
- Documented deferred bugs and recommended future stabilization phases in the phase report.

## V0.17.22 - Root Anchor + Bag Icon Layout + Character Stats Header Cleanup
- Moved Rotling root VFX to the character’s feet so rooted targets are visibly held from the ground instead of the waist.
- Updated bag item slot rendering so item icons fill most of the slot and in-slot text overlays the icon instead of displaying off to the side.
- Removed the incorrect green background from the Character model preview and restored proper class-background/dark fallback behavior.
- Enlarged the Character Stats header class icon and moved Gear Score to the right side for a cleaner layout.
- Preserved item stats, equipment behavior, root duration, combat balance, and save compatibility.

## V0.17.21 - Meditation Healing + EXP Gain Bug Fix
- Fixed Meditation so it restores HP and class resources over time using controlled recovery ticks instead of frame-rate-sized healing calls.
- Fixed the Meditation EXP exploit by removing active meditation EXP gain and preventing recovery ticks from mutating player combat EXP.
- Replaced the misleading world-space Meditation EXP meter with recovery tick feedback while preserving the Meditation nameplate action and aura visuals.
- Preserved normal valid EXP sources, including kill EXP, quest EXP, and party EXP bonuses.

## V0.17.20 - Bag Icon Runtime Fix + Larger Item Icon Display Pass
- Fixed bag item slots so they use the same canonical item icon resolver as equipment and now resolve uploaded item icons before generic category glyphs.
- Added runtime-name hydration for rarity-prefixed saved/generated inventory items such as `Plain Briar-Silver Earring`, allowing them to resolve through their canonical base item definitions without a save wipe.
- Increased bag item icon size so icons fill most of the item slot while preserving rarity borders, stack counts, names, and interactions.
- Enlarged Character window equipment item icons and cleaned up filled equipment card layout for better readability.
- Preserved item stats, equipment behavior, bag behavior, loot/vendor data, and save compatibility.

## V0.17.19 - Camera Rotation Pivot / Ground Drift Fix
- Fixed camera rotation pivot behavior so the world no longer slides under a stationary player during rotation.
- Centralized camera/world projection around the active player/world target so tiles, entities, props, VFX, targeting, and inverse screen conversion share the same pivot.
- Stabilized per-frame camera shake and blocked independent WebGL terrain promotion while yaw is moving, preventing terrain from being composed through a separate screen-space transform during rotation.
- Preserved smooth rotation, movement, targeting, collision, and existing world rendering behavior.

## V0.17.18 - Fishing Line Attachment + Rotling Root Animation Fix

### Fixed / Updated
- Fixed fishing line rendering so the line now attaches to the fishing pole tip and connects cleanly to the bobber.
- Added visible Rotling root/entangle VFX so rooted players can see roots holding them in place.
- Tied root visuals to the active root status duration and cleanup path.
- Preserved fishing mechanics, combat balance, and existing status effect behavior.

### Implementation Notes
- Root cause for the fishing bug was that the line origin was projected from a world-space estimate instead of the actual rendered fishing-pole tip produced by the character model renderer.
- The character renderer now publishes the rendered rod-tip screen anchor each frame while fishing; the fishing renderer consumes that anchor and only falls back to the older world projection for first-frame or hybrid-render cases.
- Root/entangle visuals are synchronized from active `root` status effects through the status-effect owner and rendered by the existing combat VFX renderer; cleanup shortens the VFX when the status is removed.

### Preserved
- Fishing rates, fishing loot, bobber gameplay, Rotling stats, root duration, combat balance, and save format were not changed.

## V0.17.17 - Character Model Background + Belt Slot + Nameplate Revamp

### Fixed / Updated
- Updated the Character model preview to use the player’s class background image instead of the generic green background.
- Added a new Belt equipment slot to the canonical Character equipment system and Character window layout.
- Revamped overhead nameplates to a two-line layout showing Name + class icon on the top line and Lvl:X + Action on the bottom line.
- Preserved existing character stats, inventory behavior, equipment behavior, and shared UI functionality.

### Implementation Notes
- The Character model preview now applies class background art through the existing class background resolver path used by class HUD/creator visuals.
- Belt is initialized through the existing equipment slot list, normalized by equipment-slot aliases, rendered in the Character window, included in stat accumulation, and initialized on save-load through the existing equipment object.
- World nameplates now resolve class emblems for all playable classes, including Assassin, Warden, Paladin, Ranger, Wizard, and Shaman instead of collapsing several classes into older fallback groups.

## V0.17.16 - Item Icon Runtime Display Fix

### Fixed
- Fixed item icon runtime display so mapped item icons now render in bags, inventory, equipment slots, tooltips, loot, and vendor/shop UI.
- Corrected item icon resolution to use canonical item definitions for saved item instances.
- Prevented filled equipment slots from showing empty-slot/category glyphs when real item icons exist.
- Added runtime display verification to the item icon mapping audit.

### Implementation Notes
- Root cause was runtime item `id` serials outranking canonical `itemId` / `sourceItemId` in `itemIconDescriptor()`.
- Added one canonical resolver path through `resolveCanonicalItemDef()`, `resolveItemIconKey()`, `itemIconDescriptor()`, and `itemIconHtml()`.
- Added once-only debug/dev logging for missing mappings, missing assets, and unresolved saved item definitions.
- Added starter profession tool PNG assets for the screenshot QA items that were not present in the previous uploaded icon manifest.

### Preserved
- Item names, stats, descriptions, rarity, prices, stack sizes, bag slot counts, loot tables, quest rewards, vendor behavior, character stats, equipment behavior, and save format were not changed.

## V0.17.15 - Actual Item Icon Integration Revalidation Pass

### Added / Updated
- Refreshed the canonical `assets/item-icons/` runtime PNGs from the uploaded `Item Icons(1).zip` pack.
- Revalidated all 153 uploaded item icons against canonical game item IDs and regenerated `assets/item-icons/manifest.json` source-pack metadata.
- Regenerated `docs/ITEM_ICON_MAPPING_AUDIT.md` with mapped items, remaining fallback items, unmatched uploads, and normalized/truncated-name corrections.
- Added `docs/V0.17.15_ACTUAL_ITEM_ICON_INTEGRATION_PASS.md` for this phase report.

### Preserved
- Item names, stats, descriptions, rarity, prices, stack sizes, equip slots, loot tables, quest rewards, bag slot counts, vendor behavior, inventory rules, and save compatibility were not changed.
- Existing item instances continue resolving icons from canonical item definitions through stable item IDs and `iconKey` / `DR.ITEM_ICON_KEYS_BY_ID`.
- No per-window render hacks, bottom-of-file patch blocks, duplicate item definitions, timeout fixes, or patch-cascade code were added.

### Validation
- Confirmed all uploaded PNGs are accounted for by the canonical item-icon manifest.
- Confirmed the existing shared item icon resolver remains the single UI path for inventory, bags, equipment, Character slots, loot, shops, rewards, and tooltips.
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.

## V0.17.14 - Actual Item Icon Integration Pass

### Added / Updated
- Integrated all 153 authoritative icons from `Item Icons.zip` into their actual canonical game item records.
- Replaced the previous 120px sheet crops with the ZIP's finished 128×128 RGBA files, preserving complete outer frames and transparency.
- Kept the existing centralized item icon resolver so inventory, bags, equipment, Character slots, loot, shops, rewards, banks, trade, and tooltips use the same canonical art.
- Regenerated the item icon mapping audit under `docs/ITEM_ICON_MAPPING_AUDIT.md` with canonical IDs, exact files, missing game items, and 16 documented truncated-label corrections.

### Save Compatibility
- Existing saved item instances continue resolving icon keys through their stable canonical item IDs; no save migration or wipe is required.

### Preserved
- Item names, stats, descriptions, rarity, prices, stack sizes, equip slots, loot tables, quest rewards, bag capacities, consumable effects, gameplay balance, and inventory rules were not changed.
- No per-window name checks, duplicate item definitions, alternate icon renderer, late patch, timeout, or patch-cascade code was added.

### Validation
- All 153 ZIP entries map one-to-one to canonical item IDs and byte-match the final runtime PNGs.
- Full JavaScript and JSON syntax validation completed successfully.
- Representative shared-renderer checks passed for bag, weapon, offhand, chest, boots, accessory, food, tooltip, vendor, loot, equipped, and normal inventory displays.

## V0.17.13 - Player HUD Class Icon Fill/Scale Correction

### Updated
- Increased the player HUD class icon render fill from `contain` to 140% so visible artwork fills the right-side HUD space more effectively.
- Reduced the apparent excess padding caused by transparent margins inside the canonical 512px class-emblem source images.
- Preserved the existing 84×84px right-side container, compact HUD dimensions, right-side placement, and class-generic resolver.

### Technical
- Measured all 14 class-emblem alpha bounds before choosing the shared scale.
- Visible emblem heights now occupy approximately 81–91% of the 84px area; Warden increases from approximately 52px to 73px of visible height.
- Removed the redundant later `contain !important` HUD rule that prevented the owning class-icon sizing rule from controlling fill.

### Protected
- Player text, HP/resource bars, buffs/debuffs, resource behavior, Party / Companions HUD, gameplay, inventory, and menus were not changed.
- No class-specific branch, transform scaling, duplicate icon, portrait frame, late override, timeout, or patch-cascade code was added.

### Validation
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.
- Alpha-bound calculations confirmed no visible class artwork clips at 140% fill for Warden, Fighter, Assassin, or any other canonical class.

## V0.17.12 - Character Window Cleanup + Model Background Pass

### Updated
- Cleaned up the Character window by removing the redundant top crest and repeated character identity summary.
- Replaced the forced 900px panel and 100%-height sheet with content-driven sizing, eliminating the oversized empty bottom area while retaining a viewport-safe maximum height.
- Tightened the title bar, close button, padding, and spacing so Character Model and Character Stats fit more intentionally.
- Added the current class background art behind the Character Model preview through the existing shared class visual resolver.

### Preserved
- Equipment slots, equipped item details, tooltips, paper-doll rendering, character stats, gear score, set bonuses, resources, and open/close behavior were not changed.
- The model background uses a subdued overlay behind the existing preview canvas and works through canonical class mapping for every class.
- No duplicate class mapping, window renderer, late override, wrapper hotfix, timeout, or patch-cascade code was added.

### Validation
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.
- Structural checks confirmed content-height ownership, removal of the duplicate header identity, preserved Character Model/Stats/set-bonus regions, and shared Assassin/Bard class background resolution.

## V0.17.11 - Player HUD Right-Side Class Icon Placement Fix

### Fixed
- Fixed player HUD class icon placement so the single canonical class icon now renders in the dedicated right-side player row column.
- Removed the left-first source ordering that could place the player class icon before the text and bars when the shared HUD container layout was disrupted.
- Reused the existing compact HUD width and right-side space without expanding the panel.
- Preserved player name/meta text, HP and Mana/Focus bars, buffs/debuffs, and class-themed background styling.

### Technical
- Isolated player vitals and class art inside the owning `playerHudCore` grid instead of sharing the outer layout container with the expandable Party / Companions HUD.
- Placed the class-art element after player vitals in DOM order and explicitly anchored it to grid column 2 with right alignment.
- Retained the existing canonical class resolver and single `hudPortraitIcon` update target for every class.

### Protected
- Party / Companions rendering, companion commands, player resources, gameplay, inventory, menus, and UI layering were not changed.
- No class-specific branch, duplicate icon, offset hack, late override, wrapper hotfix, timeout, or patch-cascade code was added.

### Validation
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.
- Structural layout checks confirmed one player icon target, vitals-first/art-second source order, and dedicated right-column ownership.

## V0.17.10 - Player HUD Compact Layout + Right-Side Class Art Fix

### Updated
- Tightened the player HUD width, minimum height, grid columns, gap, and padding to remove unused empty space.
- Kept the resolved player class image on the right as larger integrated class art.
- Removed the small square portrait border, background, clipping, and shadow frame around the class image.
- Preserved class-themed player HUD backgrounds and existing HP/Mana/Focus rendering and resource-type behavior.

### Protected
- Player stats, resources, buffs/debuffs, class mapping, Party / Companions HUD rendering, companion commands, inventory, menus, and UI layering were not changed.
- No Bard-specific branch, duplicate HUD, late override, wrapper hotfix, timeout, or patch-cascade code was added.

### Validation
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.
- Player HUD ownership, class resolution, bar rendering, and Party / Companions attachment paths remained intact.

## V0.17.09 - Item Icon Integration Pass

### Added
- Added 153 uploaded accessory, armor, bag, food, and weapon icons to their matching canonical item records.
- Added clean, label-free 120px runtime icon files under `assets/item-icons/` and reproducible extraction metadata.
- Added the item icon mapping audit under `docs/ITEM_ICON_MAPPING_AUDIT.md`.

### Updated
- Updated the canonical item icon resolver so inventory, equipment, loot, vendor, quest reward, bag, tooltip, and other existing item-icon consumers use the correct image art automatically.
- Preserved the existing procedural icon fallback for items without uploaded artwork.
- Preserved save compatibility by resolving older saved item objects through their stable canonical item IDs.

### Protected
- Item stats, rarity, requirements, prices, stack sizes, drop rates, quest rewards, starter gear, equipment slots, consumable effects, and save data were not changed.
- No per-panel item-name switches, duplicate item definitions, render-layer item patches, timeout fixes, or duplicate icon systems were added.

### Validation
- All 153 mappings resolve to canonical item IDs and existing non-empty PNG files; no duplicate or orphan uploaded mappings remain.
- Full JavaScript syntax validation completed successfully; direct Python JSON parsing validated all 70 project JSON files successfully. The exact sequential `json.tool` xargs command exceeded the sandbox timeout before completion.

## V0.17.08 - Player HUD Class Background + Class Icon Layout Pass

### Updated
- Added class-themed background art to the player HUD using the same shared class visual resolver and assets as the Party / Companions HUD.
- Enlarged the player class emblem from a small badge into a primary 94px HUD visual.
- Moved the player class emblem to a dedicated right-side column.
- Rebalanced player HUD width, height, padding, and content spacing so the name, level/gender/class line, HP/resource bars, and status tray remain readable.

### Protected
- Party / Companions HUD class backgrounds, resource bars, statuses, and companion command buttons continue using their existing renderer and layout.
- No gameplay, class balance, combat, item, spell, save, or progression behavior changed.
- No duplicate class mapping, late override, wrapper hotfix, timeout, or patch-cascade system was added.

### Validation
- JavaScript and JSON syntax validation completed successfully.
- Embedded player HUD markup and the shared class-art application path were checked as part of the V0.17.08 HTML validation.

## V0.17.07 - Full Codebase Bug Audit + Stabilization Cleanup

### Fixed
- Audited the full BlackRoot codebase for active regressions, stale references, unsafe render state, UI input failures, save/default issues, and duplicate/dead code.
- Fixed confirmed root-cause bugs found during the audit.
- Restored or stabilized broken HUD/UI behavior where applicable.
- Corrected confirmed canvas/render state, UI hitbox, settings/default, parser, or data-registration issues discovered during the audit.
- Restored the gameplay Player HUD visibility guard after recent paperdoll/HUD layout work.
- Restored the Party / Companions HUD by reasserting the existing unified companion HUD attachment inside the player HUD during gameplay UI refreshes.
- Restored missing Menu buttons, including Logout and Exit Game, by correcting the existing Menu Patch Notes panel markup/ownership so the bottom menu buttons are no longer nested inside the hidden patch-notes container.
- Corrected Menu panel sizing/scrolling so the full intended button list remains visible and clickable at 1440p, fullscreen, and smaller windows.
- Corrected invalid or missing HUD preference values so required HUD elements default visible.
- Consolidated Settings input under the canonical delegated UI controller.

### Cleaned
- Removed proven dead, duplicate, or harmful code paths where safe and documented.
- Removed the obsolete Settings regression wrapper and duplicate per-render control listeners.
- Preserved owning systems and avoided duplicate render/UI/save/gameplay paths.

### Protected
- Combat balance, item stats, spell behavior, class roles, loot drop rates, inventory behavior, save data, dungeon mechanics, paperdoll visuals, cape/cloak rendering, minimap behavior, and party/bot/mercenary gameplay were not changed unless directly required to fix a confirmed bug.
- No cascade patches, wrapper hotfixes, late setTimeout repairs, or duplicate systems were added.
- Back-facing cape/cloak rendering was preserved.
- Weapon identity, back-facing weapon occlusion, paperdoll visuals, mini-map cleanup, loot roll UI, combat, inventory, save/load, party behavior, and class systems were not changed.
- Bank button remains hidden; bank/stash access design was not changed.
- No duplicate HUD, menu, paperdoll, or renderer systems were added.

### Validation
- Confirmed syntax validation passes.
- Confirmed Player HUD, Party / Companions HUD, Logout, and Exit Game are restored through the existing UI/menu ownership.

## V0.17.06 - Mini-Map Window Cleanup + HUD Panel Revamp

### Updated
- Cleaned up the Mini-Map HUD window layout.
- Reduced visual clutter and reorganized minimap, dungeon, zone, time, and weather information into a compact readable panel.
- Improved Mini-Map panel spacing, hierarchy, and BlackRoot-style HUD presentation.
- Cleaned dungeon info display when shown with the Mini-Map panel.

### Removed
- Removed the broken FPS counter from the Mini-Map window.

### Protected
- Minimap markers, dungeon data, floor progression, time cycle, weather simulation, map data, combat, party, loot, and save/load behavior were not changed.
- Debug/performance systems outside the broken Mini-Map FPS display were preserved.
- No duplicate minimap renderer or HUD panel system was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed Mini-Map window displays cleanly and no longer contains the broken FPS counter.

## V0.17.05 - Back-Facing Cape / Cloak Occlusion Fix

### Fixed
- Fixed capes/cloaks rendering behind the body when humanoid models face away from the camera.
- Corrected direction-aware cape layering so back-facing player characters, bots, mercenaries, and shared race-rendered humanoids visibly show cloaks over the back of the model.
- Preserved front-facing, side-facing, combat, and paperdoll equipment behavior while correcting back-slot garment occlusion.

### Protected
- Combat, movement, items, loot, save/load, bot AI, mercenary AI, and class mechanics were not changed.
- Previous fixes for weapon identity, white-stick placeholders, global crossbow fallback, stretched auto-attack arms, and back-facing weapon occlusion were preserved.
- No duplicate paperdoll renderer, cloak system, or class renderer was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed back-facing capes use the shared paperdoll back-slot renderer over the back-facing torso while front/side capes keep the original behind-body placement.

## V0.17.04 - Loot Roll Button Input + Prompt Dismissal Fix

### Fixed
- Fixed loot roll buttons not submitting player choices.
- Need, Greed, and Pass now record decisions against the active loot roll session.
- Loot roll prompt now closes immediately after a valid player choice.
- Corrected loot roll button click handling after centered prompt positioning and 1440p scaling.
- Roll sessions now continue resolving internally after the player prompt is dismissed.

### Protected
- Loot drop rates, item stats, rarity rules, bot gear evaluation, bot auto-equip, inventory, equipment, combat, and save/load behavior were not changed.
- No duplicate loot roll UI or roll session system was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed Need, Greed, and Pass use the same canonical submit path and dismiss the active prompt.

## V0.17.03 - Patch Notes Display Regression Fix

### Fixed
- Fixed Patch Notes UI panels failing to show the full current patch history after V0.16.96.
- Rebuilt the embedded Patch Notes window content from the canonical PATCH_NOTES.md history so V0.16.97, V0.16.98, V0.16.99, V0.17.00, V0.17.01, V0.17.02, and V0.17.03 appear in-game.
- Corrected stale static Patch Notes panel content in both the splash/main-menu panel and the in-game Menu panel.
- Replaced the old single-line list treatment with structured version cards that preserve version headings, section headings, bullet spacing, and scroll behavior.

### Protected
- Existing patch history was preserved.
- Gameplay, combat, items, party systems, dungeon systems, loot rolls, and paperdoll visuals were not changed.
- No duplicate patch notes window, gameplay system, or unrelated UI panel was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed the embedded Patch Notes panels include entries after V0.16.96.

## V0.17.02 - Paperdoll Equipment Visual Fidelity Revamp

### Updated
- Revamped paperdoll equipment visuals across visible gear slots.
- Upgraded armor, robes, helmets, shoulders, gloves, boots, cloaks, belts, shields, books, foci, instruments, and class gear from generic shapes into higher-detail class-quality visuals where the existing paperdoll renderer supports them.
- Added sharper silhouettes, layered construction, material details, trims, straps, buckles, stitching, gems, runes, and rarity accents.
- Improved direction-aware paperdoll layering so gear respects body, robe, cloak, arm, weapon, and back-facing occlusion.
- Preserved equipped item visual overrides and class default visuals.

### Protected
- Item stats, rarity values, combat balance, loot rules, inventory behavior, equip/unequip behavior, class spells, and save data were not changed.
- Previous fixes for white-stick placeholders, global crossbow fallback, stretched auto-attack arms, and back-facing weapon occlusion were preserved.
- No duplicate paperdoll renderer, equipment system, weapon resolver, or class renderer was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed the existing paperdoll renderer remains the single owner for upgraded gear visuals.

## V0.17.01 - Dungeon Info UI Reposition + Cleanup

### Updated
- Moved dungeon information into a clean HUD card under the mini-map.
- Replaced the rough upper-screen dungeon text overlay with a BlackRoot-style obsidian/parchment panel.
- Improved dungeon info readability for dungeon name, floor count, current floor, objective/mini-boss count, and safe transition status.
- Anchored dungeon info to the minimap HUD wrapper so it stays positioned with the mini-map across camera movement, fullscreen, and responsive scaling.

### Protected
- Dungeon data, floor progression, mini-boss tracking, transitions, minimap behavior, combat, loot, party behavior, and save/load logic were not changed.
- No duplicate dungeon UI or minimap renderer was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed the old rough canvas overlay path was removed from the live dungeon render path.

## V0.17.00 - Party Loot Roll + Bot Gear Need/Equip System

### Added
- Added Need / Greed / Pass loot rolls for gear drops above white rarity when active party bots or mercenaries are present.
- Added party loot roll sessions with non-blocking player roll UI, 30-second timer, roll logging, and Need-before-Greed resolution.
- Added bot and mercenary gear-need evaluation through the existing loot, equipment, party, bot, and mercenary systems.
- Bots and mercenaries now roll Need only on usable gear upgrades.
- Bots and mercenaries automatically equip won gear when they win a valid Need roll.
- Added gear upgrade scoring based on class, role, slot, rarity, item level, stats, and current equipped item.

### Protected
- White/common gear and non-gear loot continue using existing loot behavior.
- Combat balance, enemy drop rates, item stats, spell behavior, and class mechanics were not changed.
- Existing inventory, equipment, party, bot, and mercenary systems were reused instead of duplicated.

### Validation
- Confirmed syntax validation passes.

## V0.16.99 - Racial Ability Removal + 1440p Display + Party UI Class Card Revamp

### Removed
- Completely removed racial abilities from active gameplay, input handling, UI references, race data, and save hydration.
- Removed the dead racial ability runtime system from the script load order.
- Removed racial ability keybind conflicts so meditation/input ownership no longer competes with racial ability handling.

### Updated
- Updated the game's display configuration with a 2560x1440 default target for 1440p presentation while preserving responsive viewport sizing.
- Revamped Party / Companions cards to use class-themed background imagery from the existing class-background asset set.
- Preserved readability for names, bars, buff rows, and command buttons while improving class identity in the party window.

### Protected
- Party commands, class icons, HP/resource bars, buff rows, and party functionality were preserved.
- Combat balance was not changed except for retirement of racial active/passive ability effects.
- No duplicate display system, racial ability system, or party card renderer was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed racial ability runtime ownership is removed from active code/load order.
- Confirmed 1440p display target metadata is present.
- Confirmed party cards render class-themed backgrounds through the existing UI owner.

## V0.16.98 - Current Baseline Handoff

### Documented
- V0.16.98 was the user-provided current baseline archive used for subsequent V0.16.99+ work in this workspace.
- No standalone V0.16.98 phase report or feature summary was present in the project files, so no undocumented gameplay changes were reconstructed for this entry.

### Protected
- Existing patch history and later documented phase reports were preserved.

## V0.16.97 - Back-Facing Weapon Layering Fix

### Fixed
- Fixed weapons rendering through humanoid bodies when characters face away from the camera.
- Added/corrected direction-aware weapon/body layering for back-facing and side-facing class models.
- Corrected staff, shield, bow/crossbow, lute, dagger, focus, and other held-weapon draw order relative to torso, robe, cloak, and arms.

### Protected
- Weapon identity, weapon stats, combat behavior, auto-attack timing, class models, and equipment logic were not changed.
- Previous fixes for white-stick placeholders, global crossbow fallback, stretched auto-attack arms, and upgraded weapon visuals were preserved.
- No duplicate weapon renderer or paperdoll system was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed tested classes render weapons correctly from front, side, and back facings.

## V0.16.96 - Class Buff Spell Icon Linking Pass

- Active class buffs, debuffs, HoTs, DoTs, pet buffs, and group buffs now use their originating spell icons in the buff/debuff tray.
- Fixed generic triangle buff icons appearing for class buffs such as Fighter Momentum.
- Added source spell icon metadata to class-applied status effects.
- Updated status effect rendering to prefer source spell icons while preserving generic fallback icons for non-spell effects.
- Preserved circular buff/debuff timers, stack labels, time labels, and tooltip behavior.

## V0.16.95 - Party EXP Bond Bonus

### Added
- Added a new Party EXP Bond Bonus system.
- Each active non-player party member now increases EXP gained by 1%.
- Party EXP bonus now correctly caps at +5%, based on the 6-member party limit where the player occupies one slot.
- Applied the bonus through the central EXP award path so combat, quests, and other EXP sources remain consistent.
- Added safe handling for solo play, missing party data, inactive members, stale party data, and mercenary party members.
- Added EXP gain messaging that shows the party bonus when active.

### Protected
- No existing EXP amounts change for solo play or when no active non-player party members are present (+0%).
- Mercenaries and pets do not count toward the bonus, consistent with their existing non-slot-consuming status elsewhere in the party system.
- The pre-existing human-race +2% EXP bonus is unchanged in value and order of application; the new bonus only adds the party percentage on top.
- No duplicate EXP-award, party-tracking, or level-up system was added — all four existing player-XP award sites (combat kill, party kill-split, party-broadcast reward, quest reward) now route through one new `Game.prototype.awardPlayerXp` in `systems/combat-system.js`.

### Validation
- Confirmed syntax validation passes.
- Confirmed Base EXP 100 with 5 active non-player party members yields 105 final EXP and a "Party Bond Bonus: +5%" log message.
- Confirmed 6+ non-player party members (stale/bad data) still clamp to +5% (105 final EXP from a 100 base).

## V0.16.94 - Meditation System Major Feature Revamp

### Added
- Added full Meditation System with R-key activation, sit-down delay, out-of-combat validation, interruption rules, and recovery regen.
- Added Meditation XP and Level 1–20 progression.
- Added class-specific meditation auras, aura upgrades, and Level 20 ascension ring support (new Warden/Ranger/Assassin/Wizard/Shaman auras alongside the existing Fighter/Paladin/Rogue/Cleric/Enchanter/Summoner/Necromancer/Bard/Druid auras).
- Added pet cosmetic meditation mirroring at reduced aura opacity.
- Added autonomous bot and mercenary meditation AI with safety checks and a meditation desire score layered on top of the existing HP/mana-threshold triggers.
- Added mercenary Rest, Stand, and Follow meditation command support (Rest/Follow reuse the existing meditate/follow commands; Stand is new).
- Added Bard Harmonic Meditation (Soothing Presence / Meditation Melody / Crescendo of Tranquility), Bard Duet, and Bard emote/aura data hooks.
- Added group meditation synergy and full-party synergy.
- Added environmental meditation bonus hooks (inns, temples, ruins, forests, campfires, graveyards, ley lines, battlefields, water, musical venues, mountain peaks, caves) and Meditation Garden zone-attribute support (new editor tool).
- Added The Great Stillness rare world event, scheduled off the existing world clock.
- Added meditation achievement/title save hooks (11 achievements/titles).
- Added migration-safe meditation save data (`entity.meditation`) for the player character.

### Protected
- Combat does not pause during Great Stillness.
- No meditation regen occurs during combat.
- Regen multipliers are capped through the central `calculateMeditationRegen` function via `MEDITATION_BALANCE.maxTotalRegenMultiplier`.
- Pets do not generate independent meditation bonuses (cosmetic mirror only, no XP/synergy).
- Existing saves migrate safely; meditation level/xp clamp to 1–20 and unknown emote/achievement ids are dropped with a console warning.
- No duplicate meditation, regen, AI, party, event, or save systems were added; new logic was centralized in the new `systems/meditation-system.js` owning module and wired into the pre-existing `game.js` state-machine entry points.
- Two pre-existing dead/duplicate code paths were removed: a stale duplicate `nextMeditationXp` in `systems/ui-system.js`, and the flat `+3` `bardMeditationAuraBonus` helper in `game.js` that the new central Bard tier calculation supersedes.

### Validation
- Confirmed syntax validation passes (`node --check` on every `.js` file, `json.tool` on every `.json` file).
- Confirmed player, bot, mercenary, Bard, group, environment, event, and save migration meditation flows were reviewed against the design source.

## V0.16.93 - Class Weapon Visual Upgrade Pass

### Updated
- Upgraded class weapon visuals across shared class/default held weapons.
- Added sharper silhouettes, cleaner materials, better outlines, highlights, trims, wraps, gems, strings, crests, and class-specific weapon details.
- Improved visual identity for class weapons such as Assassin crossbow, Bard lute, Cleric holy weapon, Fighter greatweapon, Rogue daggers, Paladin weapon/shield, Ranger bow, caster foci/staves, Shaman totem, Necromancer bone focus, Druid staff, and Warden nature/stone weapon.
- Improved shared weapon category rendering while preserving the canonical weapon resolver.

### Protected
- Weapon stats, combat balance, attack timing, class mechanics, item behavior, and save behavior were not changed.
- Previous fixes for white sticks, global crossbow fallback, and stretched auto-attack arms were preserved.
- No duplicate paperdoll, weapon resolver, or render system was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed shared class weapon categories render through the existing resolver path.

## V0.16.92 - Global Crossbow Held-Weapon Regression Fix

### Fixed
- Fixed global held-weapon regression where every class could resolve to the Assassin/crossbow weapon visual.
- Restored per-class and equipped-item weapon visual resolution.
- Corrected weapon fallback/cache behavior so weapon visuals no longer bleed across classes.
- Preserved the previous fixes for white-stick placeholders and stretched auto-attack arms.

### Protected
- Equipment stats, combat balance, attack timing, class mechanics, and spell behavior were not changed.
- No duplicate paperdoll, held-weapon, or auto-attack render system was added.
- No white-stick placeholder path was restored.

### Validation
- Confirmed syntax validation passes.
- Confirmed class default weapon resolution maps all 14 classes to distinct class-appropriate weapon/offhand visuals.

## V0.16.91 - Auto-Attack Weapon Overlay / Arm Stretch Fix

### Fixed
- Fixed auto-attack state rendering the old white-stick placeholder weapon.
- Fixed stretched-arm auto-attack regression caused by incorrect weapon/hand transform usage.
- Auto attacks now use the same resolved class/equipped weapon visuals as idle and fighting states.
- Corrected weapon grip, hand anchor, and swing transform behavior during full wind-up attacks.

### Protected
- Auto-attack damage, speed, range, hit chance, crit chance, threat, and combat balance were not changed.
- Class weapon visuals from V0.16.90 were preserved.
- No duplicate renderer, paperdoll system, or auto-attack animation system was added.

### Validation
- Confirmed syntax validation passes.
- Confirmed all tested classes keep correct weapons during idle, fighting, and auto attack.

## V0.16.90 - Class Weapon Paperdoll / Held-Weapon Fix

### Fixed
- Fixed class weapon rendering so classes no longer display generic white stick placeholders in their hands.
- Restored correct held-weapon / off-hand visuals for player classes and shared class-based renderers.
- Corrected class weapon presentation for Assassin, Bard, Cleric, and other affected classes by resolving equipped item visual metadata and drawing proper bow, crossbow, lute, focus, book, skull, totem, shield, dagger, mace, wand, staff, and two-handed weapon shapes.

### Protected
- Equipment stats, combat balance, attack timing, and class mechanics were not changed.
- No duplicate renderer, paperdoll system, or held-item patch path was added.
- Nameplates, HP bars, hitboxes, and selection rings were not changed.

### Validation
- Confirmed syntax validation passes.
- Confirmed affected class starter weapons resolve to class-appropriate held-item render shapes instead of white stick fallbacks.

## V0.16.89 - Full Class Starter Gear Revamp

- Replaced all class starter gear with new V0.16.89 starter kits for all 14 classes.
- Added exactly 5 starter equipment items per class.
- Added class identity starter items such as Fighter bruiser charm, Ranger quiver, Bard lute, and role-specific offhands.
- Reworked Fighter starter gear around two-handed leather DPS identity instead of tank/shield gear.
- Reworked Ranger starter gear around bow and quiver identity.
- Reworked Assassin starter gear around crossbow and throwing weapon identity.
- Reworked Bard starter gear around songblade and lute identity.
- Fixed starter gear slot resolution so offhand/charm items equip correctly.
- Added persistent starter gear grant state to prevent duplicate starter gear after save/load.
- Removed old class starter gear references from the active starter gear map.

## V0.16.88 - Melee Full Wind-Up Swing Correction

### Fixed
- Improved melee auto-attack swing amplitude.
- Melee attackers now hike the arm and weapon higher before striking.
- Melee attackers now swing downward lower through the enemy for a clearer full strike.
- Corrected shallow/twitch-like melee swing motion from the previous pass.

### Protected
- Auto-attack damage, speed, range, hit chance, crit chance, threat, and combat balance were not changed.
- Spell animations and class spell behavior were not changed.
- No duplicate combat animation or auto-attack systems were added.

### Validation
- Confirmed syntax validation passes.
- Confirmed melee auto attacks animate with a full wind-up and downward strike without combat desync.

## V0.16.87 - Melee Auto-Attack Swing Animation

### Updated
- Added smooth melee auto-attack swing animations for melee classes.
- Melee attackers now raise their weapon, swing downward toward the enemy, hit on the impact frame, and recover smoothly.
- Added direction-aware melee swing motion for supported facings.
- Added class-appropriate swing styling for Fighter, Rogue, Paladin, Warden, and any existing melee-flagged classes.
- Melee bots and melee mercenary-style bot actors that share the humanoid/class renderer now use the same visual swing state when their real auto attack resolves.

### Protected
- Auto-attack damage, speed, range, threat, hit chance, crit chance, and combat balance were not changed.
- Spell animations and class spell behavior were not changed.
- No duplicate combat animation or auto-attack systems were added.
- No action bar, inventory, bank/stash, settings, map, quest, dialogue, spellbook, party, mercenary, pet, save, or unrelated renderer behavior was intentionally changed.

### Validation
- Confirmed syntax validation passes.

## V0.16.86 - High-Quality Procedural VFX Renderer Revamp

### Updated
- Reworked core spell VFX rendering from flat one-pass primitives into layered procedural Canvas 2D recipes.
- Added reusable renderer helpers for soft glow, ground ellipses, expanding rings, tapered/ribbon trails, spark bursts, mote fields, smoke wisps, arc sigils, rune fragments, projectile cores, and impact blooms.
- Added seeded deterministic variation and easing helpers so repeated casts have stable variation without looking robotic.
- Upgraded generic `ring`, `bolt`, `statusPulse`, `combatImpact`, and `combatSpark` rendering.
- Upgraded Assassin VFX rendering for projectile, impact, crosshair, tripwire, poison pulse, mark line, mark sigil, mark flare, and mark removal effects.
- Added class/school/kind visual routing for poison, Assassin, Necromancer, Wizard, Cleric/heal, Druid/Warden/nature, Bard, Fighter, and generic magic styles.
- Extended effect object payload fields in the owning effect system while preserving pooling and cleanup.

### Performance Safeguards
- Preserved existing object pooling and active-effect budgets.
- Added render-side quality scaling that reduces spark/mote counts first when active effect count rises.
- Kept core projectiles, impacts, rings, and telegraphs readable during high effect load.
- Did not add WebGL, Three.js, PNG sprites, external dependencies, shader systems, duplicate renderers, setTimeout fixes, or wrapper hotfixes.

### Known Limitations / Future Work
- This pass upgrades representative generic effect types first; many class-specific bespoke VFX can still receive individual spell-by-spell art direction in later phases.
- Prismatic school-specific Wizard variants, full heal-school specialization, and per-spell cast anticipation can be expanded in future focused VFX passes.
- The renderer remains Canvas 2D procedural by design.

### Protected
- Spell damage, cooldowns, targeting, status rules, class logic, save/load behavior, inventory, UI, map, and combat behavior were not intentionally changed.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes using the sandbox-safe equivalent command.

## V0.16.85 - Skeleton Pet Nameplate Fix + Assassin VFX Revamp

### Fixed
- Fixed Necromancer skeleton pet nameplate placement so it sits above the pet’s head without touching the model.
- Corrected pet nameplate/HP bar anchor alignment across skeleton pet movement and animation states.

### Updated
- Revamped Assassin visual effects for Throwing Knife, Light Crossbow Shot, Tripwire, Poison Dart, and Marked for Death.
- Added sharper Assassin projectile, trap, poison, impact, and mark visuals through the existing VFX system.
- Added Marked for Death hit-feedback flare and removal visuals.
- Added poison pulse/tick visual feedback tied to the existing status tick owner.

### Protected
- Assassin spell balance, costs, cooldowns, damage, poison rules, mark rules, and trap rules were not changed.
- Necromancer pet stats, AI, commands, pathing, model art, and spell behavior were not changed.
- No duplicate VFX, nameplate, pet, or spell systems were added.

### Validation
- Confirmed syntax validation passes.
- Confirmed affected visuals render through existing Canvas 2D VFX owners without HUD/gameplay regressions.

## V0.16.84 - Necromancer Spell Revamp + Icon Integration

### Added / Updated
- Revamped Necromancer Level 1-20 spellbook from `Necromancer Spells(1).txt`.
- Integrated Necromancer spell icons from `Necromancer Spell Icons.zip` through the existing spell icon registry.
- Updated Necromancer bone, disease, curse, drain, undead pet, temporary undead swarm, pet repair, and dark sustain mechanics.
- Updated Raise Skeleton, Command Undead, Summon Bone Servant, Army of Bones, Death Pact, Bone Storm, Lich Veil, Soul Leech, and Grave Sovereign rules.
- Updated Necromancer spellbook/action bar/trainer icon references.

### Compatibility
- Preserved existing saves where possible.
- Preserved learned Necromancer spells and action bar assignments where spell IDs remained stable.
- Preserved backward-compatible Necromancer icon aliases for older spell drafts.
- Preserved existing non-Necromancer spellbooks.

### Protected
- Necromancer remains an undead pet DPS class, not a healer or tank.
- Necromancer pet model visuals from V0.16.83 were not changed.
- No unrelated class spellbooks were changed.
- No duplicate spell system or icon loader was added.

### Validation
- Confirmed Necromancer spellbook data loads.
- Confirmed Necromancer icons are filesystem assets in the existing icon pipeline.
- Confirmed syntax validation passes.

## V0.16.83 - Necromancer Pet Skeleton Model Revamp

### Updated
- Replaced the old Necromancer pet skeleton visual with a detailed undead skeletal minion model inside the existing procedural pet renderer.
- Added cracked skull, one glowing eye, hanging jaw, rusted helmet, exposed ribs, mummified flesh, necromantic runes, broken cleaver-like weapon, ruined shield prop, and battlefield scavenged gear.
- Updated the Necromancer pet skeleton across the existing eight-direction renderer and existing idle, walk, attack, hit, death, summon, and debug-render states.
- Preserved pet gameplay, stats, AI, commands, pathing, nameplate anchoring, and save behavior.

### Protected
- No Necromancer spell behavior was changed.
- No pet combat balance, pet damage, pet threat, pet duration, cooldowns, mana costs, or command logic were changed.
- Summoner pets and enemy skeleton mob renderers were not changed; they use separate render ownership.
- No 3D Prototype/WebGL renderer, duplicate pet renderer, cascade patch, bottom-of-file override, or timeout fix was added.

### Validation
- Confirmed syntax validation passes.

## V0.16.82 - Warden and Wizard Spell Revamp

### Added / Updated
- Revamped Warden Level 1–20 spellbook from Warden Spells.txt.
- Integrated Warden spell icons from Warden Spell Icons(1).zip.
- Updated Warden tank threat, bark/stone mitigation, regeneration, thorns, roots, zones, group protection, and Ancient Warden Form mechanics.
- Revamped Wizard Level 1–20 spellbook from Wizard Spells(1).txt.
- Integrated Wizard spell icons from Wizard Spell Icons(1).zip.
- Updated Wizard arcane, fire, frost, mana shield, shatter, burn, control, burst-window, prismatic, and Archwizard's Cataclysm mechanics.
- Updated spellbook/action bar/trainer icon references for Warden and Wizard through the existing class spell icon registry.

### Compatibility
- Preserved existing saves where possible by keeping stable spell names and generated spell IDs based on those names.
- Preserved learned spells and action bar assignments where spell IDs remain stable.
- Preserved existing non-Warden/non-Wizard spellbooks.

### Protected
- Warden remains a nature/stone sustain-control tank, not a Paladin clone or DPS bruiser.
- Wizard remains a fragile ranged magic DPS class, not a tank, healer, pet class, or Shaman clone.
- No duplicate spell system or icon loader was added.

### Validation
- Confirmed syntax validation passes.

## V0.16.81 - Shaman + Summoner Spell Revamp + Icon Integration

### Added / Updated
- Revamped Shaman Level 1-20 spellbook from the uploaded Shaman spell document.
- Integrated Shaman spell icons from `Shaman Spell Icons.zip` through the existing spell icon registry.
- Added/updated Shaman storm, earth, spirit, totem, brand, ritual field, delayed impact, and primal capstone behavior.
- Revamped Summoner Level 1-20 spellbook from the uploaded Summoner spell document.
- Integrated Summoner spell icons from `Summoner Spell Icons.zip` through the existing spell icon registry.
- Added/updated Summoner main pet, pet command, pet-only healing, temporary summons, planar gate, Bind Essence, Mass Dismissal, Overrun, Grand Binding, and Legion Gate support.

### Compatibility
- Existing saves remain compatible through stable Shaman and Summoner spell names/IDs where possible.
- Shaman and Summoner editor/runtime spell drafts refresh from canonical data on load.
- Existing action bar assignments are preserved where spell names remain stable.

### Protected
- Shaman remains a storm/earth/spirit ranged magic DPS class, not a healer replacement.
- Summoner remains a planar pet DPS class, not a healer, tank, or direct-burst Wizard clone.
- No unrelated class spellbooks, class models, action bar layout, inventory, bank/stash, party, mercenary, pet UI, map, quest, dialogue, settings, or renderer systems were intentionally changed.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes using the sandbox-safe equivalent command.

## V0.16.80 - HUD Bar Label Alignment Fix

### Fixed
- HUD bar labels now render at the left side of bars.
- HUD bar numeric values now render centered in bars.
- Player HP/resource bars now use the split label/value format.
- Party / Companions HP/resource bars now use the split label/value format.
- Action bar EXP bar now displays `Exp:` on the left and the current/max value centered.

### Protected
- Existing HP, Mana, Stamina, Energy, Focus, and EXP fill percentages are unchanged.
- Existing resource colors and the purple EXP gradient are preserved.
- Existing party/mercenary command buttons, row spacing, resource mechanics, spell behavior, and action bar layout are unchanged.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes using the sandbox-safe equivalent command.

## V0.16.79 - Ranger and Rogue Spell Revamp + Icon Integration

### Added / Updated
- Revamped Ranger Level 1-20 spellbook from the uploaded Ranger design document.
- Integrated Ranger spell icons from `Ranger Spell Icons.zip` through the existing spell icon registry.
- Updated Ranger Focus display, Hunter's Mark, trap rules, tracking, bow attacks, kiting, precision shots, and True Hunt capstone support.
- Revamped Rogue Level 1-20 spellbook from the uploaded Rogue design document.
- Integrated Rogue spell icons from `Rogue Spell Icons.zip` through the existing spell icon registry.
- Updated Rogue Energy display, stealth tools, poison stacks, bleeds, evasion windows, positional burst, execution skills, and Silent Execution capstone support.

### Compatibility
- Existing saves remain compatible through stable Ranger and Rogue spell names/IDs where possible.
- Ranger and Rogue editor/runtime spell drafts refresh from canonical data on load.
- Action bar assignments are preserved where existing spell names remain stable.

### Protected
- Ranger remains a bow/trap/tracking physical ranged DPS, not a pet class or Assassin clone.
- Rogue remains a dagger/short-blade stealth melee DPS, not a tank or Fighter clone.
- No unrelated class spellbooks, class models, action bar layout, inventory, bank/stash, map, quest, dialogue, settings, renderer, party, mercenary, or pet systems were intentionally changed.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes using the sandbox-safe equivalent command.

## V0.16.78 - Paladin, Fighter, and Necromancer Spell Revamp

### Added / Updated
- Revamped Paladin Level 1-20 spellbook from the uploaded Paladin design document.
- Integrated Paladin spell icons from `Paladin Spell Icons.zip` through the existing spell icon registry.
- Updated Paladin holy shield tank mechanics: threat tools, taunt, Judged threat mark, blessings, auras, mitigation, cleanse, interrupt, anti-undead utility, group protection, survival trigger, and defensive capstone.
- Re-validated Fighter Level 1-20 revamp compatibility from the current baseline and preserved Fighter Stamina/Momentum behavior.
- Revamped Necromancer Level 1-20 spellbook from the uploaded Necromancer design document.
- Updated Necromancer undead pet, disease, curse, drain, bone magic, pet repair, swarm, Death Pact, Lich Veil, Soul Leech, and Grave Sovereign mechanics.

### Compatibility
- Existing saves remain compatible through stable spell IDs where possible.
- Paladin and Necromancer editor/runtime spell drafts are refreshed from canonical data on load.
- Existing Fighter spell/action-bar behavior from V0.16.76/V0.16.77 remains preserved.

### Protected
- No non-Paladin/non-Fighter/non-Necromancer class spellbooks were intentionally changed.
- No class models, action bar layout, inventory, bank/stash, map, quest, dialogue, settings, renderer, party, mercenary, or pet UI systems were redesigned.
- No duplicate spell system or duplicate icon loader was added.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes using the sandbox-safe equivalent command.

## V0.16.77 - Fighter Stamina Color + Level-Up Popup Timing Fix

### Fixed
- Fighter Stamina resource bars now use a distinct warm amber/orange stamina gradient instead of Mana blue.
- Fighter Bot and Fighter mercenary companion resource bars now use the same Stamina color mapping when their class/resource type is Fighter/Stamina.
- Combat level-up popup now fades out after a 3-second total lifetime.
- Level-up popup countdown and text were updated from 5s to 3s.

### Protected
- Preserved Fighter Stamina values, costs, regeneration, Momentum behavior, spell balance, and action-bar behavior.
- Mana classes remain blue, and Assassin Focus remains separate from both Mana and Stamina.
- No duplicate popup, HUD, or resource-bar system was added.

### Validation
- JavaScript and JSON syntax validation passed.

## V0.16.76 - Fighter Spell Revamp + Icon Integration

### Added / Updated
- Revamped Fighter Level 1-20 spellbook from the uploaded Fighter spell balance document.
- Integrated Fighter spell icons from Fighter Spell Icons.zip through the existing filesystem spell-icon registry.
- Added Fighter Stamina player-facing cost labels in spellbook, action bar tooltips, and trainer/learn text paths that use the shared spell resource label helper.
- Added Fighter Momentum as an owned status-based stack mechanic with up to 5 stacks, 5-minute duration, and attack-speed impact through the existing combat timing owner.
- Updated Fighter heavy-weapon, cleave, stagger, execute, burst, shield-break, and risky DPS cooldown behavior.

### Compatibility
- Preserved the current spell compiler/default slot path so existing Fighter spellbook and hotbar assignments remain compatible where spell names/IDs match.
- Fighter still uses the existing internal mana numeric field for Stamina storage, avoiding a save-format fork while changing all relevant player-facing labels to Stamina.

### Protected
- Fighter remains a light/leather 2H melee DPS bruiser, not a tank.
- No taunts, shield mechanics, passive tank mitigation, heavy-plate identity, unrelated class spell changes, action-bar layout changes, or Fighter model visual changes were added.

### Validation
- JavaScript and JSON syntax validation passed.

## V0.16.75 - Fighter Model Revamp

### Updated
- Replaced the old Fighter player/class model with a revamped light-leather two-handed weapon bruiser visual.
- Added clearer Fighter identity: massive greatweapon silhouette, leather scale harness, wolf-fur mantle, linen wraps, wild hair, scars, war paint, belt pouches, trophy chain, thigh knife accessory, and battle-worn gear.
- Updated Fighter rendering across the existing direction and animation hooks through the class identity renderer.
- Updated generic Fighter fallback visuals so bot/mercenary fallback rendering no longer shows a shield or heavy plate profile.

### Protected
- Preserved Fighter gameplay, abilities, combat balance, movement, hitboxes, selection rings, nameplates, action bar behavior, and save/load behavior.
- Did not reintroduce WebGL, 3D Prototype rendering, duplicate Fighter render paths, cascade patches, wrappers, or timeout fixes.

### Validation
- JavaScript and JSON syntax validation passed.

## V0.16.74 - Status Timer Labels

### Updated
- Added a compact remaining-time label below every circular buff/debuff/status icon.
- Timer labels use the same status `remaining` value that drives the radial grey-out mask, keeping the text and circle synchronized.
- Uses seconds for short effects and `m:ss` / `h:mmh` formatting for longer effects.
- Expanded status-tray spacing so the timer labels remain readable under player, target, mercenary, companion, and action-bar status rows.

### Technical Notes
- Kept the change inside the existing status/UI ownership path.
- No spell data, mob data, status application logic, combat rules, inventory, save data, or action-bar slot logic was changed.

### Validation
- JavaScript syntax validation passes for changed files.

## V0.16.73 - Circular Buff/Debuff Timer Icons

### Updated
- Reworked the owned status-effect tray presentation from rectangular pips with a bottom duration bar into circular buff/debuff icons.
- Added a conic duration mask driven by each status effect's existing `remaining / duration` percentage.
- Icons now grey out around the circle as their timer expires while keeping the status glyph, tooltip, stack count, and buff/debuff filtering behavior intact.
- Applied the same status tray rendering path to player HUD, action-bar buff/debuff rows, target status tray, mercenary status tray, and unified companion HUD status rows.

### Technical Notes
- Kept the change inside the existing status/UI owners: `systems/status-effect-system.js`, `systems/ui-system.js`, and the canonical HTML CSS block.
- No spell data, mob data, status application logic, save data, inventory, action bar slot logic, or combat rules were changed.

### Validation
- JavaScript syntax validation passes for changed files.

## V0.16.72 - Druid + Enchanter Spell Revamp + Icon Integration

### Added / Updated
- Revamped Druid Level 1-20 spellbook from the uploaded Druid spell balance document.
- Integrated Druid spell icons from Druid Spell Icons.zip into the existing filesystem spell-icon registry.
- Revamped Enchanter Level 1-20 spellbook from the uploaded Enchanter spell balance document.
- Integrated Enchanter spell icons from Enchanter Spell Icons.zip into the existing filesystem spell-icon registry.
- Added/updated Druid HoT, nature-control, animal-spirit, moon/nature, and group-sustain spell behavior through the existing spell/status owners.
- Added/updated Enchanter mind-control, rune, illusion/decoy, charm, threat-blur, and diminishing-return spell behavior through the existing spell/status owners.

### Compatibility
- Preserved existing saves where possible by keeping spell names/slots stable and adding Druid/Enchanter to the canonical revamp refresh set.
- Preserved learned spell and action bar assignment compatibility through the existing spell compiler/default slot system.
- Documented Druid icon name mismatches and level/theme mappings in the phase report.

### Validation
- JavaScript syntax validation passes.
- JSON validation passes.

## V0.16.71 - Assassin + Bard + Cleric Spell Revamp

### Updated
- Revamped Assassin level 1-20 spell data around Focus, Marked for Death, poison payloads, traps, crossbow burst, and ranged execute windows.
- Revamped Bard level 1-20 spell data around major songs, minor debuffs, regeneration, rhythm buffs, movement support, and crescendo utility.
- Revamped Cleric level 1-20 spell data around direct heals, HoTs, wards, cleansing, emergency saves, anti-undead support, and holy damage.
- Preserved existing Bard, Cleric, and Assassin spell icon bindings from prior icon integration passes.

### Fixed / Protected
- Assassin spell tooltips, spellbook rows, action-bar costs, trainer lists, and HUD resource label now display Focus instead of Mana/MP.
- Existing saved spell editor data for Assassin, Bard, and Cleric is synchronized to the canonical revamp spell definitions on load.
- Added lightweight owned behavior support for poison stacks, marked targets, Bard song limits, Cleric wards, and lethal-save effects.

### Validation
- JavaScript syntax validation passed.
- JSON syntax validation passed.

## V0.16.70 - Combat Level-Up Popup System

### Added
- Added a centered translucent combat level-up popup.
- Popup displays the player’s current combat level.
- Popup automatically fades after 5 seconds.
- Added countdown/progress cue.
- Added chat/system log message for combat level-up.

### Fixed / Protected
- Popup triggers only on combat level increases.
- Popup does not trigger from save/load.
- Popup does not block gameplay input.

### Validation
- Confirmed popup trigger is wired to the authoritative combat level-up owner.
- Confirmed popup uses pointer-events none and does not consume gameplay input.
- Confirmed existing save data does not persist or replay transient popup state.

## V0.16.69 - Bard + Cleric Spell Icon Integration

- Integrated Bard spell icons from Bard Spell Icons.zip into the existing spell icon registry.
- Integrated Cleric spell icons from Cleric Spell Icons.zip into the existing spell icon registry.
- Updated Bard spellbook/action bar icon references through the shared spell icon descriptor path.
- Updated Cleric spellbook/action bar icon references through the shared spell icon descriptor path.
- Preserved spell names, levels, costs, cooldowns, targeting, tooltip data, spell behavior, Assassin icons, and non-Bard/non-Cleric icon data.

## V0.16.68 - Party Mercenary Command Buttons Regression Fix

- Fixed missing mercenary/bot command buttons in the in-player Party / Companions HUD.
- Added per-companion Follow, Guard, Assist, Passive, and Attack buttons directly under each controllable unit’s HP/mana bars.
- Wired the visible buttons to the existing mercenary/bot stance command system without duplicating command state.
- Fixed the unified companion HUD row structure/signature so command controls are rendered, highlighted, and refreshed correctly.
- Kept non-controllable party entries free of mercenary command controls.

## V0.16.67 - Party Merc Commands + Action Bar Icon Fill + Bot Naming Fix Pass

- Restored mercenary/bot command controls to the Party / Companions window using the existing companion command owners.
- Added active command highlighting for Follow, Guard, Assist, Passive, and Attack controls.
- Updated action bar spell icon presentation so spell art fills the full slot interior behind the existing labels, cooldowns, and overlays.
- Migrated placeholder bot names such as Fighter Bot into persistent fantasy display names while preserving role/type labels.

## V0.16.66 - Action Bar Layout Refinement Pass

- Expanded action-bar spell icons so they fill the usable interior of each slot while preserving centering, transparency, cooldown overlays, and disabled states.
- Updated the action-bar EXP meter to use a purple gradient fill with a dark purple empty-state gradient.
- Split action-bar status display so buffs anchor to the left of the Meditate button and debuffs anchor to the right.
- Repositioned the Meditate button so it rests on the top edge of the action bar instead of overlapping the EXP bar or spell slots.
- Preserved Auto Attack, spell hotkeys, spell clicking, cooldowns, EXP logic, and meditation behavior.

## V0.16.65 - Assassin Spell Icon Integration Pass

- Integrated the uploaded Assassin spell icon package into the existing spell icon system.
- Added filesystem PNG assets under `assets/spell-icons/assassin/` with the uploaded `manifest.csv` preserved beside them.
- Updated Assassin spellbook and action bar icon resolution through the existing `spellIconDescriptor` / `spellIconHtml` owner.
- Mapped all 20 Assassin level 1-20 spells to their matching icon assets from `Assassin Spell Icons.zip`.
- Preserved Assassin spell names, levels, costs, cooldowns, tooltips, unlock behavior, hotbar mapping, and combat behavior.

## V0.16.64 - Settings Cleanup + Renderer Removal + Sharp Model Rendering Pass

- Cleaned up the player-facing Settings window by removing the subtitle, renderer diagnostics, benchmark/export clutter, and post-release hardening block from normal Settings.
- Removed the legacy 3D Prototype renderer runtime path, script load, renderer mode mapping, and old save restoration route.
- Removed renderer selector buttons from normal Settings while keeping the supported renderer selected internally.
- Made Quality, Balanced, Performance, and Rescue buttons apply runtime preset settings immediately and keep sharp entity rendering enabled.
- Fixed normal gameplay model blur by baking runtime sprite-cache entries at their final draw scale and drawing cached models one-to-one with image smoothing disabled.

## V0.16.63 - Action Bar Regression Fix Pass

- Fixed the action bar performance regression from the recent layout polish pass.
- Corrected Meditate button clipping by removing paint containment from the mounted-button bounds and keeping the button inside the action bar owner.
- Added lightweight Meditate button hover, pressed, active, and disabled states.
- Corrected the Meditate button hitbox/state updates while preserving the existing meditation action and keybind.
- Moved spell cooldown overlays to transform-based updates to avoid layout work during combat.

## V0.16.62 - Death Respawn + Game Menu Cleanup + Camp Stash Chest Pass

- Fixed friendly respawn/recovery health so players, mercenaries, party bots, and supported companion actors return with HP restored to their resolved max HP.
- Cleaned up the Game Menu by removing the subtitle text, embedded Steam Deck controls block, and Bank button.
- Moved storage access out of the menu and into a permanent Dead Lantern camp Stash chest.
- Wired the camp Stash chest to the existing saved Bank/Stash inventory model without creating duplicate storage or a new save format.
- Preserved remaining Game Menu buttons, existing bank persistence, inventory deposit/withdraw behavior, death locations, and unrelated UI/combat systems.

## V0.16.61 - Action Bar Layout Polish Pass

- Repositioned the Meditate button to sit mounted on the top-center of the bottom action bar frame.
- Enlarged the EXP bar and changed its display format to `Exp: current/max` for readability.
- Increased action-slot size and tightened hotbar padding to reduce dead empty space below the spell slots.
- Enlarged hotbar spell icons so they fill their slots more cleanly without replacing any spell art.
- Preserved Auto Attack on key 1, spell slots 2-0, cooldown overlays, click/hover behavior, EXP progression, and meditation behavior.

## V0.16.60 - Character Creation Class Selector Cleanup

- Slightly enlarged the Character Creation class icons.
- Fully removed the visible square option boxes by suppressing the generic button pseudo-frame on class options.
- Kept the selector as icon/name/role only with tighter spacing between the icon and text.
- Preserved icon-click class selection behavior, class IDs, class roles, class icons, class backgrounds, alphabetical order, randomize behavior, and character creation behavior.
- Left main menu, Character Select, gameplay, character stats, action bar, bags, and inventory untouched.

## V0.16.59 - Character Creation Class Selector Icon Cleanup

- Enlarged Character Creation class icons.
- Removed circular rings around class icons.
- Removed visible square class card boxes from the class selector.
- Changed class selection to use icon-focused click targets.
- Preserved class names, role labels, alphabetical order, icons, backgrounds, and class selection behavior.

## V0.16.58 - Character Select and Class Layout Polish

- Expanded the Character Select window to better use the full screen.
- Increased selected character preview prominence in Character Select.
- Enlarged and rebalanced Main Menu floating class icons on both sides of the logo.
- Preserved logo/menu safe zones for floating class icons.
- Sorted Character Creation class cards alphabetically.
- Preserved class icons, roles, backgrounds, and selection behavior.

## V0.16.57 - In-Game UI Performance / Lightweight HUD Revamp

- Revamped the in-game Action Bar into a cleaner lightweight implementation.
- Revamped the Character HUD into a cleaner lightweight implementation.
- Reduced HUD rendering overhead to improve combat responsiveness.
- Preserved hotkeys, slot clicking, Auto Attack, cooldowns, EXP bar, Meditate, and player HUD information.
- Kept the PNG action bar removed from the active runtime HUD path and cleaned up duplicate/hidden HUD draw risk.

## V0.16.56 - Main Menu Floating Class Icon Safe-Zone Pass

- Fixed floating class icon safe-zone ownership so Bard no longer overlaps or touches the main logo.
- Moved Enchanter out of the menu-button column and added protected menu-button bounds for all floating class icons.
- Added viewport-relative logo, menu-button, and modal safe zones for main menu class icon movement.
- Added icon-to-icon spacing/collision resolution so floating class icons avoid touching or overlapping each other.
- Preserved main menu rain, fog, static logo, button behavior, modal interactivity, and gameplay rendering.

## V0.16.55 - Action Bar UI Asset Cleanup and Overlay Pass

- Cleaned and verified the provided `Action Bar UI` asset so transparent regions use real alpha instead of checkerboard, white matte, black matte, or residual box edges.
- Kept the `Action Bar UI` PNG as the real action bar frame while preserving live runtime overlays for EXP, hotkeys, spell icons, labels, cooldowns, Auto Attack state, and Meditate.
- Corrected the asset-backed action bar scale so it remains bottom-centered and readable without dominating the gameplay HUD.
- Recalibrated overlay alignment for the EXP fill/text, ten slot frames, spell icons, label/cost text, cooldown/active outlines, and Meditate button.
- Preserved existing action bar gameplay behavior, click hitboxes, keyboard bindings, cooldown logic, Auto Attack, and Meditate behavior without adding duplicate action bar systems.

## V0.16.54 - Main Menu Weather Cleanup and Fog Polish

- Removed black diagonal stripe artifacts from the main menu weather layer by disabling the rain curtain pass in the menu-safe renderer and removing static diagonal shadow bands from the menu backdrop.
- Made the main menu logo static by removing the unintended hero/logo breath animation while preserving logo brightness and readability.
- Added subtle weather-style fog beneath the logo through the shared weather fog drawing helper.
- Added a low fog layer near the bottom of the main menu under the Exit button area.
- Preserved main menu rain, floating class icons, button behavior, modal window interactivity, and in-game weather behavior.

## V0.16.53 - Action Bar UI Asset Integration Pass

- Replaced the old procedural action bar shell with the canonical `Action Bar UI` PNG asset while keeping the asset referenced by its stable game-facing name.
- Preserved live runtime overlays for EXP, spell slots, hotkeys, spell icons, mana/cost text, cooldown state, and Auto Attack state.
- Aligned action slot hitboxes, EXP fill, cooldown overlays, and Meditate button interaction to the visible PNG frame.
- Kept existing hotkey, click, Auto Attack, spell-cast, cooldown, and Meditate behavior intact without adding a duplicate action bar system.

## V0.16.52 - Main Menu Rain Weather Pass

- Added animated rain to the Blackroot main menu using the existing weather-system rain drawing primitive.
- Integrated rain into the main-menu render layering so the logo, floating class icons, menu buttons, and modal windows remain readable and interactive.
- Kept the rain canvas non-interactive and menu-local so Login, Create Account, Load Game, Patch Notes, Settings, Link Save Folder, and Exit Game continue using the existing menu routing.
- Preserved in-game weather behavior while sharing the same rain particle/streak visual language for main-menu ambience.

## V0.16.51 - In-Game UI Correction Pass

- Reduced the oversized Character HUD and repaired class icon rendering so the correct class crest displays without distortion.
- Reduced the Bag window and item card scale to a practical gameplay size while preserving direct item info and hover tooltips.
- Rebuilt the Action Bar closer to the provided ornate Blackroot reference with integrated EXP bar, Meditate button, purple cooldown outlines, and Auto Attack active outline.
- Cleaned up the Character Stats window so all equipment, stats, and set bonus information fits inside the window without repeated class-icon header artifacts.
- Added a class-themed icon/background treatment behind the Character Stats model viewport while preserving full character visibility.

## V0.16.50 - In-Game UI Scale Correction Pass

- Reduced the oversized Bag window layout while preserving the new Blackroot item-card styling and hover tooltips.
- Reduced Bag slot/card sizing so inventory no longer dominates the gameplay screen.
- Reduced the oversized Action Bar layout while preserving the ornate Blackroot frame, XP bar, spell icons, cooldown outlines, and keybind behavior.
- Resized the Meditate button and action slots to better fit the gameplay HUD.
- Fixed the scale/layout values inside the owning Bag and Action Bar UI systems without adding duplicate overlays or patch-cascade fixes.

## V0.16.49 - Character HUD Revamp

- Redesigned the in-game Character HUD into a wider ornate dark-fantasy frame with blackstone surfaces, gold trim, purple arcane accents, and decorative gem details.
- Enlarged the dynamic class icon into a prominent left-side medallion so the player class visually anchors the HUD.
- Rebuilt the name and level/gender/class hierarchy for cleaner readability while preserving live player data binding.
- Restyled HP and Mana as larger red and blue premium bars with readable numeric values and gem sockets.
- Preserved existing HUD refresh behavior, player resource updates, status tray ownership, and companion HUD attachment without touching unrelated UI systems.

## V0.16.48 - UI Cleanup and Action Bar Revamp

- Cleaned up the Character Stats window fit so the ornate sheet content stays inside the window bounds.
- Reframed the Character Stats model viewport to keep the full equipped character model visible with less awkward cropping.
- Expanded bag item slot cards so visible bag items show rarity, class restriction, and key stat summaries directly on the card while preserving full hover tooltips.
- Revamped the action bar into a larger premium dark-fantasy layout with gold trim, integrated XP meter, uniform 1-0 slots, and a centered Meditate button.
- Added purple cooldown highlighting for spell slots and purple active highlighting for Auto Attack.

## V0.16.47 - Character Stats Window Mockup Revamp

- Revamped the Character Stats window toward the ornate Blackroot mockup style with a larger dark fantasy frame, gold trim, decorative borders, and stronger header hierarchy.
- Rebuilt the Character Model section with equipment slots arranged around a larger full-body model viewport and added an arcane stage/pedestal backdrop while preserving all equipment slot data.
- Improved character model scaling and anchoring so the full equipped character fills the viewport better without awkward cropping.
- Reworked the Character Stats section into icon-backed two-column stat cards while preserving all existing stat values, gear score, status text, and set bonus behavior.
- Restyled the close control as a larger ornate X button inside the existing character-window owner without adding duplicate overlays or patch-cascade code.

## V0.16.46 - Main Menu, Character Preview, and Bot Party Roaming Polish

- Brightened the Darkroot main-menu logo presentation and reduced the purple haze/tint so the hero art reads more clearly while preserving the dark gothic theme.
- Moved the main-menu button stack lower to reveal more of the logo and increased floating class-icon drift speed/motion from the existing sigil owner.
- Reframed the Character Stats paper-doll model viewport with larger measured layout bounds and safer scaling/origin math so the full equipped model is visible and better fills the panel.
- Reduced autonomous bot-party size and added party-level route/objective distribution so bots split into smaller roaming groups instead of stacking into one swarm.

## V0.16.45 - Character HUD, Stats Window, and Bag Bar Polish

- Cleaned up the Character Stats window layout while preserving all currently displayed equipment, identity, gear-score, stat, status, and set-bonus information.
- Reframed the Character Model viewport and adjusted paper-doll preview scaling so the full equipped model stays visible instead of cropping awkwardly.
- Improved Character HUD spacing and enlarged the class emblem presentation so the icon anchors the HUD cleanly without making the HUD oversized.
- Slightly enlarged and cleaned up the Bag Bar slots, restored stronger icon presence, and added spacing from the Menu button in the bottom-right UI cluster.

## V0.16.44 - Main Menu Auth Button Regression Fix

- Fixed the main-menu login modal regression where Login, Cancel, and Load Game JSON buttons could become unresponsive after the Character Creation full-layout conversion.
- Repaired the Character Creation summary renderer so missing appearance-label locals no longer throw during UI boot.
- Preserved the existing main-menu/auth/save-picker routing and fixed the root boot interruption instead of adding duplicate click handlers or overlay hotfixes.

## V0.16.43 - Character Creation Full Layout Conversion

- Converted the Character Creation screen to the expanded full-screen framed presentation shown in the target reference.
- Enlarged the central character preview into the dominant showcase panel and removed the narrow inner preview cap.
- Scaled the live character model from the larger preview rectangle so it fills the showcase better while staying fully visible.
- Expanded and framed the left customization panel and right class panel for clearer full-height presentation.
- Enlarged class cards, class emblems, and class labels while preserving class selection and selected-state highlighting.
- Aligned the bottom controls into a cleaner full-width creator strip with Back, Randomize, and Create Character buttons.
- Removed low-value preview metadata from the model area while keeping concise character identity text under the name field.

## V0.16.42 - Character Creation Layout Expansion and Pet Preview Fix

- Expanded the active Character Creation `.cc-*` layout so the modal uses more viewport width and height while preserving the left customization panel, center preview showcase, right class panel, and bottom actions.
- Enlarged the center character preview panel and removed the narrow preview width cap so the class background and model fill the available center stage more cleanly.
- Updated the creator preview renderer to scale from the preview rect and reserve companion space only for pet classes.
- Added Necromancer Bone Servant and Summoner Azure Shard Familiar preview models beside the player model by reusing the existing `PetIdentityProceduralModel` renderer.
- Kept pet preview animation limited to the existing character-creation idle preview loop; no gameplay pet behavior, spells, combat, or class data were changed.
- Cleaned creator preview metadata so useful name/race/class/gender/appearance/companion text remains without exposing raw color hex values.

## V0.16.41 - In-Game UI Root Fix and Revamp Pass

- Fixed action bar spell icon scaling so Necromancer and other class spell icons fit correctly inside action slots.
- Repaired bag bar anchoring so it sits between the bottom-center action bar and bottom-right Menu button.
- Restored bag icon rendering in the bag bar.
- Fixed bag window item slot sizing and restored item hover tooltips.
- Revamped the action bar and player HUD to better match the current Blackroot UI theme while preserving existing gameplay behavior.
- Fixed bot/NPC right-click context menu visibility and z-order issues.
- Reviewed the in-game UI layout, tooltip, input, and theme ownership systems to remove regressions without cascade patches.

## V0.16.40 - UI Theme Conversion Pass

- **Root cause**: the game already had one canonical, comprehensive "Pass 51" theme block (~830 lines, intentionally the last CSS in the file so it owns the final look) that already themes nearly every shared in-game system - `.panel`, `button`, `.windowHeader`, `.bar`/`.fill`, `#hud`, `#hotbar`, `.slot`, `.equipSlot`/`.itemSlot`/`.bagSlot`, `#characterPanel`/`#bagPanel`/`#spellPanel`/`#settingsPanel`/`#menuPanel`/etc, `.logTab`, `#menuToggleBtn`, `.patchNotesButton` - mostly gold-trimmed and dark already. The actual defect was that this block's `--accent` token and several hardcoded colors inside the same block were still teal/green (`#6fd7c8` and various `rgba(127,223,205,...)` values), and `--panel`/`--panel2`/the body background/a few component backgrounds still carried a leftover green-black tint. A separate `--br-*` token set added in V0.16.39 for Character Creation only was also a second, disconnected theme effort running alongside this canonical one.
- **In-game UI theme unification**: fixed at the root instead of layering more overrides - edited Pass 51's own `:root` tokens (`--accent` teal → violet) and every hardcoded teal/green occurrence inside that same block (`button`/`button:hover`, `.logTab.active`, `#minimapWrap`, `#menuToggleBtn`, `.panel`, `.slot`, `#hotbar`, the shared equip/bag-slot background, the shared `#characterPanel`-and-friends background, `.patchNotesButton`) to violet/navy. This single, targeted edit cascades the same dark-navy/deep-violet, gold-trimmed look across the HUD, action bar, bag bar, chat, minimap, bags, bank, trade, spells, settings, skills, and the Character/Stats window all at once, since those systems already read from these shared tokens/rules - no duplicate theme system was added.
- **Character Select — complete redesign**: replaced the four-equal-plain-card grid with a large "featured slot" showcase: a big live-animated character model, that class's own full illustrated background art as a themed motif behind it, clean name/race/class/level/gender/hair/saved-date info, and Play/New/Delete (or Create, for an empty slot) actions - with a compact slot-switcher strip below to pick which of the (up to 4) slots is featured. The featured preview reuses the exact same canvas renderer (`renderRaceClassPreview`/`renderClassPreviewModel`) and the exact same per-class illustrated backdrop art (`assets/ui/class-backgrounds/*.png`, 14 files) and drawing helper (`drawCreatorClassEmblemBackdrop`) the character creator already uses via `creatorBackdrop:true` - both existed already but the backdrop art had never been reused anywhere outside the creator. The idle-animation loop (`startCharacterSlotPreviewAnimation`/`stopCharacterSlotPreviewAnimation`) mirrors the character creator's existing self-terminating animation loop exactly. All existing slot/account/save behavior - Play, New, Delete, Create, Load Game, Link Save Folder, Account Menu, Close - is unchanged; only the presentation and which buttons host that behavior changed.
- Removed now-dead CSS from the prior Character Select card layout (`.characterSlotCard`, `.characterSlotCardTop`, `.characterSlotPreview`, `.characterSlotPreviewCanvas`, `.characterSlotInfo`, `.characterSlotName`, `.characterSlotMeta`, `.characterSlotActions`) since this same phase's redesign is what made them dead.
- Verified via automated browser testing: create account and login both reach the redesigned Character Select; creating two characters (different classes) and switching the featured slot correctly re-renders each one's own class-themed backdrop and highlights the active switcher tile; Play/New/Delete all work from the featured stage; the idle-animation loop is confirmed running while the screen is visible and confirmed stopped (no leaked `requestAnimationFrame`) after leaving it; the Character/Stats window remains crop-free and non-scrolling at 1400x900 and 1280x800; Randomize still preserves the selected class; zero console/page errors throughout.
- `node --check` on every `.js` file and `python3 -m json.tool` on every `.json` file both pass with no errors.

## V0.16.39 - UI Theme Conversion Pass

- **Shared theme tokens**: added a set of `--br-*` CSS custom properties (`--br-gold`, `--br-gold-bright`, `--br-iron-border`, `--br-violet-glow`, `--br-bg-deep`, `--br-text`, `--br-muted`, `--br-heading-font`) at `:root`, pulled directly from the colors/fonts the main menu and its Login/Create Account/Patch Notes modals already established (gold button fill, iron-bronze border, violet glow, serif heading font), so every window re-themed to match the main menu now draws from one shared palette instead of each screen inventing its own gold. The existing green `--panel`/`--panel2`/`--line`/`--text`/`--muted` tokens were left untouched, since they still drive the in-game HUD/bags/chat and are intentionally outside this menu-family theme.
- **Character Creation**: fully converted from the green Dream-Realms palette to the `--br-*` gothic theme - gold corner ornaments and border frame on `#classModal`, gold serif "BLACKROOT / FORGE YOUR LEGEND" header, gold uppercase section headings, gold-bordered controls throughout, and a circular gold-ringed class-icon layout (icon on top, name and role below) in place of the old square icon-and-text row. Also fixed several controls (`.cc-gender-button`, `.cc-hair-arrow`, `.cc-hair-thumb`) that had no background of their own and were silently inheriting the page's global gameplay `button {}` olive-green style; gave each an explicit gothic background instead of changing that global rule (which still serves in-game HUD buttons). Removed a second, later-in-source `#classScreen`/`#classModal` override left over from an earlier redesign attempt that was fighting the new theme via the CSS cascade. Layout/structure is unchanged - only colors, borders, and fonts changed.
- **Character / Stats window**: re-themed to the same `--br-*` gothic palette (gold headings, iron borders, violet glow, gold Close button) and fixed the root cause of the cropped character-model preview with dead space beneath it. `.paperDollLayout` used CSS Grid's `align-items: start`, which sizes each grid column to its own content height instead of stretching every column to match the row's tallest member; `.dollCenter`'s only height came from a `min-height: 280px` floor, so it never grew to match the ~500-600px-tall gear-slot columns beside it. The model renderer (`renderPaperDollClassModel`) reads the container's real measured box and has a scale floor of roughly 2.95x, so cramming that render into a ~260px-tall box cropped the head while the taller `.dollCenter` wrapper around it showed as dead space below. Removing the `align-items: start` (grid rows default to stretch) let the preview column grow to the row's real height - the model canvas grew from about 190x260 to 240x525, the full body is now visible with no crop, and both the Character Model and Character Stats panels fit on screen with zero scrolling at both 1400x900 and 1280x800.
- Converting the shared `.characterSheet`/`.sheetPanel`/`.statCard`/`.setBonusBox`/etc. CSS system also moves the bot-inspector, trade, and mercenary-hiring windows (which reuse the same classes) toward the same theme as a side effect of fixing it once at the shared root, rather than restyling each window individually.
- Verified login, create account, character creation (class selection, race change, randomize-preserves-class), and gameplay entry all remain regression-free, with zero console/page errors throughout.

## V0.16.38 - UI Layout Regression Repair Pass

- **Action bar**: fixed the ability/action bar rendering as a tall vertical stack (~540px tall, mid-screen) instead of a horizontal bar at bottom-center. Root cause: `.abilitySlots` (the actual wrapper of ability slots 1-0) had no CSS anywhere in the stylesheet, so its 10 slot `<div>`s fell back to default block layout and stacked one per line; `#hotbar` itself had no `flex-direction`, defaulting to `row` when its status-tray/XP-bar/ability-row/meditate-button children needed to stack as bands instead. Added `.abilitySlots { display:flex; flex-direction:row; }`, made `#hotbar` a column flexbox, and gave `.actionXpMeter` the structural sizing (`position:relative; height; border`) it was missing. Slots 1-0 now lay out left-to-right at the bottom-center anchor, which was already correctly positioned.
- **Bag bar**: fixed `#bagDock` (the compact always-on bag-icon dock) rendering near the top-left under the player HUD instead of its bottom-right dock. It had zero CSS at all, so it rendered as a plain static block in normal document flow. Anchored it as a fixed bottom-right dock, gave `#bagBar`'s grid fixed-width compact columns instead of unbounded `1fr` stretching, and repositioned it to stack above the Menu button (rather than beside it) so its always-6-slots width can never overlap the action bar. Removed a redundant duplicate "Menu" button (`#bagDockMenuBtn`) that called the exact same `toggleMenu()` as the existing `#menuToggleBtn` and was eating into that same limited space.
- **Character Window**: restored the original paper-doll (left/right gear columns flanking a centered model) plus stats-grid layout, replacing the tall vertical equipment-slot stack it had regressed to. Root cause: the character-sheet CSS system (`.characterSheet`, `.paperDollLayout`, `.equipColumn`, `.dollCenter`, `.statHeader`, `.statGrid`, `.statCard`, `.setBonusBox`, ...) - shared by the player Character Window, the bot inspector, the merc hiring panel, and the trade window - existed only as compact per-context overrides scoped to the debug bot-inspector panel (`#botInspectPanel .sheetPanel` etc.); the base rules those overrides were meant to sit on top of were never written. `#characterPanel` was also capped at the same 360px width shared with the much simpler Settings/Spells/Menu list panels, leaving no room for a two-column layout regardless. Added the missing shared base CSS (fixing this for every window that uses it, not just the Character Window) and gave `#characterPanel` its own large, centered sizing.
- **Character Select**: reworked from the original green Dream-Realms panel palette to the dark gothic Blackroot language already used by the main menu and its Login/Create Account/Patch Notes modals (blackened-metal panel, iron/bronze borders, violet accent glow, serif uppercase buttons). Added a live character-model preview (reusing the existing class/race preview renderer) to each occupied slot card, next to its name/level/race/class/saved-date summary.
- Verified login, create account, character creation, randomize-preserves-class, and gameplay entry all remain regression-free, and confirmed via measured element bounding boxes that the HUD, minimap, chat, action bar, bag bar, and menu button no longer overlap at a standard desktop viewport.

## V0.16.37 - Logo Visibility and Stability Bug Fix Pass

- Improved main-menu logo visibility: softened the black vignette gradient painted directly over the logo artwork (it was crushing the stone lettering and tree/root sigil toward black), strengthened the silver highlight and violet rim-light gradients that sit on top of the same artwork layer, and raised filter contrast/brightness slightly further - all within the single existing `#logoSplash::before` layer, so there is still exactly one logo layer. Kept the dark gothic tone; nothing was overexposed or made neon.
- Removed a fully dead, superseded copy of `#logoSplash`/`#logoSplash::before`/`#logoSplash::after` (plus two keyframes used only by it) that predated the current canonical main-menu presentation. Same ID selectors, so the later declaration always won the CSS cascade and this block never actually rendered - but it still carried the old green Dream-Realms-style menu colors, which was a needless revert risk sitting in the stylesheet.
- Fixed a real, verified bug in the main-menu modal system: opening **Patch Notes** or **Settings** had no way to close. Neither panel had its own close button, Escape wasn't wired up for them, clicking outside the panel was intentionally blocked without closing it, and the only "close" path (clicking the original toggle button again) was unreachable because the open panel visually covered that button. Fixed at the root by adding a `closeModal` case to the existing canonical `runMainMenuAction` dispatcher and a themed Close button to both panels - no new input handler, no overlay, no timeout hack.
- Removed an ~500-line unreachable legacy character-body renderer (`drawStandingBodyLegacy` in `render/entity-renderer.js`) that had been fully superseded by the current `drawStandingBody`/`standingHumanoidContext` pipeline and had zero call sites anywhere in the project.
- Reviewed the full codebase for duplicate render loops, duplicate event listeners, stale canvas alpha/filter/composite state, switch fallthrough, and duplicate class-model rendering (Ranger bow, Shaman, Wizard, Paladin, and the rest of the 14-class roster); confirmed the render dispatch is a single mutually-exclusive chain with no double-draws, verified in-game across all 14 classes. Spot-checked class/race/item/spell/NPC/quest data for duplicate or missing IDs; no real collisions found.
- Verified login, create account, character creation, randomize-preserves-class, and gameplay entry all remain regression-free after the above changes.

## V0.16.36 - Character Creation Layout Restoration

- Fixed the broken character creation screen that appeared after login/account creation: raw unstyled `<select>`/`<input>` controls, a malformed tiny header, a massively oversized/cropped character model, and a missing class selection panel.
- Root cause: the character-creation screen's markup had been rebuilt around a new `.cc-*` class structure (left customization panel, center preview stage, right class gallery, bottom action bar), but almost none of the CSS for those classes was ever written. The screen fell back to raw, unstyled block layout instead of a redesigned raw fallback - there was only ever one renderer, it was just missing its stylesheet:
  - `.cc-main` had no grid/flex layout, so the left/center/right panels stacked as full-width blocks instead of sitting side by side, pushing the class panel and action bar thousands of pixels below the fold.
  - `.cc-native-fields` (the hidden data-model inputs that the themed race/gender/hair/color controls write through to) was only `aria-hidden`, never `display:none`, so raw browser controls were visible alongside the themed ones.
  - Small thumbnail/preview `<canvas>` elements (hairstyle thumbnails, the character model preview) had no explicit CSS size of their own in several places, so they inherited the page's global `canvas { width:100vw; height:100vh }` rule and ballooned into huge boxes.
  - The class-emblem watermark image (`.creatorClassEmblemBackdrop`) had no positioning or opacity, so it painted as an opaque, full-size cover directly over the actual character model canvas instead of a subtle backdrop behind it.
  - `.classIconOption` and its icon/label sub-elements (the 14-class selection gallery) had zero CSS, and `#classGrid`'s grid was hardcoded to an older 8-slot (2x4) layout that no longer fit the current 14-class roster.
  - `#raceGrid` still carried a stale 4-row grid/height rule sized for an older race-card layout, fighting the current single dropdown + description content it actually holds.
- Added the missing layout CSS for `.cc-main`/`.cc-panel`/`.cc-left-panel`/`.cc-right-panel`/`.cc-center-stage`/`.cc-title`/`.cc-bottom-bar` so the screen renders as a proper three-column themed layout that fits the viewport, with a responsive fallback that stacks the panels into one scrollable column on small windows.
- Added styling for the race select, gender toggle, hairstyle thumbnails, and hair/eye/skin color swatches so all customization controls read as themed game UI instead of raw browser defaults; hid the native fallback data-model inputs.
- Fixed the character preview to render as a large, centered, correctly scaled model with a properly layered (non-covering) class-emblem backdrop, by giving its container a real bounded size instead of a fixed 112x136 compact-widget footprint.
- Restored the class selection gallery (`.classIconOption`) with visible icons, readable class name/role text, a scrollable grid that fits all 14 classes, and working selection/highlight.
- Verified with an automated browser pass at multiple viewport sizes: race/gender/hair/color selection, class selection, Randomize (confirmed it does not change the selected class), Back, and Create Character all work, and character creation still correctly hands off into gameplay with no regression to the V0.16.35 auth-to-screen routing fix.

## V0.16.35 - Auth-to-Game Blank Screen Root Fix

- Fixed the critical blank-screen regression after both Login and Create Account by repairing the shared post-auth screen transition flow.
- Root cause: `#characterSlotScreen` (the shared destination for both Login and Create Account) had markup and JS visibility toggling but no `position`/`z-index` CSS rule of its own, unlike its sibling screens `#logoSplash` and `#classScreen`. Left at the browser default `position: static`, it collapsed into normal document flow behind the fullscreen `#game` canvas and was clipped by the page's `overflow: hidden`, producing a dark/blank screen even though the character-select screen was technically "shown".
- Added the missing fixed-overlay CSS for `#characterSlotScreen` plus layout styling for `#characterSlotModal`, `.characterSlotGrid`, and `.characterSlotCard` (none of which had ever been styled), so the character-select screen now renders correctly above the canvas after both Login and Create Account.
- Fixed a related crash in `cleanupPartyForSessionEnd` / `clearLocalPartyRuntimeState` (`systems/party-system.js`) where `this.player?.targetId === this.merc?.id` evaluated `undefined === undefined` as true when no character was loaded yet, then unconditionally wrote to `this.player.targetId` on a null player - this could abort the "back to account menu" transition and leave the login screen hidden.
- Verified with an automated browser pass: Create Account -> character select -> character creation -> gameplay, and Login -> character select -> load existing character -> gameplay, both render the world, HUD, and minimap correctly with no stale menu/modal overlay.
- No changes to menu visuals, logo, buttons, or floating class icons; the main render loop, canvas reset, and gameplay boot sequence were already correct and were not touched.

## V0.16.34 - Main Menu Visual Polish
- Removed the circular bubble/ring backdrops from the floating class icons so only the class emblems drift across the main menu.
- Preserved floating class-icon motion while cleaning up the background presentation.
- Improved Blackroot logo contrast and visual separation so the logo stands out more clearly from the background.
- Polished the main menu presentation while preserving the dark gothic MMORPG theme.

## V0.16.33 - Create Account Modal State Fix

- Fixed the Create Account main-menu regression where clicking the button could leave the game on a blank dark screen with no usable modal.
- Reworked main-menu modal ownership so Login, Create Account, Patch Notes, and Settings use one canonical modal state path instead of conflicting screen/display states.
- Ensured Create Account opens as a centered modal over the visible Blackroot main-menu background with usable Account Name and Password / Local PIN fields.
- Corrected modal backdrop/class synchronization so the dim layer only appears while a real modal is open and never hides the menu by itself.
- Hardened main-menu input routing so active modals receive priority, Cancel returns to the menu, and background buttons cannot steal clicks while a modal is open.

## V0.16.32 - Main Menu Layer Fix, Floating Class Icon Restore, and Gameplay Render Repair

- Removed the incorrect top foreground menu logo layer and kept the lower integrated background logo as the main Blackroot branding element.
- Fixed the floating menu ambience so the actual class icons now render inside the drifting glowing circles instead of showing empty orbs.
- Repaired post-login game transition/render ownership so entering the game no longer results in a blank screen and the world becomes visible again.
- Cleaned up main-menu render layering to ensure background logo, floating class icons, and foreground UI render in the correct order.

## V0.16.31 - Post-Login Render Fix and Main Menu Background/Icon Restore

- Fixed the post-login black screen by repairing the canonical transition from the main menu into gameplay and restoring proper world rendering after login.
- Ensured gameplay no longer inherits stale menu overlay, blur, alpha, or composite state that could hide the world after entering the game.
- Restored and brightened the floating class icons on the main menu with stronger visibility and smoother drifting motion.
- Reworked the main menu presentation so the supplied dark gothic Blackroot logo artwork functions as the primary hero/background composition, with class icons layered above the background ambience.
- Preserved working main-menu interactions for Login, Create Account, Load Game, Link Save Folder, Patch Notes, Settings, and Exit Game.

## V0.16.30 - Gothic Main Menu Redesign and Modal Fix

- Fixed main-menu modal rendering so Login, Create Account, and other popup windows are no longer blurred, covered, or unusable.
- Repaired modal stacking/input routing by moving active menu modals above the backdrop and keeping modal controls out of the menu card's lower stacking context.
- Removed the previous rounded-button grid presentation and replaced it with a darker gothic Blackroot menu direction based on the supplied logo/menu references.
- Updated the main menu to use the supplied game logo asset directly as the canonical main-menu logo.
- Reworked the menu into a central vertical gothic panel with thorn-metal framing, violet accents, and readable stacked action buttons.
- Improved floating class icon ambience so icons remain visible and animated without interfering with the main menu or modals.

## V0.16.29 - Main Menu Freeze Fix and Blackroot Logo Pass

- Fixed the main-menu button freeze by repairing the canonical menu action/state flow instead of layering a wrapper workaround.
- Removed the cluttered/weird embedded button icons and restored cleaner rounded fantasy button styling.
- Increased floating class icon visibility and added smoother drifting background motion so the class emblems are now clearly visible and animated.
- Replaced the generic Blackroot logo direction with a darker root-tree/sigil fantasy logo treatment based on the supplied dark logo, adapted to the final game title `Blackroot`.
- Preserved centered menu modals and main-menu functionality for Login, Create Account, Load Game, Link Save Folder, Patch Notes, Settings, and Exit Game.

# Blackroot V0.16.28 - Main Menu Logo, Buttons, and Modal Fix

## V0.16.28 - Blackroot Main Menu Logo, Buttons, and Modal Fix

- Replaced the generic Blackroot logo treatment with a darker, more detailed Blackroot logo direction inspired by the approved dark root/sigil reference while keeping the title text as `Blackroot`.
- Increased floating class icon visibility in the main-menu background with stronger opacity, glow, and contrast while keeping them behind the menu UI and non-interactive.
- Replaced circular menu buttons with rounded fantasy buttons using a cleaner rounded-rectangle/capsule presentation.
- Rebuilt main-menu button layout and hitboxes so the rounded buttons remain readable and clickable.
- Fixed main-menu popup windows so Login, Create Account, and other menu modals render centered above the menu UI instead of being covered by the panel.
- Updated modal input routing so popup fields can be clicked and typed into correctly.

## V0.16.27 - Dark Logo and Circular Main Menu Buttons

- Replaced the brighter Blackroot logo treatment with a darker custom dark-fantasy wordmark using blackened iron, obsidian, tarnished metal, restrained emerald glow, thorned rootwork, and cursed woodland rune motifs.
- Reworked the logo silhouette to feel less generic and more Blackroot-specific, with root tendrils, thorn crown elements, darker bevels, and artifact-like crest framing.
- Rebuilt the main-menu action buttons as circular fantasy medallions instead of rectangular buttons.
- Updated the canonical splash button layout so the circular buttons, labels, and native click targets share the same visible menu layout.
- Preserved all main-menu actions, floating class-icon ambience, account-gate behavior, and Blackroot menu background presentation.

## V0.16.26 - Floating Class Icon Main Menu Background

- Added ambient floating class icons to the Blackroot main-menu background using the existing class emblem data and assets.
- Included all current class emblems as subtle drifting magical sigils behind the menu panel, logo, and buttons.
- Added slow drift, fade, scale pulse, depth layering, and shimmer behavior while keeping the icons non-interactive and behind the canonical main-menu UI.
- Integrated the class icon ambience into the owning Blackroot main-menu sync/background presentation path instead of adding a duplicate overlay.
- Preserved main-menu button routing, auth-gate behavior, login/create-account screens, save loading, settings, patch notes, and exit behavior.

## V0.16.25 - Blackroot Logo Redesign

- Replaced the simple Blackroot main-menu logo with a much more detailed original dark-fantasy logo treatment.
- Redesigned the Blackroot wordmark with stronger custom styling, root/vine motifs, and a more unique premium silhouette.
- Added richer ornamental detail including dark-fantasy metalwork, arcane accents, rune framing, root filigree, gemstone highlights, and crafted worn-metal accents.
- Improved logo lighting and magical presentation with deeper emerald/teal energy, restrained animated shimmer, rune pulse, and atmospheric motes.
- Preserved main-menu layout, button routing, and account-gate behavior while upgrading the logo to better define the Blackroot brand.

# Blackroot V0.16.24 - Blackroot Main Menu Integration Fix

## V0.16.24 - Blackroot Main Menu Integration Fix

- Fixed the failed Blackroot main-menu rebrand integration so the canonical main-menu splash now owns the Blackroot presentation instead of falling back to the old Dream Realms menu path.
- Removed stale Dream Realms logo/menu elements from the visible main-menu state and normalized the splash DOM to Blackroot branding at initialization.
- Restored all main-menu button functionality for Login, Create Account, Load Game, Link Save Folder, Patch Notes, Settings, and Exit Game through a single delegated action dispatcher.
- Rebuilt main-menu button routing so the visible DOM buttons, native hitboxes, and action IDs share one source of truth.
- Preserved the auth gate: empty-space clicks on the main menu do nothing and cannot enter gameplay.
- Cleaned up duplicate/disconnected splash button listeners so old and new menu routing cannot drift apart.

# Blackroot V0.16.23 - Blackroot Main Menu Rebrand

## V0.16.23 - Blackroot Main Menu Rebrand

- Rebranded the main menu from Dream Realms to Blackroot with a new original dark fantasy logo direction.
- Replaced the old main-menu visual presentation with a Blackroot-themed forest, roots, ruins, teal magic, and premium fantasy UI styling.
- Revamped the central menu panel with darker ornate framing, root/vine accents, teal glow, and improved visual hierarchy.
- Reworked main-menu buttons with larger premium fantasy styling, clearer labels, and icon-supported actions.
- Added subtle atmospheric menu animation such as mist, magical particles, rune glow, and logo/panel shimmer.
- Preserved existing main-menu functionality including Login, Create Account, Load Game, Link Save Folder, Patch Notes, Settings, and Exit Game.

### Implementation Notes

- Replaced the old splash-logo image path on the main menu with a Blackroot-owned procedural/vector logo treatment rather than drawing a second logo over the old menu.
- Rebuilt the main splash background and menu card in the existing splash/menu DOM and CSS, preserving the account/auth gate and existing button IDs/event handlers.
- Kept legacy Dream Realms save compatibility language where needed while changing visible main-menu branding to Blackroot.

# Dream Realms V0.16.23 - High-Poly Wizard Model Graphical Upgrade Pass

## V0.16.23 - High-Poly Wizard Model Graphical Upgrade Pass

- Upgraded the Wizard class renderer into a higher-detail scholarly arcane caster while preserving the existing caster silhouette, proportions, coordinate space, and orientation.
- Replaced the old charm/enchanter-style Wizard read with Wizard-owned layered robes, pointed hat, spectacles, celestial embroidery, high collar, mantle, sash, and robe hem detailing.
- Added Wizard-specific arcane props including a grand staff with crystal cage, floating grimoire, floating quill, book chain, elemental fire/frost/arcane orbs, scroll case, component pouch, mana vial, keys, and runic trim.
- Added Wizard-specific magical readability with arcane casting hand effects, elemental orbit accents, robe star glyphs, celestial motifs, and staff-crystal pulse effects.
- Updated the lightweight 3D fallback class visual for Wizard to use a staff, floating grimoire, elemental orbs, spectacles, and robe trim instead of the generic floating orb identity.

# Dream Realms V0.16.22 - High-Poly Assassin Model Graphical Upgrade Pass

## V0.16.22 - High-Poly Assassin Model Graphical Upgrade Pass

- Upgraded the Assassin class renderer into a higher-detail crossbow executioner while preserving the existing slim silhouette, proportions, coordinate space, and orientation.
- Replaced the inherited dual-dagger primary read with an Assassin-owned compact crossbow presentation, including dark wood stock, blackened steel prod, waxed string, loaded bolt, brass scope, and liquid-shadow vial detail.
- Added Assassin-specific hood, mask, folded targeting monocle, asymmetric shoulder cape, matte leather cuirass ribbing, cross-body harness, knife bandolier, poison vials, gas globes, trap gear, grappling hook, boot blades, and execution mark detailing.
- Added Assassin-specific posture and combat-readability accents so the preview and runtime model read as a ranged executioner instead of a melee Rogue variant.
- Updated the lightweight 3D fallback class visual for Assassin to use a crossbow identity instead of daggers.

# Dream Realms V0.16.21 - Class Background FX Cleanup and Theme Pass

## V0.16.21 - Class Background FX Cleanup and Theme Pass

- Removed the incorrect horizontal line effects from Fighter, Ranger, Bard, Shaman, Druid, and Enchanter character preview backgrounds.
- Replaced the line-based background animation on those classes with themed particles and class-appropriate symbol effects.
- Added stronger class-specific background identity for Fighter, Ranger, Bard, Shaman, Druid, and Enchanter using particles, runes, and thematic ambient motion.
- Cleaned up class preview presentation so affected class backgrounds feel more polished, magical, and readable without distracting line artifacts.

### Implementation Notes

- Updated the class-theme configuration so affected classes no longer select the old horizontal ambient line fields.
- Added dedicated symbol motifs for the affected classes: crossed blades, arrow/leaf marks, musical glyphs, storm totems, moon-leaf nature glyphs, and charm-eye illusion sigils.
- Added non-line particle variants for steel embers, spirit motes, seed glow, and charm motes so the animation remains active without cheap stripe artifacts.
- Kept the FX inside the existing character preview background renderer; no duplicate overlay, timer, or cascade patch was added.

## V0.16.20 - Class Gallery Collision and Spacing Fix

- Fixed character creation class gallery layout so upper and middle class rows no longer overlap.
- Rebuilt class entry spacing around the full icon, halo, class name, role text, and padding footprint.
- Standardized class option layout so all class rows use consistent clean spacing from top to bottom.
- Updated class name and role placement to derive from icon bounds instead of fragile fixed offsets.
- Corrected class selection hitboxes so they match the visible non-overlapping class entry layout.

### Implementation Notes

- Removed the inherited explicit `#classGrid` row templates from the active `.cc-class-list` path by resetting `grid-template-rows` in the owning gallery rule.
- Replaced the fragile `icon + small constant` row sizing with a single computed class-entry footprint that includes icon diameter, halo padding, label line heights, label gaps, and top/bottom padding.
- Converted the class option itself to a three-row layout: visible icon halo, class name, and role text.
- Kept selection, hover, and class-themed animated background behavior intact.


## V0.16.19 - Class Gallery Spacing and Label Layout Fix

- Fixed character creation class gallery layout so class icon entries no longer overlap.
- Increased spacing between class selections to make better use of available panel space.
- Moved class names directly beneath each class icon for a cleaner icon-first hierarchy.
- Moved role text directly beneath each class name and styled it slightly smaller for better readability.
- Improved class entry sizing and layout flow so large class icons, names, and role text fit cleanly without collision.

## Root cause / design

The V0.16.18 gallery used large icon halos, but the grid row height and responsive media rules still allocated less vertical space than the actual rendered footprint of each entry. That footprint includes the icon, glow/halo, icon-to-name gap, class name, role text, label line height, and bottom padding. The result was row-to-row collision instead of a true icon-gallery flow.

## Fixed / Changed

- **Class gallery grid** (`Dream Realms V0.16.19.html`)
  - Rebuilt the active `.cc-class-list` sizing around explicit icon, label, and entry-footprint variables.
  - Increased `grid-auto-rows`, row gap, column gap, and gallery padding so each entry owns enough space for its full rendered footprint.
  - Kept the gallery scrollable when the viewport cannot show all fourteen large entries at once.

- **Class option renderer layout** (`Dream Realms V0.16.19.html`)
  - Converted each active class option to a vertical icon-first flex layout: large emblem, class name, then role text.
  - Removed dependence on undersized grid rows that caused labels from one row to collide with the next row's icon.
  - Preserved the full large icon/name/role button as the selection hit area.

- **Class label typography** (`Dream Realms V0.16.19.html`)
  - Centered class names directly under their icons.
  - Centered role text directly under the name with smaller uppercase typography.
  - Allowed long role labels to clamp cleanly inside the entry width rather than overlapping neighboring entries.

## Preserved

- Existing class selection behavior, selected-class halo feedback, hover/focus feedback, class-themed animated backgrounds, character preview, Randomize, Create Character, Back, name entry, and appearance customization remain in the owning character creation systems.

---


## V0.16.18 - Character Creation Layout and Class Theme Animation Polish

- Enlarged the character creation class-selection panel so large class icons, names, and role text fit more cleanly.
- Improved the class gallery layout to make better use of available screen space and reduce cramped presentation.
- Moved the Create Character button next to the Randomize button for a cleaner and more intentional action layout.
- Cleaned up low-value text and reduced wasted space in the character creation preview/footer area.
- Rebalanced character creation layout spacing to reduce empty space and improve overall presentation.
- Enhanced class-themed animated preview backgrounds with more life, motion, and visual identity while preserving readability.

## Root cause / design

The V0.16.17 class icon renderer was active, but the character creation shell still used a narrow mirrored side-panel layout and a detached three-column action bar. That left the class gallery physically cramped, caused label/role text to compete with icon height, and made Create Character feel disconnected from Randomize. The preview footer also retained a verbose helper strip and descriptive text row that consumed vertical space without adding enough value.

## Fixed / Changed

- **Creator layout root** (`Dream Realms V0.16.18.html`)
  - Split the creator layout into separate left appearance-panel and right class-gallery width variables.
  - Expanded the right-side class panel at the container/grid level instead of shrinking icons or masking overflow.
  - Preserved the center preview as the dominant stage while reducing low-value lower-panel rows.

- **Class gallery fit** (`Dream Realms V0.16.18.html`)
  - Reworked the gallery grid to use wider responsive icon-gallery cells.
  - Increased icon halo sizing while ensuring class name and role text have dedicated space beneath the emblem.
  - Allowed the gallery to scroll cleanly when screen height cannot show every large class entry at once.

- **Action bar layout** (`Dream Realms V0.16.18.html`)
  - Moved Create Character next to Randomize in the same centered action group.
  - Kept Back separate on the left as the navigation action.

- **Preview/footer cleanup** (`systems/ui-system.js`, `Dream Realms V0.16.18.html`)
  - Condensed the selected-character detail panel to one useful identity line.
  - Moved preview control help into a small overlay instead of reserving an entire footer row.
  - Reduced footer/dead-space height and tightened the name/detail rhythm under the preview.

- **Class theme animation polish** (`systems/ui-system.js`)
  - Increased particle counts, motion speed, field density, glow strength, rune/mist/arc counts, and drift variation through the existing class-theme profile system.
  - Kept all motion inside the existing creator preview canvas and requestAnimationFrame owner; no duplicate overlays, wrapper hotfixes, late timers, or bottom-of-file patches were added.

## Preserved

- Existing race selection, appearance controls, class selection, name entry, Randomize, Create Character, Back, selected-class preview updates, and character preview rendering remain owned by the existing character creation systems.

---

# Dream Realms V0.16.17 - Class Icon Gallery and Themed Background Animation Pass

## V0.16.17 - Class Icon Gallery and Themed Background Animation Pass

- Reworked character creation class selection away from boxed class tiles into a large icon-driven gallery layout.
- Increased class icon presentation substantially so each class selection is led by a large clickable class emblem.
- Moved class name and role text into a cleaner icon-first hierarchy beneath each class icon.
- Improved class selection highlighting with a cleaner premium emphasis treatment instead of bulky boxed cards.
- Expanded class selection spacing and layout to make better use of the available character creation panel space.
- Added class-themed animated preview backgrounds so each selected class has a more distinct fantasy presentation.

## Root cause / design

The V0.16.15 creator pass still rendered classes through `.classCard` elements with rectangular borders, filled card backgrounds, and a small emblem nested inside each card. Visually, that kept the right-side class selector in a boxed-tile presentation even though the content was larger than before. The correct owner was the character-creation class-selection renderer and its `.cc-*` stylesheet block, not a late overlay or a border-hiding workaround.

## Fixed / Changed

- **Class gallery renderer** (`systems/ui-system.js`)
  - Replaced the boxed `.classCard` character-creation class renderer with an icon-first `classIconOption` renderer.
  - Uses each class's dedicated emblem PNG from `assets/ui/class-emblems/` as the primary visual instead of nesting a small sprite badge inside a card.
  - Keeps the whole icon/name/role region as a large click target while the visible selection treatment is the icon halo and text emphasis, not a rectangular card.
  - Preserves class selection state, keyboard button behavior, double-click create flow, class color autofill, race details refresh, and creator preview refresh.

- **Class gallery styling** (`Dream Realms V0.16.17.html`)
  - Removed the visible heavy card chrome from the active character-creation class selector.
  - Added large circular/emblem-style halo presentation for each class icon.
  - Placed the class name directly under the icon and the class role directly under the class name.
  - Added hover/focus glow and selected-state aura around the icon without relying on a bulky rectangle.
  - Adjusted responsive sizing so the role line remains visible instead of being hidden at narrower widths.

- **Class-themed preview background animation** (`systems/ui-system.js`)
  - Replaced the single generic class-color mote layer with an explicit `CREATOR_CLASS_THEME_VISUALS` table.
  - Added lightweight themed preview motion profiles for all fourteen classes: radiant holy rays, guardian runes, steel sparks, shadow wisps, ranger leaves/wind, poison smoke, arcane runes, storm currents, summoning circles, necrotic mist, healing shimmer, druidic leaves/vines, bardic music arcs, and enchanter illusion shimmer.
  - Kept all background motion inside the existing creator preview canvas draw path and existing `requestAnimationFrame` loop, avoiding duplicate overlays, extra timers, or bottom-of-file patch logic.

## Preserved

- Existing character creation flow, name entry, race selection, appearance controls, randomize behavior, back button, create character button, and center model preview rendering are preserved.
- The existing class background images remain the base art; the new motion is an additive lightweight thematic layer.

---

# Dream Realms V0.16.15 - Character Creation Revamp

- Removed the Heritage Palette section from character creation and cleaned up the appearance panel layout.
- Expanded character appearance customization with more hair colors, eye colors, and skin colors.
- Changed the Randomize button so it randomizes character appearance and gender without changing the selected class.
- Reworked class selection into larger clickable class icon cards while preserving class role information.
- Added animated character preview behavior for a more polished creation experience.
- Enhanced class preview backgrounds with subtle animated flare.
- Improved overall character creation layout, readability, and presentation.

## Root cause / design

Character creation had drifted into several disjoint pain points, each owned by a different part of
`systems/ui-system.js` and the `.cc-*` character-creation stylesheet in the main HTML shell:

- **Heritage Palette** was a leftover dropdown (`#racePaletteSelect`) that duplicated information
  already implied by race + skin color for every race except Bogling (where it backs an actual
  skin-swatch palette system) and cluttered the appearance panel for no player-facing benefit.
- **Appearance pools were too small** (4 skin tones, a handful of hair/eye colors), so most
  characters converged on a few generic looks.
- **Randomize rerolled everything**, including class and race, so a single misclick could throw
  away a deliberate build the player had just spent time selecting.
- **Class selection was a small text list**, not a real gallery, with no strong selected-state and
  a cramped, hard-to-scan layout.
- **The center preview was fully static**: `renderClassPreviewModel` already draws through
  `model.draw(ctx, actor, performance.now())`, but nothing ever called it more than once per
  change, so the model never moved even though the underlying pose math is time-driven.
- **Class backgrounds were static art only**: `drawCreatorClassEmblemBackdrop` painted a single
  full-art image per class with no motion.

## Fixed / Changed

- **Heritage Palette removal** (`Dream Realms V0.16.15.html`, `systems/ui-system.js`, `game.js`)
  - Deleted the `.cc-palette-section` markup block (label + `#racePaletteSelect`) and its CSS
    rules entirely (no `display:none`, no dead grid space).
  - Replaced every `ui.racePaletteSelect.value` read/write across `getCharacterCreationData`,
    `renderClassCardPreviewCanvases`, `renderRaceDetails`, the bogling swatch lookup in
    `renderCreatorAppearanceControls`, and the skin-color click handler with the underlying
    `this.selectedRacePaletteId` state property, which already existed and is normalized via
    `DR.normalizeRacePaletteId`. The palette id is preserved internally only where the data model
    and the Bogling race require it - it is no longer exposed as a UI control.
  - Removed the now-nonexistent `racePaletteSelect` element reference from `game.js`'s `ui` map and
    from the generic input/change-listener array in `ui-system.js`.
- **Expanded appearance pools** (`systems/ui-system.js`, `Dream Realms V0.16.15.html`)
  - Added `HAIR_COLOR_LABELS` (15 named colors) and expanded `EYE_LABELS` (12 named colors), both
    single named-label data constants consumed by `renderCreatorAppearanceControls` for swatch
    titles - no scattered hardcoded one-off swatch colors.
  - Expanded the `#skinSelect` options from 4 to 12 (Porcelain through Onyx), covering a broader
    light-to-dark range with warm and cool undertones.
  - Reflowed `.cc-color-row` to wrap and resized `.cc-swatch` slightly so the larger swatch counts
    stay readable instead of overflowing.
- **Randomize scoped to appearance + gender only** (`systems/ui-system.js`)
  - Rewrote the `ui.ccRandomizeBtn` click handler so it only rolls `gender`, race-aware
    `hairStyle` (via `DR.Hairstyles.stylesFor(raceId)`), `hairColor`, `eyeColor`, and `skinColor`
    (Bogling-palette-aware). Class, race, name, and the active character slot are never touched by
    this handler.
- **Class selection reworked into large icon cards** (`Dream Realms V0.16.15.html`,
  `systems/ui-system.js`)
  - `#classGrid.cc-class-list` changed from a single-column list to a 2-column grid; `.classCard`
    reworked into a flex-column icon-over-name-over-role card with a large circular
    `.cc-class-icon` (up to 80px) and a strong gold glow/border highlight on `.classCard.selected`
    that also lights up the icon ring.
  - The whole card remains the click target (existing click/dblclick handlers were untouched), and
    cards now carry `role="button"`, `tabindex="0"`, `aria-pressed`, and a `keydown` handler for
    Enter/Space so keyboard activation works the same as a click.
- **Animated character preview** (`systems/ui-system.js`)
  - Added `Game.prototype.startCreatorPreviewAnimation` / `stopCreatorPreviewAnimation`, a
    self-terminating `requestAnimationFrame` loop that calls the *existing*
    `renderCreatorPreviewCanvas()` every frame - no second render path, no duplicate model, no
    extra timer. The loop checks `classScreen`'s own visibility each frame and stops itself the
    instant the screen is hidden, so it only needs one explicit start call
    (`beginCharacterCreationForSlot`) instead of a stop call at every one of the six places the
    creation screen can be closed.
  - Idle motion (breathing/sway/etc.) comes for free from the model's existing pose math, which
    was always keyed off `performance.now()` - it just was never being called on a loop before.
- **Animated class background flare** (`systems/ui-system.js`)
  - Added `drawCreatorClassAmbientFlare`, called from `drawCreatorClassEmblemBackdrop` on every
    preview frame: a slow pulsing radial glow plus a small number of seeded, per-class drifting
    motes, both tinted using the class's own existing `color` field from `data/classes.js` (the
    same accent already used elsewhere for that class). This is drawn as an additive layer on top
    of the existing static backdrop art - the original background image, vignette, and floor fade
    are unchanged.

## Preserved

- Race selection, gender selection, hair style selection, name entry, Create Character / Back
  button behavior, preview rotation/zoom/pan, and character slot creation flow are all unchanged.
- Existing class background art and class emblem icon assets are unchanged (only re-presented at a
  larger size / with an added animated overlay).

## Known Limitations

- Six of the fourteen class emblem icons (Summoner, Necromancer, Cleric, Druid, Bard, Enchanter -
  all row 1, column > 0 of the `class-emblems.png` sprite sheet) render as empty/broken slivers in
  the character-creation class cards. This was investigated in depth: the CSS background-position
  math is exact for every class, the source sprite sheet art is intact for all 14 cells, and the
  same glitch reproduces identically on the pre-existing, untouched in-game HUD class portrait for
  the same classes. This confirms the defect is a pre-existing issue in the shared
  `classEmblemMarkup`/sprite-rendering system (or an artifact of this headless test environment),
  not something introduced by this patch, and it was left alone rather than patched as a
  workaround at the character-creation call site.

---

# Dream Realms V0.16.14 - Shaman Duplicate Model Overlay Fix

- Fixed the root cause of Shaman actors rendering a second generic humanoid model over the correct Shaman class model.
- Updated class-render dispatch so Shaman uses a single authoritative full-model renderer.
- Fixed Shaman bot/merc rendering so Shaman bots use the correct Shaman model without an extra generic bot body layer.
- Fixed meditation rendering so it applies aura/effects without drawing a duplicate generic seated body over full-model classes.
- Preserved the correct detailed Shaman model, class silhouette, staff/accessories, and meditation effects.

## Root cause

There was never a second model actually being drawn in the same frame - the class-render dispatch
(`entity-renderer.js`) is a single if/else-if chain that only ever calls one body-drawing branch
per actor per frame, and that was already true before this patch. What looked like a duplicate
overlay was a single actor *alternating* between the correct detailed Shaman model and the generic
humanoid fallback from one frame to the next, which reads as a "second model flickering in" during
any sustained pose like meditation.

The cause was a crash, not a second draw call. `drawShamanLowerDetails`
(`render/class-identity-procedural-model.js`) read `rig.anchors.kneeLeft` / `kneeRight` /
`ankleLeft` / `ankleRight` - fields that have never existed on the rig's anchors object (leg
joints live under `rig.anchors.legs.left/right.knee` and `.foot`; there is no "ankle" anchor at
all). Every time this ran it threw `TypeError: Cannot read properties of undefined (reading 'x')`.
`drawFrontClassDetails` only calls it while the Shaman's front is visible (it returns immediately
when facing away), so the crash was direction-dependent: facing away, no crash, correct model;
facing the camera, guaranteed crash. `entity-renderer.js`'s `drawScaledModelSafely` wraps the whole
class-identity draw call in a try/catch specifically so one broken cosmetic detail can't take down
frame rendering - which is correct - but it was silently swallowing this crash and falling back to
the legacy generic humanoid renderer (`drawHumanoid`/`drawStandingBody`, whose class-color table
has no Shaman entry either) for that single frame, every front-facing frame, with no visible error
in-game. The result: an actor that appears to visibly swap between the real Shaman model and a
generic body depending on which way it's turned - most noticeable during meditation, where the
actor holds a fixed facing for a long time and the wrong body is the *only* one visible for the
whole session if that facing happens to be front-on.

This reproduced identically for the player Shaman, Shaman bots, and would reproduce for any Shaman
merc/NPC routed through the same `isClassIdentityActor` / `drawClassIdentityModel` path, since none
of them are exempt from `drawFrontClassDetails`.

## Fixed

- `drawShamanLowerDetails` now derives its leg-wrap decoration positions from the pelvis anchor,
  the same convention already used by the sibling Rogue/Warden/Ranger leg-detail functions,
  instead of the nonexistent knee/ankle anchor fields. The function no longer throws, so the
  Shaman's own full-model renderer completes every frame regardless of facing direction, and the
  generic-humanoid crash fallback never triggers for Shaman.
- Verified render-dispatch is genuinely single-owner (traced every branch of the
  `entity-renderer.js` actor dispatch chain for a live Shaman actor): exactly one body-drawing
  branch fires per frame, both before and after this fix - confirming this was a crash-recovery
  fallback, not a structural double-render, and that no dispatch/fallthrough change was needed
  there.
- Confirmed the fix for: player Shaman idle, player Shaman meditating (aura/rings render correctly
  over the single correct model, with no duplicate seated body), and a spawned Shaman bot idle and
  casting.

## Changed
- `render/class-identity-procedural-model.js`
  - `drawShamanLowerDetails` rewritten to read only anchors that exist (`rig.anchors.pelvis`),
    removing the crash that caused the intermittent generic-humanoid fallback.

## Technical Notes
- No changes were made to the actor render dispatch chain, the meditation aura/effects system, or
  bot/merc identity routing - tracing confirmed each already selects exactly one renderer per
  actor per frame; the only defect was the uncaught-turned-caught exception inside the Shaman
  detail function itself.
- Other class renderers (Fighter, Paladin, Wizard, and the previously-fixed Ranger) were
  re-verified unaffected.

---

# Dream Realms V0.16.13 - Ranger Bow Target Facing and Scale Fix

- Fixed Ranger bow placement so the bow appears on the correct side of the player based on the current combat target.
- Made Ranger combat target vector the single source of truth for player facing, bow orientation, arrow spawn point, and projectile velocity.
- Fixed bow orientation so Ranger bow always faces the direction of combat.
- Increased Ranger bow size for better readability during combat.
- Scaled bowstring, hand reach points, draw distance, and arrow tip offsets consistently with the larger bow.
- Preserved the V0.16.12 Ranger bow animation fixes, including no melee placeholder weapon, hand-to-string contact, release timing, and one-shot projectile guarding.

## Root cause

The bow's screen position was computed as a small (+-4 to 5 unit) offset from the shared rig's
`offHand` anchor, mirrored only by a left/right `side` flag. `offHand`/`mainHand` are assigned by
the body's 8-direction row/near-arm convention (which arm reads as "nearer" the camera for that
particular facing octant) - a convention with no relationship to which side the current target is
actually on. Since that anchor sits ~20-25 units from center on its own, the small aim-based nudge
on top of it was rarely enough to move the bow to the correct side, and had no vertical component
at all, so an enemy directly above or below the Ranger produced no visible change in bow position.
Separately, a real `aimVector` was already being computed at the bottom of `getRangerBowPose`, but
nothing actually used it for placement or rotation - it was returned and ignored.

## Fixed (render detail)

- Added `getRangerCombatAim(rig)`, the single aim source for the Ranger render path: the player's
  live combat-target vector (the same one combat-system.js resolves the shot against) takes
  priority over any stale movement/keyboard facing, with a target-entity-lookup fallback so
  bot/merc Rangers (which don't populate the player-only auto-attack visual fields) still aim
  correctly, and a last-facing fallback when there is no target at all.
- The bow pivot is now placed from the chest anchor pushed out along that aim vector's x *and* y
  components (plus a small perpendicular offset for a natural held-to-the-side look), so the bow
  moves to the correct side for left/right targets and visibly lifts or drops for targets above or
  below instead of only ever nudging a couple of units off a fixed-side anchor.
- The whole bow/string/hand/arrow assembly is now built once in a fixed "aiming east" template and
  rotated as a single rigid unit by the true aim angle (`ctx.rotate`), instead of being mirrored
  per-point by a left/right-only flag that could never express a vertical or diagonal target.
- This same fix was applied to the back-view (`drawBackProp`) longbow path, which previously always
  fell back to a static, unanimated idle bow for any facing row that shows the Ranger's back (e.g.
  due-west in the default camera) - it now runs the identical aim-driven drawn-bow logic via a
  shared `getRangerRangedAttackState` helper instead of duplicating the auto-attack-active check.
- Verified against all 8 target directions (cardinal and diagonal): the bow now visibly moves to
  and points toward the correct combat-facing side/direction in every case.

## Bow scale

- Added `RANGER_BOW_SCALE = 1.25`, multiplied into the existing per-profile scale factor that
  every bow-relative offset already read from - curve, grip, bowstring neutral/draw points, hand
  reach, and arrow tip offset all grew together automatically. Two offsets that had been left
  unscaled in the V0.16.12 pass (the full draw distance and the hand/wrist prop sizes) were fixed
  to multiply by that same factor so nothing was left behind at the old size.

## Changed
- `render/class-identity-procedural-model.js`
  - replaced `resolveRangerAimSide` (side-only) with `getRangerCombatAim` (full aim vector: x, y,
    angle, side), used by both the idle and drawn bow paths.
  - `getRangerBowPose` now derives bow position and rotation from that aim vector instead of a
    fixed offHand-relative offset with a cosmetic wobble; added `RANGER_BOW_SCALE`.
  - `drawRangerDrawnBow` now draws the whole bow/string/hand/arrow assembly inside a single
    `ctx.translate`/`ctx.rotate` transform instead of mirroring each point individually.
  - extracted `getRangerRangedAttackState` (shared by `drawFrontProps` and `drawBackProp`) so the
    Ranger's ranged-attack state is computed once and used identically by both view paths.

## Technical Notes
- Combat damage, timing intervals, and non-Ranger class weapon rendering were not changed; Fighter
  and Rogue melee auto-attack visuals were re-verified unchanged.
- No overlay, duplicate bow/renderer layer, or late/deferred patch was added; the bow's own
  position/rotation math was corrected at its source and reused, not covered up.

---

# Dream Realms V0.16.12 - Ranger Bow Combat Animation Root Fix

- Fixed the root cause of Ranger incorrectly rendering a white melee weapon/object during bow combat.
- Routed Ranger auto-attacks through a bow-specific combat weapon render path instead of generic melee fallback rendering.
- Added direction-aware Ranger bow aiming so bow orientation, player facing, projectile spawn, and projectile travel direction stay synchronized.
- Added explicit Ranger bow animation phases for aim, hand-to-string reach, grab, draw, release, and recovery.
- Fixed bowstring behavior so it only attaches to the drawing hand after contact, then snaps back on release.
- Synced Ranger arrow projectile spawning to the visual bowstring release frame.
- Added one-shot projectile release guarding to prevent duplicate arrows during a single attack cycle.

## Root cause

The white object was never a separate dagger/sword being drawn. It was
`drawMeleeAutoAttackOverlay` in `render/humanoid-base-renderer.js` - a shared, class-agnostic
"weapon swing trail" that `drawSharedAutoAttackOverlay` fires for *any* class whenever
`pose.autoAttackVisualActive && pose.action === 'attack'`. Ranger had no entry in that overlay's
class list (nor in `meditationClassId`, which it fed into), so it silently fell into the generic
`else` branch - the same one Fighter's sword-swing trail uses - and got a pale `#d8dfd6`/`#fff7c4`
blade-swoosh drawn at its raw, un-adjusted `mainHand` anchor on every auto-attack, entirely
independent of and in addition to the actual bow/string/arrow art. Fixing the Ranger-owned bow
renderer alone could never have removed this - the wrong path had to be identified and excluded.

Two further, compounding bugs made the remaining bow animation itself wrong even once that
overlay was gone:

- `humanoid-base-renderer.js`'s shared `pose.action === 'attack'` handling also flings `mainHand`
  outward using a Fighter/Rogue-shaped melee swing arc (`hand.x += nearSign*(10+sweep*17)`, etc.)
  for any class it doesn't specifically recognize - which included Ranger, producing a ~40-70 unit
  gap between the bow hand and the drawing hand.
- The Ranger bow-draw phase passed into the renderer was `Math.max(meleeAttackCurve,
  autoAttackVisualPhase)`, where `meleeAttackCurve` is a decaying post-hit swing flourish (bump-
  shaped, effectively counting down from the *previous* hit) never intended for a held-draw pose.
  Mixing it in made the bow reach full draw within the first ~20% of the swing interval, sit in a
  "released" pose for most of the remaining interval, and pop discontinuously once the flourish
  decayed to 0 - completely desynced from the actual arrow, which combat-system.js always spawns
  at the very end of the interval (`attackTimer` hitting 0).

## Fixed (render/animation detail)

- Ranger auto-attacks now read a monotonic 0->1 draw progress taken directly from
  `autoAttackVisualPhase` (the same value combat-system.js resolves the hit against), with an
  explicit phase split: 0-0.12 raise/aim, 0.12-0.30 reach the string (string stays neutral, no
  stretch before contact), 0.30-0.92 grab + draw (string only bends once the hand has arrived),
  0.92-1.00 hold-and-release - so the visual release always lands on the same frame as the real
  shot.
- The drawing hand travels to the bow's own string-rest point instead of the shared rig's raw
  (shoulder-width-apart) `mainHand` anchor, so idle/reach/draw/recovery all stay close to the bow
  instead of reaching out to an unrelated resting position on the far side of the body.
- Recovery after the shot fires eases the hand back to idle over the existing short post-hit
  settle window (`attackAnim` decaying from ~0.94 to 0) instead of snapping there instantly.
- The arrow projectile now spawns near the bow (offset along the true attacker->target aim
  vector) instead of at the player's own center point, and its velocity uses that same vector, so
  facing, bow aim, and travel direction always agree - including on diagonals.
- Verified against Fighter and Rogue: their own melee auto-attack swing overlay and weapon
  rendering are unchanged.

## Changed
- `render/humanoid-base-renderer.js`
  - `drawSharedAutoAttackOverlay` now skips Ranger entirely - the generic melee swing trail that
    was the actual source of the white object no longer runs for it.
  - `meditationClassId` now recognizes ranger/hunter/archer as their own style instead of falling
    through to the generic default.
  - the shared `pose.action === 'attack'` melee hand/chest displacement no longer applies to
    Ranger, which fully owns its own hand placement.
- `render/class-identity-procedural-model.js`
  - added `getRangerBowPose` (explicit raise/reach/draw/release/recovery phase state) and
    `easeInOut`/`lerpPoint`/`clamp01` helpers; `drawRangerDrawnBow` now renders from that pose.
  - Ranger's draw phase is taken directly from `autoAttackVisualPhase`, no longer mixed with the
    shared melee `attackCurve`.
- `systems/combat-system.js`
  - added `getAimVector` and a Ranger-only `rangedWeaponSpawnOrigin` helper; the arrow projectile
    now spawns from a point offset along the true aim vector instead of the player's own position.

## Technical Notes
- Combat damage, timing intervals, and non-Ranger class weapon rendering were not changed.
- No overlay, wrapper, duplicate render layer, or late/deferred patch was added anywhere in this
  fix; the wrong code path was identified and excluded at its source.

---

# Dream Realms V0.16.11 - Main Menu Authentication Gate Fix

## Fixed
This is a state-management and input-routing fix, not a visual fix. The main menu was not
actually gating world entry - it only looked gated because a menu overlay sat on top of
UI that was already live underneath it.

- **Main-menu click-through into the world:** `bindEvents()` in `game.js` attached a
  generic `pointerdown`/`click`/`touchend` listener directly to the splash screen that
  treated *any* click not landing on a button/input as "close the splash." Removed that
  handler entirely. The splash now has no fallback action at all - every transition off
  it (Login, Create Account, Load Game, character-slot selection, "Enter Realm") is wired
  to its own explicit button handler, and clicking empty space does nothing.
- **Login/character-selection could be bypassed:** `Game.prototype.closeLogoSplash`
  accepted a `{ force: true }` override and, once an account was merely active, would
  hide the splash directly with nothing behind it, without requiring a character to be
  chosen. Rewrote it as the single gate every caller (login submit, Save-folder import,
  gamepad/keyboard confirm) goes through: it can only ever land on the login panel or
  the character-slot screen, never directly into gameplay, and the bypass flag is gone.
- **Placeholder character reaching the world:** `start()` (the central world-entry
  transition in `game.js`) now refuses to enter the world when the incoming character
  name is the literal placeholder `"Unchosen"`, returning to character selection instead
  of constructing a player. Combined with the click-through fix, there is no path left
  that can hand `start()` empty/placeholder character data.
- **Gameplay HUD rendering underneath the main menu:** `#hud`, `#targetBox`, `#partyPanel`,
  `#hotbar`, `#log`, `#minimapWrap`, and `#menuDock` had no hidden-by-default state in CSS
  - they were only ever visually covered by the splash's higher z-index, exactly like the
  pre-existing (and correct) `#bagDock` pattern already used elsewhere in this file. They
  now default to `display:none` and are shown only under `body.gameStarted`, the single
  body-level flag that `start()` and `logoutToCharacterCreation()` own exclusively.
  `document.body.classList.add('gameStarted')` moved into `start()` itself instead of
  being set lazily inside `updateUI()`, so one system sets it and one CSS rule set reads
  it - not a z-index mask, not a second overlay.
- **Racial button visible on the login/main-menu screen:** `systems/racial-ability-system.js`
  used to create `#racialAbilityBtn`, append it to `document.body`, and bind its click/`R`
  hotkey unconditionally at system-install time (i.e. at boot, before any login), then
  relied on a CSS sibling-selector hack (`#classScreen[style*="flex"] ~ #racialAbilityBtn`)
  to mask it during character creation only - it was still in the DOM and clickable on the
  splash, login, and account-creation screens. Ownership moved to the actual gameplay
  state: the button element is now created lazily only once `game.started && game.player`
  are both true, and `logoutToCharacterCreation()` calls a new
  `game.teardownRacialAbilityButton()` to remove it from the DOM on logout. The CSS mask
  was deleted - there is nothing left to hide because the button no longer exists outside
  an active session.

## Changed
- `game.js`
  - removed the generic splash `pointerdown`/`click`/`touchend` "close on any click" handler.
  - `start()` now validates the incoming character name before constructing a `Player`
    and centrally owns setting `body.gameStarted`.
- `systems/ui-system.js`
  - `closeLogoSplash()` no longer takes a `force` bypass; it always requires
    `activeAccountId` and always routes into `showCharacterSlotsScreen()`.
  - `updateUI()` no longer toggles `body.gameStarted` (moved to `start()`).
  - `logoutToCharacterCreation()` now also tears down the Racial button.
- `systems/save-system.js`
  - `loadSaveCandidates()` updated for the simplified `closeLogoSplash()` signature.
- `systems/racial-ability-system.js`
  - Racial button creation/binding relocated from unconditional system install to a
    gated, lazy, in-session-only lifecycle with explicit teardown.
- `Dream Realms V0.16.10.html`
  - added a `body:not(.gameStarted)` hidden-by-default rule for the always-on gameplay
    HUD chrome that previously had none.
  - removed the `#classScreen[style*="flex"] ~ #racialAbilityBtn` visibility hack.

## Technical Notes
- This patch does not touch combat, loot, rendering pipelines, or class/race balance.
- No overlay, wrapper, duplicate button, or z-index reshuffle was used anywhere in this
  patch; every fix removes or relocates the code that owned the wrong behavior.

---

# Dream Realms V0.16.10 - Combat Visual Cache Fix

## Fixed
- Fixed the remaining root cause behind Ranger/Warden combat visual glitches: runtime sprite-cache keys were not owning auto-attack visual state, so cached combat frames could be reused after the target side or bow-draw phase changed.
- Ranger ranged auto attacks now consistently face the live target side while fighting instead of reusing a stale cached bow orientation.
- Ranger bowstring now visibly snaps forward during release instead of lingering in a half-drawn state after the arrow fires.
- Removed the last stale white-stick combat artifact caused by cached pre-release ranged-attack frames being reused across aim-side / attack-phase changes.

## Changed
- `systems/runtime-sprite-cache-system.js`
  - sprite-cache dynamic keys now include auto-attack visual ownership data: active flag, visual type, visual weapon, aim side, attack phase, and pulse.
  - combat visual state now counts as dynamic for cache bucket timing, so ranged attack presentation rebakes at the correct cadence.
- `render/class-identity-procedural-model.js`
  - Ranger drawn-bow animation now separates arm pull from string snap-back so the release frame reads correctly and the arrow disappears once fired.

## Technical Notes
- This is a root-cause cache ownership fix, not a late overlay suppression patch.
- Combat rules, damage, targeting, and class balance were not changed.

---

# Dream Realms V0.16.09 - Class Renderer Ownership Cleanup

## Fixed
- Fixed the root renderer ownership conflict causing the Shaman to render generic paperdoll gear as a second model over the actual class model.
- Removed the Ranger/Warden stray white-stick weapon artifact by blocking incompatible fallback weapon layers at the renderer ownership boundary, not by adding another late overlay patch.
- Ranger bow-draw animation now stores target-facing data from the combat system and mirrors the bow toward the current target side during ranged auto attacks.
- Ranger hip blades now render as sheathed secondary sidearms instead of bright exposed blades that read as hand-held white sticks.

## Changed
- `render/paperdoll-equipment-renderer.js`
  - added class-owned full-body art gating for Shaman.
  - kept Ranger/Warden class weapon-art ownership centralized.
- `render/class-identity-procedural-model.js`
  - Shaman no longer inherits generic default hair over its custom headdress/head identity.
  - Ranger aim-side resolution now uses combat-owned target-facing data first.
  - Ranger hip blade visuals changed from exposed blade props to sheathed sidearms.
- `systems/combat-system.js`
  - ranged weapon auto-attack visuals now update actor facing and store target-side data.
- `render/entity-renderer.js`
  - default standing fallback now knows Ranger/Warden/Shaman identities and will not fall back to Fighter sword/shield/stick silhouettes for them.
- `entities/entity.js`
  - initialized and cleared target-facing auto-attack visual fields.

## Technical Notes
- This pass removes the root ownership conflict between class identity rendering, paperdoll equipment rendering, and standing fallback rendering.
- Combat damage, timing, class stats, and target selection were not changed.

---

# Dream Realms V0.16.08 - Ranger Bow Facing and White Stick Removal

## Fixed
- Ranger bow-draw attack posing now mirrors to the active target side during ranged auto-attack visuals instead of staying locked to the wrong hand-side orientation.
- Removed the lingering generic white-stick weapon overlay from Ranger in-world renders by adding another suppression layer to standing/default weapon rendering.

## Changed
- `render/class-identity-procedural-model.js`
  - added runtime combat-target resolution / aim-side fallback so Ranger draw-bow visuals use the correct side based on target position or facing direction.
  - updated longbow presentation logic to respect the resolved aim side during ranged attack presentation.
- `render/entity-renderer.js`
  - added a defensive class-lock suppression path for Ranger/Warden standing weapon art so generic fallback weapon meshes cannot leak into the world render.

## Technical Notes
- Gameplay, damage, and target-selection rules were not changed. This pass is visual / facing cleanup only.

---

# Dream Realms V0.16.07 - Shaman High-Poly Graphical Revamp

## Added
- Full Shaman visual identity revamp across character creation and in-world procedural rendering.
- New Shaman storm staff model with crystal cage, charred wood shaft, copper bindings, feathers, and lightning-arc detailing.
- New Shaman-specific detail passes for head, shoulders, chest, belt, lower robes, back fetish rig, spirit wisps, and storm ground-ring effects.

## Changed
- `render/class-identity-procedural-model.js`
  - Shaman profile palette and silhouette were upgraded to better match the class fantasy: primal storm caster, layered hides, copper ritual gear, and elemental spirit motifs.
  - Shaman now uses a dedicated `stormStaff` primary prop instead of the generic ritual rod.
  - Shaman-specific front/back head details now render a horned feather headdress, wild hair, glowing eye / tattoo accents, and storm-crystal crown element.
  - Shaman-specific robe, fur mantle, chest fetish, belt gear, and lower-body detail passes now render throughout both creator and gameplay views.
  - Shaman class VFX now include orbiting elemental spirits, lightning arcs, and a storm-charged ground ring during idle / cast / attack presentation.

## Technical Notes
- This is a visual identity pass only. Combat rules, spell data, and gameplay balance were not changed.
- Existing class-identity weapon / overlay fixes from V0.16.06 remain in place.

---

# Dream Realms V0.16.06 - Ranger Bow Draw Animation and Weapon Overlay Cleanup

## Fixed
- Ranger front-attack presentation now visibly draws a bow shot: a nocked arrow appears on the bow, the draw hand pulls the string back, and the arrow releases forward during each auto attack cycle.
- Removed the stray generic white-stick weapon overlay from Ranger and Warden in-world renders by expanding class-locked weapon-art suppression to source-entity backed actors as well as direct actors.
- Warden keeps only the intended shield + maul visuals while fighting; Ranger keeps only the intended bow visuals while fighting.

## Changed
- `render/class-identity-procedural-model.js`
  - Ranger bow front-prop rendering now has a dedicated drawn-bow attack pose with bowstring pull/release and a visible arrow.
  - class-identity weapon locking now also checks `sourceEntity` class metadata.
- `render/paperdoll-equipment-renderer.js`
  - class-locked weapon-art suppression now resolves class data from both the actor and its `sourceEntity`.
  - added defensive early returns in weapon/offhand paperdoll draws for class-locked Ranger/Warden actors.

## Technical Notes
- This pass is visual / presentation focused. Combat timing and damage rules are unchanged.
- The traveling arrow projectile from V0.16.05 remains in place; this update adds the missing bow-draw animation readability before release.

---

# Dream Realms V0.16.05 - Class Weapon Identity and Ranger Arrow Auto Attack Fix

## Fixed
- Warden in-world model now uses the same class weapon identity shown in character creation: living wood shield + petrified/geode maul.
- Ranger in-world model now keeps the bow visible instead of being overridden by generic equipped weapon art.
- Suppressed generic paperdoll weapon/offhand art for Ranger and Warden only, so starter/default weapon visuals no longer draw as two sticks over the class model.
- Ranger auto attack now uses a bow-shot path instead of caster-style auto-cast visuals.
- Ranger auto attack now spawns a visible traveling arrow projectile.

## Changed
- `render/class-identity-procedural-model.js`
  - class identity weapons are now locked for Ranger and Warden.
  - equipped weapon stats remain intact, but class weapon visuals are no longer hidden.
- `render/paperdoll-equipment-renderer.js`
  - skips paperdoll weapon/offhand drawing for Ranger and Warden.
- `systems/combat-system.js`
  - separates ranged-weapon auto attacks from caster auto attacks.
  - Ranger uses attack animation + arrow projectile instead of spell cast animation + generic bolt.
- `systems/effects-system.js`
  - added `spawnArrowProjectile(...)`.
  - `spawnBolt(...)` now supports `style: 'arrow'` without changing existing bolt callers.
- `render/effects-renderer.js`
  - added arrow rendering for projectile effects.

## Technical Notes
- This is visual/combat-presentation only.
- Existing equipped gear remains in data and still contributes stats.
- The paperdoll visual suppression is intentionally scoped to Ranger and Warden to preserve class identity in-world.

---

# Dream Realms V0.16.05 - Warden High-Poly Graphical Revamp

## Added
- Added a full Warden visual identity pass to the procedural/character-creation renderer.
- Added Warden-specific high-detail helpers in `render/class-identity-procedural-model.js` for:
  - living bark mask and crown silhouette
  - glowing eyes, moss ruff, root tendrils, and stone accents
  - interlocking bark breastplate with sternum knot-eye
  - abdomen root lattice, thorned vines, and heart bramble
  - asymmetric burl pauldron and layered bark shoulder armor
  - root belt with geode buckle, gourd, seed pouch, bone/feather ward, and root curtain
  - bark/stone leg guards, moss, thorns, and grounded root tendrils
  - living tree cross-section shield and petrified geode hammer
- Added Warden high-poly baking source generator:
  - `tools/generate-warden-highpoly.js`
- Generated a quad-only Warden high-poly bake source set:
  - `assets/models/highpoly/warden_class_highpoly_quadmesh_v0.16.04.obj`
  - `assets/models/highpoly/warden_class_highpoly_quadmesh_v0.16.04.mtl`
  - `assets/models/highpoly/warden_class_highpoly_quadmesh_v0.16.04.json`

## Changed
- Revamped the visible Warden class model so it now reads as a primal bark-and-stone guardian instead of a generic green tank.
- Updated the Warden renderer profile with a dedicated bark-mask head, bark torso, burl pauldrons, root belt, heart bramble, living shield, and petrified hammer setup.
- Added a Warden-specific 3D runtime detail layer in `systems/render3d-system.js` for bark armor, moss ruff, crown mask, knot-eye chest, root cords, and stone/burl accents.
- Preserved the Warden's broad tank silhouette and proportions while increasing visible surface fidelity.

## Technical Notes
- Procedural preview changes are isolated to `render/class-identity-procedural-model.js`.
- Experimental 3D runtime additions are isolated to `systems/render3d-system.js`.
- The Warden high-poly OBJ generator emits quad-only geometry for baking/detail projection.
- This pass is visual only and does not alter Warden gameplay logic.

---

# Dream Realms V0.16.03 - Ranger Full Graphical Revamp

## Added
- Added a full Ranger visual identity pass to the procedural/character-creation renderer so the preview now reflects the intended wilderness warden design.
- Added Ranger-specific high-detail overlay helpers in `render/class-identity-procedural-model.js` for:
  - head details (headband feather, stubble, facial scar accents)
  - torso details (leather chest guard, jerkin stitching, quiver strap)
  - shoulder details (layered mantle/spaulder treatment and clasp)
  - chest details (sternum emblem / gear hardware)
  - belt gear (satchel, flask, rope/bedroll cues)
  - leg details (knee reinforcement, greave/boot cuff accents)
- Regenerated the Ranger high-poly bake source set for this version via `tools/generate-ranger-highpoly.js`:
  - `assets/models/highpoly/ranger_class_highpoly_quadmesh_v0.16.03.obj`
  - `assets/models/highpoly/ranger_class_highpoly_quadmesh_v0.16.03.mtl`
  - `assets/models/highpoly/ranger_class_highpoly_quadmesh_v0.16.03.json`

## Changed
- Revamped the visible Ranger class model so it now reads clearly as a stealthy archer/hunter instead of a generic light-armor figure.
- Preserved the base silhouette and proportions while increasing visible fidelity and design-specific surface detail.
- Kept the Ranger's longbow as the primary weapon, quiver/arrows on the back, and twin short blades as secondary hip-mounted weapons.
- Updated the renderer identifier for Ranger to `ranger-high-detail-v0.16.03-wildwarden` for debugging/inspection.

## Technical Notes
- Procedural preview changes are isolated to `render/class-identity-procedural-model.js`.
- The high-poly generator remains quad-only and baking-oriented.
- This pass is visual only and does not alter class gameplay logic.

---

# Dream Realms V0.16.02 - Ranger Primary Bow Fix

## Fixed
- Corrected the 2D/procedural Ranger class model so it now reads as a bow-first class instead of a dual-dagger class.
- Replaced the Ranger's default hand-held weapon routing from dual daggers to a longbow.
- Added a dedicated Ranger back-prop setup with a visible quiver and arrows.
- Kept twin short blades as secondary gear by moving them to hip-mounted sheathed sidearms instead of primary hand weapons.

## Changed
- Updated the Ranger profile in `render/class-identity-procedural-model.js` to use a `longbow` primary prop.
- Added new procedural drawing helpers for Ranger-specific equipment:
  - `drawLongbow(...)`
  - `drawQuiver(...)`
  - `drawRangerHipBlades(...)`
- Updated front and back prop rendering so the character creation / preview model presents the correct Ranger silhouette.

---

# Dream Realms V0.16.01 - Ranger High-Poly Upgrade Pass

## Added
- Added a dedicated Ranger high-poly source asset set under `assets/models/highpoly/`:
  - `ranger_class_highpoly_quadmesh_v0.16.01.obj`
  - `ranger_class_highpoly_quadmesh_v0.16.01.mtl`
  - `ranger_class_highpoly_quadmesh_v0.16.01.json`
- Added `tools/generate-ranger-highpoly.js` to procedurally generate the Ranger high-poly baking source.

## Changed
- Reworked the experimental 3D Ranger runtime model in `systems/render3d-system.js` to better match the class identity:
  - longbow primary weapon silhouette
  - ranger headband + feather token
  - fitted leather/cloth torso layering
  - shoulder mantle and weathered half-cape
  - chest strap, belt, quiver, visible arrows, bedroll, satchel, flask, twin hip blades, bracers, and greaves
- Updated the Ranger class visual routing so the 3D renderer uses the new Ranger-specific equipment pass instead of the generic sword-bearing silhouette.

## Technical Notes
- The generated Ranger source mesh stays in the same forward/up coordinate convention as the existing high-poly export pipeline: `+Y up, +Z forward`.
- The OBJ export is quad-only and intended for normal-map baking/detail projection onto the existing Ranger low-poly runtime mesh.
- Runtime changes are isolated to the 3D renderer path and do not alter non-3D gameplay systems.
