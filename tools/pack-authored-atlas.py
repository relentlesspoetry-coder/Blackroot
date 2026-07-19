#!/usr/bin/env python3
"""
Blackroot authored-atlas packer.

Ingests generated prop PNGs, fits them to the sizes measured in-world, trims transparent margins,
packs them into small pages and emits a blackroot-authored-atlas-v1 manifest that
DR.AuthoredAtlas.validateManifest accepts with zero errors.

Runs on SYSTEM python3 (PIL 10.2 is present; numpy is not, so this uses no numpy). It does NOT run
inside Blender.

Usage:
  python3 tools/pack-authored-atlas.py --art art/props --out assets/atlases/props
  python3 tools/pack-authored-atlas.py --art art/props --out assets/atlases/props --placeholders

Input naming, matching tools/authored-prop-spec.json:
  <type>.png            for a type with no variants  (rock.png, brush.png)
  <type>_v<N>.png       for a type with variants     (tree_v0.png ... tree_v10.png)

Source images may be any size and any aspect - generators emit squares and that is fine. Each is
fitted into its measured frame box preserving aspect, then bottom-aligned and centred on the
anchor's x, because a prop's ground contact is what must line up, not its bounding box.

PAGE SIZE IS CAPPED AT 512 AND THAT IS NOT A STYLE CHOICE. The V0.20.53 bake shipped 4096-square
pages and measured 5-6x SLOWER in-world: drawImage out of a 4096 page costs 4.17us warm against
0.63us out of a small canvas, and nineteen such pages decoded to 1.28 GB of texture at 0.03% opaque
coverage. See assets/atlases/README.txt. The validator warns above 2048; this packer refuses above
512 outright.

THE ANCHOR SURVIVES TRIMMING. Margins are trimmed to save texture, and the trim offset is subtracted
from the anchor in the same step. Trimming without that correction is how a sprite ends up drawn
offset from its own feet with no error anywhere - and computing the anchor from alpha afterwards
instead is what produced footAnchorY == anchorY in every frame of the reverted V0.20.53 bake.
"""

import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("PIL is required: python3 -m pip install Pillow")

SCHEMA = "blackroot-authored-atlas-v1"
MAX_PAGE = 512
PADDING = 2  # transparent gutter, so bilinear sampling never bleeds between neighbours


def load_spec(path):
    with open(path) as fh:
        return json.load(fh)


def frame_ids(prop_id, spec):
    variants = spec.get("variants") or []
    if not variants:
        return [(prop_id, prop_id)]
    return [("%s_v%d" % (prop_id, v), "%s_v%d" % (prop_id, v)) for v in variants]


def fit_into_frame(img, fw, fh, anchor_x, anchor_y):
    """Scale to fit the frame box, then place so the source sits on the anchor.

    The source is centred horizontally on anchor.x and its BOTTOM is placed a little below
    anchor.y, matching how the procedural props sit: the measured props extend ~6-10px past their
    anchor because drawPropContactShadow draws at s.y + 6.
    """
    img = img.convert("RGBA")
    sw, sh = img.size
    below = max(0, fh - anchor_y)
    usable_h = max(1, fh - below)
    scale = min(fw / float(sw), usable_h / float(sh))
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    img = img.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    px = int(round(anchor_x - nw / 2.0))
    py = int(round(anchor_y - nh))
    canvas.alpha_composite(img, (max(0, min(fw - nw, px)), max(0, min(fh - nh, py))))
    return canvas


def trim(img, anchor):
    """Trim fully-transparent margins and shift the anchor by the same amount."""
    bbox = img.getbbox()
    if not bbox:
        return img, anchor, (0, 0)
    left, top, right, bottom = bbox
    return img.crop(bbox), {"x": anchor["x"] - left, "y": anchor["y"] - top}, (left, top)


def make_placeholder(fw, fh, anchor, label):
    """A clearly-fake stand-in, used only to prove the pipeline end to end.

    Deliberately ugly: magenta, labelled, with the anchor drawn as a crosshair. Nobody should ever
    mistake one of these for art, and if one reaches a build it is obvious in a screenshot.
    """
    img = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, fw - 2, fh - 2], outline=(255, 0, 255, 255), width=2)
    d.line([0, 0, fw, fh], fill=(255, 0, 255, 120), width=1)
    d.line([fw, 0, 0, fh], fill=(255, 0, 255, 120), width=1)
    ax, ay = int(anchor["x"]), int(anchor["y"])
    d.line([ax - 6, ay, ax + 6, ay], fill=(0, 255, 255, 255), width=1)
    d.line([ax, ay - 6, ax, ay + 6], fill=(0, 255, 255, 255), width=1)
    try:
        d.text((3, 2), label[:14], fill=(255, 255, 255, 220))
    except Exception:
        pass
    return img


def shelf_pack(items, max_page=MAX_PAGE):
    """Shelf packer: sort by height, lay rows, open a new page when full.

    Not optimal, but pages are small by mandate so occupancy matters far less than page COUNT and
    page SIZE, which are the two things that actually cost frame time.
    """
    ordered = sorted(items, key=lambda it: -it["img"].size[1])
    pages, placements = [], []
    cur, x, y, shelf_h = [], PADDING, PADDING, 0

    def close():
        if cur:
            pages.append(list(cur))

    for it in ordered:
        w, h = it["img"].size
        if w + PADDING * 2 > max_page or h + PADDING * 2 > max_page:
            raise SystemExit("frame '%s' is %dx%d which cannot fit a %dpx page; reduce its spec "
                             "frame size" % (it["id"], w, h, max_page))
        if x + w + PADDING > max_page:            # next shelf
            x, y, shelf_h = PADDING, y + shelf_h + PADDING, 0
        if y + h + PADDING > max_page:            # next page
            close()
            cur, x, y, shelf_h = [], PADDING, PADDING, 0
        placements.append({"item": it, "page": len(pages), "x": x, "y": y})
        cur.append(placements[-1])
        x += w + PADDING
        shelf_h = max(shelf_h, h)
    close()
    return pages, placements


