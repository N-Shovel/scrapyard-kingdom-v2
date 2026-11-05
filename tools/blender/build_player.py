"""Builds tools/.cache/built/player.glb from the source model. optimize-assets.mjs takes it from there.

    blender -b --python tools/blender/build_player.py                          build the glb
    blender -b --python tools/blender/build_player.py -- --preview             also render every clip
    blender -b --python tools/blender/build_player.py -- --no-export --preview run_f idle

Previews go to tools/.playtest/clips/. A clip only keys its own layer, so in a preview the other
layer's bones keep whatever pose the last built clip left them in. That is not what the game shows.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import clips  # noqa: E402
import rig  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(ROOT, 'tools', 'source', 'player_source.glb')
OUTPUT = os.path.join(ROOT, 'tools', '.cache', 'built', 'player.glb')
PREVIEW = os.path.join(ROOT, 'tools', '.playtest', 'clips')


def setup_preview():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 340
    scene.render.resolution_y = 420
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.light = 'STUDIO'
    camera = bpy.data.cameras.new('preview')
    camera.type = 'ORTHO'
    camera.ortho_scale = 2.3
    holder = bpy.data.objects.new('preview', camera)
    scene.collection.objects.link(holder)
    scene.camera = holder
    return holder


def render_clip(arm, holder, action, frames, angle):
    os.makedirs(PREVIEW, exist_ok=True)
    scene = bpy.context.scene
    arm.animation_data.action = action
    a = math.radians(angle)
    direction = Vector((math.sin(a), -math.cos(a), 0.12)).normalized()
    target = Vector((0.04, 0.14, 0.86))
    holder.location = target + direction * 6
    holder.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    for frame in frames:
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(PREVIEW, f'{action.name}_{frame:03d}_{angle}.png')
        bpy.ops.render.render(write_still=True)


def preview(arm, names, angle):
    holder = bpy.data.objects.get('preview') or setup_preview()
    for name in names:
        action = bpy.data.actions[name]
        start, end = int(action.frame_start), int(action.frame_end)
        frames = [round(start + (end - start) * t) for t in (0, 0.25, 0.5, 0.75)]
        render_clip(arm, holder, action, frames, angle)


def export():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
        export_anim_slide_to_zero=True,
        export_def_bones=False,
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

    arm, body, arms_mesh = rig.build(SOURCE)
    print('Arms mesh faces:', len(arms_mesh.data.polygons) if arms_mesh else 0)
    print('Body mesh faces:', len(body.data.polygons))

    # Blender defaults to 24 fps, which would slow every gait down against the stride table in T03.
    bpy.context.scene.render.fps = clips.FPS

    arm.data.pose_position = 'POSE'
    clips.build(arm)
    print('Clips:', sorted(a.name for a in bpy.data.actions))

    if '--preview' in arguments:
        index = arguments.index('--preview')
        names = arguments[index + 1:] or sorted(a.name for a in bpy.data.actions)
        preview(arm, names, 35)

    if '--no-export' not in arguments:
        if bpy.data.objects.get('preview'):
            bpy.data.objects.remove(bpy.data.objects['preview'])
        export()
        print('Exported', OUTPUT, os.path.getsize(OUTPUT))


main()
