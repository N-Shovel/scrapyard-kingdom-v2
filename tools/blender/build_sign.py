"""Builds tools/.cache/built/title_sign.glb: the yard's name in its own plate letters (sign_glyphs.py), a wrench for
the Y, a hammer for the I and a nut for the O, bolted to matousekfoto's scanned rusty board. Letters and board are
shot through and bitten: the yard has been defended. Two chains above. optimize-assets.mjs takes it from there.

    blender -b --python tools/blender/build_sign.py

Meshes: Letters, Tools, Grip, Board, Chains. Meters. The origin is the top of the chains, the sign hangs below it and
faces +Z in three.js. Only the board keeps a material (the scan's colour maps), the game paints the rest.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import sign_glyphs  # noqa: E402

BOARD = os.path.join(ROOT, 'tools', '.cache', 'sketchfab', 'billboard_rusty', 'scene.gltf')
OUTPUT = os.path.join(ROOT, 'tools', '.cache', 'built', 'title_sign.glb')

LINES = ['SCRAPYARD', 'KINGDOM']
HEIGHT = 1.25       # cap height in meters, SCRAPYARD comes out about 8 m wide
SPACE = 0.09        # between letters, in cap heights
LEADING = 1.4       # baseline to baseline, in cap heights
PLATE = 0.08        # letter thickness
STANDOFF = 0.03     # gap between the backs of the letters and the board
MARGIN = (0.45, 0.6)  # board past the letters, at the sides and above and below
BOARD_KEEP = 0.1    # share of the scan's 60k triangles kept
TEXTURE = 2048      # the scan's 8k colour maps, before the optimizer makes them 1024 WebP
CHAIN = 2.6         # chain length above the board, enough to reach the gantry
LINK = (0.075, 0.014, 0.1)  # link radius, wire radius, pitch
SEED = 11

# Damage to letters, by (line, letter): ('hole' or 'bite', (x, y), radius), in that glyph's units.
# A shot that holes a letter holes the board behind it too.
DAMAGE = {
    (0, 0): [('bite', (0.0, 0.0), 0.3)],
    (0, 1): [('hole', (0.11, 0.64), 0.08), ('hole', (0.12, 0.36), 0.065), ('hole', (0.4, 0.09), 0.07)],
    (0, 3): [('hole', (0.11, 0.17), 0.08)],
    (0, 7): [('bite', (0.66, 0.08), 0.3)],
    (0, 8): [('hole', (0.11, 0.72), 0.085), ('hole', (0.4, 0.9), 0.065)],
    (1, 0): [('bite', (0.62, 1.04), 0.28)],
    (1, 3): [('hole', (0.11, 0.24), 0.08), ('hole', (0.52, 0.47), 0.07)],
    (1, 6): [('bite', (0.88, 0.95), 0.32), ('hole', (0.11, 0.52), 0.085)]
}
# Damage to the board alone, in shares of its width and height from its lower left corner, radii in meters.
# A burst of cannon fire walks up the lower right, a few strays, and bites out of the edges.
BOARD_HOLES = [((0.72, 0.06), 0.13), ((0.78, 0.1), 0.15), ((0.84, 0.14), 0.12), ((0.89, 0.19), 0.15),
               ((0.94, 0.24), 0.13), ((0.03, 0.55), 0.12), ((0.05, 0.62), 0.1), ((0.47, 0.5), 0.13),
               ((0.2, 0.95), 0.12), ((0.58, 0.04), 0.1)]
BOARD_BITES = [((1.0, 0.78), 0.8), ((0.0, 0.1), 0.7), ((0.37, 1.0), 0.55)]


def select(objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def area(points):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1])) / 2


def solid(name, rings):
    """A closed mesh through rings of points, each [(x, y) in cap heights] at its z in meters."""
    bm = bmesh.new()
    loops = []
    for points, z in rings:
        points = points if area(points) > 0 else points[::-1]
        loops.append([bm.verts.new((x * HEIGHT, y * HEIGHT, z)) for x, y in points])
    for low, high in zip(loops, loops[1:]):
        count = len(low)
        for n in range(count):
            bm.faces.new((low[n], low[(n + 1) % count], high[(n + 1) % count], high[n]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def rings(shape, depth):
    """An outline becomes a plate from the back to depth, or a cutter through everything when depth is None."""
    if isinstance(shape[0][0], (int, float)):
        return [(shape, 0.0), (shape, depth)] if depth else [(shape, -1.0), (shape, 1.0)]
    return shape


def boolean(target, tool, operation, tolerant=False):
    modifier = target.modifiers.new('step', 'BOOLEAN')
    modifier.operation = operation
    modifier.solver = 'EXACT'
    modifier.object = tool
    modifier.use_hole_tolerant = tolerant
    select([target])
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(tool)


def shrink(points, center, share):
    return [(center[0] + (x - center[0]) * share, center[1] + (y - center[1]) * share) for x, y in points]


def hole_cutter(center, radius, rng, unit=1.0):
    """Torn hole with its front edge pressed in, so the light catches a rim."""
    outline = sign_glyphs.hole(center, radius, rng)
    inner = shrink(outline, center, 0.8)
    scale = lambda points: [(x / unit, y / unit) for x, y in points]
    return solid('hole', [(scale(inner), -1.0), (scale(inner), PLATE - 0.025), (scale(outline), PLATE + 0.005),
                          (scale(outline), 1.0)])


def bite_cutter(center, radius, rng, unit=1.0):
    outline = [(x / unit, y / unit) for x, y in sign_glyphs.bite(center, radius, rng)]
    return solid('bite', [(outline, -1.0), (outline, 1.0)])


def wobble(obj, rng):
    """Cut by hand with a torch: no edge quite straight. Smooth in x and y, so front and back move together."""
    a, b = rng.uniform(0, 6.3), rng.uniform(0, 6.3)
    for vertex in obj.data.vertices:
        x, y = vertex.co.x, vertex.co.y
        vertex.co.x += 0.007 * math.sin(x * 5.1 + y * 3.3 + a)
        vertex.co.y += 0.007 * math.sin(x * 3.7 - y * 4.9 + b)


def glyph(char, damage, rng):
    """One letter as {mesh name: object}, in its own frame, plus the holes it took, for the board behind it."""
    width, steps = sign_glyphs.GLYPHS[char]
    parts = {}
    for step in steps:
        operation, shape = step[0], step[1]
        name = step[2] if len(step) > 2 else 'Letters'
        depth = step[3] if len(step) > 3 else PLATE
        if operation == 'add':
            piece = solid(name, rings(shape, depth))
            if name in parts:
                boolean(parts[name], piece, 'UNION')
            else:
                parts[name] = piece
        else:
            boolean(parts[name], solid('cut', rings(shape, None)), 'DIFFERENCE')

    holes = []
    for kind, center, radius in damage:
        for obj in parts.values():
            cutter = hole_cutter(center, radius, rng) if kind == 'hole' else bite_cutter(center, radius, rng)
            boolean(obj, cutter, 'DIFFERENCE')
        if kind == 'hole':
            holes.append((Vector((center[0] * HEIGHT, center[1] * HEIGHT, 0)), radius * HEIGHT))
    if 'Letters' in parts:
        wobble(parts['Letters'], rng)
    return width, parts, holes


def words(rng):
    """Both lines, centered on x = 0, the top line's baseline at y = 0. Each letter is set a little crooked,
    as if welded on by hand. Returns {mesh name: [objects]} and the holes in sign space."""
    meshes = {}
    holes = []
    for row, body in enumerate(LINES):
        built = [glyph(char, DAMAGE.get((row, n), []), rng) for n, char in enumerate(body)]
        total = sum(width for width, _, _ in built) + SPACE * (len(built) - 1)
        pen = - total / 2
        for width, parts, letter_holes in built:
            middle = Vector((width * HEIGHT / 2, HEIGHT / 2, 0))
            place = Vector((pen * HEIGHT + rng.uniform(-0.015, 0.015), - row * LEADING * HEIGHT + rng.uniform(-0.035, 0.035), 0))
            tilt = Euler((rng.uniform(-0.03, 0.03), rng.uniform(-0.04, 0.04), rng.uniform(-0.06, 0.06))).to_matrix().to_4x4()
            matrix = Matrix.Translation(place + middle) @ tilt @ Matrix.Translation(- middle)
            for name, obj in parts.items():
                obj.data.transform(matrix)
                meshes.setdefault(name, []).append(obj)
            holes += [(matrix @ center, radius) for center, radius in letter_holes]
            pen += width + SPACE
    return meshes, holes


def bounds(objects):
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def repaint(material):
    """The scan comes unlit. Keep its colour map, lit like any surface, its texture at TEXTURE."""
    image = next(node.image for node in material.node_tree.nodes if node.type == 'TEX_IMAGE')
    image.scale(TEXTURE, TEXTURE)
    nodes = material.node_tree.nodes
    nodes.clear()
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = 0.9
    shader.inputs['Metallic'].default_value = 0.0
    output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    material.use_backface_culling = False


def board(low, high, holes, rng):
    """The scanned board, stood up behind the letters, a little bigger than them, shot and bitten."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=BOARD)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    scans = [obj for obj in imported if obj.type == 'MESH']
    empties = [obj for obj in imported if obj.type != 'MESH']
    select(scans)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    scan = bpy.context.view_layer.objects.active
    scan.name = 'Board'
    scan.data.name = 'Board'
    for obj in empties:
        bpy.data.objects.remove(obj)

    decimate = scan.modifiers.new('keep', 'DECIMATE')
    decimate.ratio = BOARD_KEEP
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for material in scan.data.materials:
        repaint(material)

    # The scan lies in x and z with its face toward -y: stand it up facing +z, then stretch it over the letters
    scan.data.transform(Matrix.Rotation(- math.pi / 2, 4, 'X'))
    scan.data.update()
    near, far = bounds([scan])
    size = far - near
    width = high.x - low.x + 2 * MARGIN[0]
    height = high.y - low.y + 2 * MARGIN[1]
    scan.data.transform(Matrix.Diagonal((width / size.x, height / size.y, width / size.x, 1)))
    scan.data.update()
    near, far = bounds([scan])
    scan.data.transform(Matrix.Translation((
        (low.x + high.x) / 2 - (near.x + far.x) / 2,
        (low.y + high.y) / 2 - (near.y + far.y) / 2,
        - STANDOFF - far.z
    )))
    scan.data.update()
    near, far = bounds([scan])

    def at(share):
        return (near.x + share[0] * (far.x - near.x), near.y + share[1] * (far.y - near.y))

    # Cutters are drawn in cap heights, the board's damage is in meters
    for center, radius in holes:
        boolean(scan, hole_cutter((center.x, center.y), radius * 0.85, rng, HEIGHT), 'DIFFERENCE', tolerant=True)
    for share, radius in BOARD_HOLES:
        boolean(scan, hole_cutter(at(share), radius, rng, HEIGHT), 'DIFFERENCE', tolerant=True)
    for share, radius in BOARD_BITES:
        boolean(scan, bite_cutter(at(share), radius, rng, HEIGHT), 'DIFFERENCE', tolerant=True)
    return scan