def main():
    ap = argparse.ArgumentParser(prog="pack-authored-atlas")
    ap.add_argument("--spec", default="tools/authored-prop-spec.json")
    ap.add_argument("--art", required=True, help="folder of authored PNGs")
    ap.add_argument("--out", required=True, help="output folder for the atlas")
    ap.add_argument("--name", default=None)
    ap.add_argument("--placeholders", action="store_true",
                    help="Generate obvious magenta stand-ins for any missing image. For pipeline "
                         "testing only - never ship a build packed this way.")
    args = ap.parse_args()

    spec = load_spec(args.spec)
    atlas_name = args.name or spec.get("atlasName", "props")
    os.makedirs(args.out, exist_ok=True)

    props = dict(spec.get("props", {}))
    items, missing, used_placeholder = [], [], []

    for prop_id, ps in props.items():
        fw, fh = int(ps["frame"]["w"]), int(ps["frame"]["h"])
        anchor0 = {"x": float(ps["anchor"]["x"]), "y": float(ps["anchor"]["y"])}
        for frame_id, filestem in frame_ids(prop_id, ps):
            src = os.path.join(args.art, filestem + ".png")
            if os.path.exists(src):
                img = fit_into_frame(Image.open(src), fw, fh, anchor0["x"], anchor0["y"])
            elif args.placeholders:
                img = make_placeholder(fw, fh, anchor0, frame_id)
                used_placeholder.append(frame_id)
            else:
                missing.append(os.path.relpath(src))
                continue
            timg, tanchor, _ = trim(img, dict(anchor0))
            items.append({"id": frame_id, "prop": prop_id, "img": timg,
                          "anchor": tanchor, "spec": ps})

    if missing:
        print("MISSING %d image(s); nothing was written." % len(missing))
        for m in missing[:20]:
            print("  " + m)
        if len(missing) > 20:
            print("  ... and %d more" % (len(missing) - 20))
        print("\nGenerate them per docs/AUTHORED_PROP_ART_SPEC.md, or pass --placeholders to test "
              "the pipeline with obvious stand-ins.")
        return 1

    if not items:
        print("no frames to pack")
        return 1

    pages, placements = shelf_pack(items)
    surfaces = [Image.new("RGBA", (MAX_PAGE, MAX_PAGE), (0, 0, 0, 0)) for _ in pages]
    frames = {}

    for pl in placements:
        it, pi = pl["item"], pl["page"]
        surfaces[pi].alpha_composite(it["img"], (pl["x"], pl["y"]))
        w, h = it["img"].size
        ps = it["spec"]
        cs = dict(ps.get("contactShadow") or {})
        cs.pop("derived", None)
        entry = {
            "page": pi,
            "rect": {"x": pl["x"], "y": pl["y"], "w": w, "h": h},
            "anchor": {"x": round(it["anchor"]["x"], 2), "y": round(it["anchor"]["y"], 2)},
            "emissive": False,
        }
        if cs:
            entry["contactShadow"] = cs
        if ps.get("occlusionHeight") is not None:
            entry["occlusionHeight"] = ps["occlusionHeight"]
        # Carried through to the renderer: most prop types ignore obj.scale entirely, and applying
        # it uniformly made authored rootArch 1.23x its procedural counterpart. See the spec's
        # $comment for the measurement.
        entry["appliesObjScale"] = bool(ps.get("appliesObjScale", False))
        frames[it["id"]] = entry

    page_meta = []
    for i, surf in enumerate(surfaces):
        # Crop each page down to what it actually uses, rounded up to a multiple of 4. A half-empty
        # 512 page costs the same texture memory as a full one.
        bbox = surf.getbbox() or (0, 0, 4, 4)
        w = min(MAX_PAGE, ((bbox[2] + 3) // 4) * 4)
        h = min(MAX_PAGE, ((bbox[3] + 3) // 4) * 4)
        surf = surf.crop((0, 0, w, h))
        fname = "%s_%d.png" % (atlas_name, i)
        surf.save(os.path.join(args.out, fname), optimize=True)
        page_meta.append({"file": fname, "w": w, "h": h})

    manifest = {
        "schema": SCHEMA,
        "name": atlas_name,
        "kind": "prop",
        "pages": page_meta,
        "frames": frames,
    }
    man_path = os.path.join(args.out, "%s.json" % atlas_name)
    with open(man_path, "w") as fh:
        json.dump(manifest, fh, indent=2)

    opaque = sum(1 for it in items for px in it["img"].getdata() if px[3] > 0)
    total = sum(it["img"].size[0] * it["img"].size[1] for it in items)
    print("packed %d frames into %d page(s) <= %dpx" % (len(frames), len(page_meta), MAX_PAGE))
    for p in page_meta:
        print("  %s  %dx%d" % (p["file"], p["w"], p["h"]))
    print("opaque coverage %.1f%% (the V0.20.53 bake was 0.03%%)" % (100.0 * opaque / max(1, total)))
    print("manifest -> %s" % man_path)
    if used_placeholder:
        print("\n*** %d PLACEHOLDER frame(s) - this atlas is NOT shippable: %s"
              % (len(used_placeholder), ", ".join(used_placeholder[:8])
                 + (" ..." if len(used_placeholder) > 8 else "")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
