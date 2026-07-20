#!/usr/bin/env python3
"""
Blackroot authored-atlas render rig.

Renders a high-poly OBJ from the engine's exact isometric viewpoint into per-direction PNGs,
plus a matching emissive pass and a JSON sidecar carrying the ground-anchor pixel for each
direction. tools/pack-authored-atlas.py consumes that output and emits a
blackroot-authored-atlas-v1 manifest.

Run:
  ./blender/blender --background --factory-startup \
      --python tools/blender-atlas-render.py -- \
      --obj assets/models/highpoly/paladin_class_highpoly_quadmesh_v0.15.90.obj \
      --out build/render/paladin --name human_paladin_male

WHY THE CAMERA IS AT 30 DEGREES, and not the 35.264 of true isometric or the 26.565 usually
quoted for "2:1 pixel art". It is derived from the engine's own projection, not chosen by eye.
game.js projectWorldToScreenUnzoomed maps a world unit to:

    sx = (px - py) * TILE_W/2      TILE_W = 136  ->  tileHalfW = 68
    sy = (px + py) * TILE_H/2      TILE_H = 68   ->  tileHalfH = 34

The screen-horizontal world direction is (1,-1)/sqrt(2), which spans 136px, giving an
unforeshortened scale of 136/sqrt(2) = 96.17 px per world unit. The screen-vertical (depth)
direction (1,1)/sqrt(2) spans 68px, giving 68/sqrt(2) = 48.08. The ratio 48.08/96.17 = 0.5 is
sin(pitch), so pitch = asin(0.5) = EXACTLY 30 degrees. Any other angle and every sprite's ground
ellipse disagrees with the tile it stands on.

WHAT DELIBERATELY DOES NOT MATCH. CONFIG.ELEV_STEP is 45, but a camera at 30 degrees would put a
world unit of height at 96.17*cos(30) = 83.28px. The engine's terrain elevation is an artistic
squash that does not agree with its own ground projection. That discrepancy applies to TILE
ELEVATION STEPS only. A character sprite is an upright billboard, so the model renders at the
true cos(30) factor and ELEV_STEP is correctly ignored here.

THE ANCHOR IS THE WORLD ORIGIN, NOT AN ALPHA GUESS. The model is placed with its foot centroid
at (0,0,0), and the anchor written to the sidecar is that origin projected through the actual
camera via world_to_camera_view. Deriving a foot line from the rendered alpha instead is what
produced footAnchorY == anchorY in every frame of the reverted V0.20.53 bake - an anchor that was
really the model origin and left every sprite floating.
"""

import bpy
import sys
import os
import json
import math
import argparse
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

# Derived from CONFIG.TILE_W / CONFIG.TILE_H. See module docstring.
CAMERA_PITCH_DEG = 30.0
PX_PER_WORLD_UNIT = 96.17  # 136 / sqrt(2)