def chain(x, z, top, bottom, rng):
    links = []
    count = int((top - bottom) / LINK[2])
    radius, wire, pitch = LINK
    for n in range(count):
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=wire, major_segments=10, minor_segments=4,
                                         location=(x, top - n * pitch - radius, z))
        link = bpy.context.view_layer.objects.active
        # Long links, every other one turned a quarter around the chain
        link.scale = (0.62, 1, 1)
        link.rotation_euler = (0, math.pi / 2 if n % 2 else 0, rng.uniform(-0.05, 0.05))
        links.append(link)
    return links


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)

    meshes, holes = words(rng)
    low, high = bounds([obj for objects in meshes.values() for obj in objects])
    scan = board(low, high, holes, rng)
    near, far = bounds([scan])

    # Chains from the board's top edge, a third of the way in from each side
    top = far.y
    links = []
    for x in (- (far.x - near.x) * 0.3, (far.x - near.x) * 0.3):
        links += chain(x, (near.z + far.z) / 2, top + CHAIN, top, rng)
    meshes['Chains'] = links
    meshes['Board'] = [scan]

    for name, objects in meshes.items():
        select(objects)
        bpy.ops.object.convert(target='MESH')
        if len(objects) > 1:
            bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = name
        joined.data.name = name
        # Origin at the top of the chains, the face toward Blender's -Y, which glTF turns into +Z
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        joined.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Translation((0, - top - CHAIN, 0)))

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format='GLB', export_materials='EXPORT', export_image_format='JPEG',
                              export_apply=True, export_cameras=False, export_lights=False)
    for obj in bpy.data.objects:
        low, high = bounds([obj])
        print('SIGN', obj.name, len(obj.data.polygons), 'faces', tuple(round(v, 2) for v in low), tuple(round(v, 2) for v in high))


build()
