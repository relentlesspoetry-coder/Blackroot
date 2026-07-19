Dream Realms sprite atlas output folder.

Use tools/sprite-baker.html to export:

  entities_0.png
  entities_1.png if needed
  entities.json

Copy the exported files into this folder. The runtime SpriteAtlasSystem loads assets/atlases/entities.json and then loads each PNG page referenced by that manifest. If this folder only contains the placeholder manifest, runtime rendering falls back to the procedural renderers and gameplay remains unchanged.

V0.13.69 adds runtime atlas validation stats. In the browser console, inspect:

  game.spriteAtlasSystem.getStats()
  game.spriteAtlasSystem.setDebugEnabled(true)

Only model frames are baked. UI, nameplates, health bars, chat bubbles, damage numbers, map UI, and debug overlays remain runtime-drawn.


--------------------------------------------------------------------------------
V0.20.54 STATUS: A FULL BAKE EXISTS HERE BUT IS DEACTIVATED ON PURPOSE.

entities.json is the placeholder again. The real bake from V0.20.53 is preserved as:

  entities.baked-v0.20.53.json
  entities.baked-v0.20.53.manifest.js
  entities_0.png ... entities_18.png   (19 pages, 7,969 frames)

WHY IT IS OFF: measured in-world it made rendering 5-6x SLOWER (311-384 ms/frame with the atlas on
versus 55-64 ms off; 12 FPS -> 9 FPS on the reporter's machine). The cause is the PAGE SIZE, not the
atlas concept: drawImage out of a 4096x4096 page costs 4.17us warm against 0.63us out of a small
canvas - 6.6x - and nineteen such pages decode to 1.28 GB of texture, of which only 0.03% of pixels
are opaque.

DO NOT simply rename the baked manifest back. Before re-enabling it:
  1. Re-pack into small pages (<=512 square, ideally per model) and trim transparent margins.
  2. Give the frame box real bottom clearance - Paladin feet were clipped, because its feet sit 44px
     below the model origin and the frame only allowed 42.
  3. Compute footAnchorY from the leg/foot anchors. Right now footAnchorY == anchorY in every baked
     frame, i.e. it is the origin, not a foot line.
  4. A/B it in a running world with game.spriteAtlasSystem.enabled before believing it helps.

Also measured: terrain/ground is ~63% of frame time and actors only ~36%, so an actor atlas alone
cannot reach 60 FPS. See docs/V0.20.54_ATLAS_REVERTED.md.