# Measured in-world against the procedural Paladin (V0.21.6): its body stands 152 draw px tall
# excluding the contact shadow. Authored art matches that so it drops in at the same scale.
DEFAULT_TARGET_BODY_PX = 152.0


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(prog="blender-atlas-render")
    p.add_argument("--obj", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--directions", type=int, default=8)
    p.add_argument("--target-body-px", type=float, default=DEFAULT_TARGET_BODY_PX,
                   help="On-screen height in DRAW pixels the model should occupy at zoom 1.0.")
    p.add_argument("--supersample", type=int, default=3,
                   help="Render this many times larger; the packer box-downsamples. Supersampling "
                        "then reducing is what gives crisp pixel art instead of soft 3D AA.")
    p.add_argument("--margin", type=float, default=0.10, help="Fraction of frame kept as padding.")
    p.add_argument("--yaw-offset", type=float, default=0.0,
                   help="Degrees added to every direction, to align the model's intrinsic facing "
                        "with direction 0 = south//toward the viewer.")
    p.add_argument("--samples", type=int, default=32)
    return p.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_obj(path):
    before = set(bpy.data.objects)
    # up_axis Y: these meshes are authored +Y up (see assets/models/highpoly/README.txt) and
    # Blender is +Z up, so the importer performs that conversion for us.
    bpy.ops.wm.obj_import(filepath=path, up_axis="Y", forward_axis="NEGATIVE_Z")
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not new:
        raise RuntimeError("no mesh objects imported from %s" % path)
    return new


def join_meshes(objs):
    for o in bpy.data.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def ground_and_centre(obj):
    """Put the FOOT CENTROID at the world origin, base on z=0.

    Not the bounding-box centre: the Paladin carries a shield that pushes its X bounds to
    -0.997..0.835, so a bbox centre would sit off to one side of the body and every sprite would
    be anchored beside its own feet rather than under them. The lowest slice of geometry is the
    feet, so that is what gets centred.
    """
    mesh = obj.data
    world = obj.matrix_world
    zs = [(world @ v.co).z for v in mesh.vertices]
    min_z, max_z = min(zs), max(zs)
    height = max_z - min_z

    # Lowest 5% of the model by height == the feet.
    cutoff = min_z + height * 0.05
    foot = [(world @ v.co) for v in mesh.vertices if (world @ v.co).z <= cutoff]
    if not foot:
        foot = [(world @ v.co) for v in mesh.vertices]
    fx = sum(v.x for v in foot) / len(foot)
    fy = sum(v.y for v in foot) / len(foot)

    obj.location.x -= fx
    obj.location.y -= fy
    obj.location.z -= min_z
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    world = obj.matrix_world
    pts = [world @ v.co for v in mesh.vertices]
    radius_xy = max(math.hypot(p.x, p.y) for p in pts)
    return {"height": height, "radius_xy": radius_xy,
            "foot_verts": len(foot), "total_verts": len(mesh.vertices)}


def setup_world(scene, dark=0.02):
    wd = bpy.data.worlds.new("BlackrootWorld")
    scene.world = wd
    wd.use_nodes = True
    bg = wd.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (dark, dark, dark * 1.25, 1.0)
        bg.inputs[1].default_value = 1.0
    return wd


def add_lights():
    """Dark ambient plus localized key/fill/rim, per the art-direction profile.

    Lights are parented to nothing and positioned in WORLD space, then the camera orbits around
    them. That is deliberate: the light must stay fixed relative to the WORLD so that all eight
    directions are lit consistently, exactly as a pre-rendered isometric sprite set requires. If
    the lights orbited with the camera every direction would look identically lit and the set
    would read as flat.
    """
    made = []

    def lamp(name, kind, loc, energy, color, size=2.0, angle=None):
        d = bpy.data.lights.new(name, type=kind)
        d.energy = energy
        d.color = color
        if kind == "AREA":
            d.size = size
        if kind == "SUN" and angle is not None:
            d.angle = angle
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        made.append(o)
        return o

    # Key: warm, high, from the upper-left as the reference art is lit.
    key = lamp("Key", "SUN", (-4.0, -4.0, 6.0), 3.2, (1.0, 0.94, 0.84), angle=math.radians(6))
    key.rotation_euler = (math.radians(52), 0.0, math.radians(-40))

    # Fill: cold and weak, so shadow sides go blue rather than black.
    fill = lamp("Fill", "SUN", (4.0, -3.0, 3.0), 0.75, (0.55, 0.68, 1.0), angle=math.radians(30))
    fill.rotation_euler = (math.radians(68), 0.0, math.radians(55))

    # Rim: cold back light that separates the silhouette from a dark world.
    rim = lamp("Rim", "SUN", (2.0, 5.0, 4.0), 1.6, (0.62, 0.76, 1.0), angle=math.radians(12))
    rim.rotation_euler = (math.radians(115), 0.0, math.radians(200))
    return made


def setup_camera(scene, ortho_scale):
    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("IsoCam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    return cam


def place_camera(cam, yaw_deg, target, distance=40.0):
    """Orbit an orthographic camera at a fixed 30-degree pitch."""
    pitch = math.radians(90.0 - CAMERA_PITCH_DEG)  # Blender camera looks down its local -Z
    yaw = math.radians(yaw_deg)
    cam.rotation_euler = (pitch, 0.0, yaw)
    # forward = Rz(yaw) * Rx(pitch) * (0,0,-1)
    fx = 0.0
    fy = math.sin(pitch)
    fz = -math.cos(pitch)
    wx = fx * math.cos(yaw) - fy * math.sin(yaw)
    wy = fx * math.sin(yaw) + fy * math.cos(yaw)
    wz = fz
    cam.location = (target.x - wx * distance,
                    target.y - wy * distance,
                    target.z - wz * distance)
    bpy.context.view_layer.update()


def configure_render(scene, size_px, samples):
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size_px
    scene.render.resolution_y = size_px
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    try:
        scene.eevee.taa_render_samples = samples
    except Exception:
        pass
    # Standard view transform. Filmic/AgX would tone-map the sprite differently from the
    # engine's own additive VFX pass and the two would never agree on what "bright" means.
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    except Exception:
        pass


def render_to(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def anchor_pixel(scene, cam, size_px):
    """Project the world origin (the foot centroid) to a pixel coordinate."""
    co = world_to_camera_view(scene, cam, Vector((0.0, 0.0, 0.0)))
    # world_to_camera_view returns normalized coords with y measured from the BOTTOM.
    return {"x": co.x * size_px, "y": (1.0 - co.y) * size_px}


def has_emission():
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "EMISSION":
                return True
            if node.type == "BSDF_PRINCIPLED":
                inp = node.inputs.get("Emission Strength")
                col = node.inputs.get("Emission Color") or node.inputs.get("Emission")
                if inp is not None and float(inp.default_value) > 0.0:
                    if col is None:
                        return True
                    c = col.default_value
                    if (c[0] + c[1] + c[2]) > 0.0:
                        return True
    return False


def main():
    args = parse_args()
    obj_path = os.path.abspath(args.obj)
    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    reset_scene()
    scene = bpy.context.scene

    meshes = import_obj(obj_path)
    obj = join_meshes(meshes)
    info = ground_and_centre(obj)

    height = info["height"]
    radius = info["radius_xy"]

    # px per Blender unit needed for the model to occupy target_body_px on screen. A vertical
    # object of h units renders h*cos(pitch) tall through this camera.
    px_per_unit = args.target_body_px / (height * math.cos(math.radians(CAMERA_PITCH_DEG)))

    # Frame must hold the worst case over a full orbit: the full XY radius either side
    # horizontally, and the projected height plus the depth-projected radius vertically.
    need_w = 2.0 * radius
    need_h = height * math.cos(math.radians(CAMERA_PITCH_DEG)) + \
        2.0 * radius * math.sin(math.radians(CAMERA_PITCH_DEG))
    need = max(need_w, need_h) * (1.0 + args.margin * 2.0)

    size_px = int(math.ceil(need * px_per_unit * args.supersample))
    size_px += size_px % 2
    ortho_scale = size_px / (px_per_unit * args.supersample)

    setup_world(scene)
    lights = add_lights()
    cam = setup_camera(scene, ortho_scale)
    configure_render(scene, size_px, args.samples)

    target = Vector((0.0, 0.0, height * 0.5))
    emissive = has_emission()

    directions = []
    for d in range(args.directions):
        yaw = args.yaw_offset + (360.0 / args.directions) * d
        place_camera(cam, yaw, target)
        anchor = anchor_pixel(scene, cam, size_px)

        colour_path = os.path.join(out_dir, "%s_d%d.png" % (args.name, d))
        render_to(scene, colour_path)

        entry = {"direction": d, "yaw": yaw, "colour": os.path.basename(colour_path),
                 "anchor": anchor}

        if emissive:
            # Emissive-only pass: kill the lights and the world, leaving emission shaders as the
            # only contributors. Simpler and far less fragile than wiring the compositor's Emit
            # pass through a File Output node, and EEVEE renders it in the same time.
            for L in lights:
                L.hide_render = True
            bg = scene.world.node_tree.nodes.get("Background")
            saved = bg.inputs[0].default_value[:] if bg else None
            if bg:
                bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
            emis_path = os.path.join(out_dir, "%s_d%d_emissive.png" % (args.name, d))
            render_to(scene, emis_path)
            entry["emissive"] = os.path.basename(emis_path)
            for L in lights:
                L.hide_render = False
            if bg and saved is not None:
                bg.inputs[0].default_value = saved

        directions.append(entry)
        print("[render] direction %d/%d yaw=%.1f -> %s" % (d + 1, args.directions, yaw, colour_path))

    meta = {
        "name": args.name,
        "source": os.path.relpath(obj_path, os.getcwd()),
        "renderedSize": size_px,
        "supersample": args.supersample,
        "pxPerUnit": px_per_unit,
        "orthoScale": ortho_scale,
        "cameraPitchDeg": CAMERA_PITCH_DEG,
        "targetBodyPx": args.target_body_px,
        "modelHeightUnits": height,
        "modelRadiusXY": radius,
        "emissive": emissive,
        "directions": directions,
        # The packer downsamples by this and must reduce the anchor by the same factor.
        "downsample": args.supersample,
    }
    meta_path = os.path.join(out_dir, "render-meta.json")
    with open(meta_path, "w") as fh:
        json.dump(meta, fh, indent=2)

    print("[render] %s: %d directions at %dpx (ss %dx), px/unit %.2f, emissive=%s"
          % (args.name, args.directions, size_px, args.supersample, px_per_unit, emissive))
    print("[render] meta -> %s" % meta_path)


if __name__ == "__main__":
    main()
