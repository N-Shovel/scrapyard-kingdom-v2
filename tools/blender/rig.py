"""Turns the imported player model into a rig that can be animated.

The source model has no arm bones: both arms and the rifle are rigidly stuck to the chest.
This adds upper arm, forearm and hand bones, weights the jacket sleeves and gloves to them,
and adds IK so the hands follow a free-moving rifle bone.

Coordinates are armature space: x = character's left, -y = forward, z = up.
"""
import bmesh
import bpy
from mathutils import Matrix, Vector

# Measured from renders of each arm on its own.
ARMS = {
    'L': {
        'shoulder': Vector((0.130, 0.150, 1.325)),
        'elbow': Vector((0.150, 0.240, 1.135)),
        'wrist': Vector((0.175, 0.135, 1.005)),
        'tip': Vector((0.190, 0.030, 0.990)),
        'pole': Vector((0.46, 0.50, 1.05)),
    },
    'R': {
        'shoulder': Vector((-0.014, 0.128, 1.319)),
        'elbow': Vector((-0.130, 0.205, 1.155)),
        'wrist': Vector((-0.080, 0.040, 1.115)),
        'tip': Vector((-0.030, 0.000, 1.100)),
        'pole': Vector((-0.42, 0.45, 1.05)),
    },
}

# Rifle axes in the source pose, measured from the mesh.
RIFLE_FORWARD = Vector((0.812, -0.054, -0.581)).normalized()
RIFLE_UP = Vector((0.573, -0.118, 0.811)).normalized()
RIFLE_GRIP = Vector((-0.030, 0.020, 1.100))
RIFLE_SCALE = 0.82  # the model carries a rifle far too long for her arms to shoulder

# The left hand moves back along the handguard because the rifle got shorter.
LEFT_HAND_SHIFT = Vector((-0.040, -0.005, 0.012))

TORSO_AXIS = (Vector((0.060, 0.125, 0.95)), Vector((0.058, 0.120, 1.34)))

# The hair sweeps back and to her left from the skull. Measured from the mesh: the skull's middle,
# where the sweep leaves it, and the middle of the strands farther than 0.2 m out.
SKULL = Vector((0.071, 0.098, 1.504))
PONY = (Vector((0.133, 0.196, 1.473)), Vector((0.237, 0.359, 1.422)))
PONY_BLEND = (0.13, 0.30)  # strands this far from the skull's middle go from the head to the pony bone


def import_source(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)

    for obj in list(bpy.data.objects):
        if obj.name.startswith('Icosphere') or obj.name.startswith('Pistol'):
            bpy.data.objects.remove(obj)

    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    arm.location = (0, 0, 0)
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()

    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'

    return arm


def add_bones(arm):
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bones = arm.data.edit_bones

    def bone(name, head, tail, parent, deform=True):
        b = bones.new(name)
        b.head = head
        b.tail = tail
        b.parent = bones[parent]
        b.use_deform = deform
        b.use_connect = False
        return b

    for side, a in ARMS.items():
        bone(f'upper_arm.{side}', a['shoulder'], a['elbow'], 'chest')
        bone(f'forearm.{side}', a['elbow'], a['wrist'], f'upper_arm.{side}')
        bone(f'hand.{side}', a['wrist'], a['tip'], f'forearm.{side}')
        bone(f'elbow_pole.{side}', a['pole'], a['pole'] + Vector((0, 0, 0.05)), 'chest', False)

    bone('pony', PONY[0], PONY[1], 'head')

    rifle = bone('rifle', RIFLE_GRIP, RIFLE_GRIP + RIFLE_FORWARD * 0.2, 'chest', False)
    rifle.align_roll(RIFLE_UP)

    wrist_l = ARMS['L']['wrist'] + LEFT_HAND_SHIFT
    wrist_r = ARMS['R']['wrist']
    for side, wrist in (('L', wrist_l), ('R', wrist_r)):
        tip = ARMS[side]['tip'] - ARMS[side]['wrist']
        target = bone(f'hand_ik.{side}', wrist, wrist + tip, 'rifle', False)
        target.roll = bones[f'hand.{side}'].roll

    # The left shin bone runs past the ankle in the source, so aim the IK at each shin's real end.
    for side in 'LR':
        tail = bones[f'shin.{side}'].tail.copy()
        bone(f'ik_tgt.{side}', tail, tail + Vector((0, 0, 0.05)), f'foot_ik.{side}', False)

    # The source's knee poles sit 0.45 m ahead of the hips. A sprinting foot swung high and forward
    # lands on the line to them and the IK turns the knee sideways. Far ahead of each knee they never do.
    for side in 'LR':
        pole = bones[f'knee_pole.{side}']
        length = pole.tail - pole.head
        pole.head = bones[f'shin.{side}'].head + Vector((0, -1.5, 0))
        pole.tail = pole.head + length
        pole.use_deform = False

    bpy.ops.object.mode_set(mode='OBJECT')

    for pose_bone in arm.pose.bones:
        pose_bone.rotation_mode = 'QUATERNION'


def segment_distance(point, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (point - a).dot(ab) / ab.length_squared))
    return (point - (a + ab * t)).length


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def islands(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    seen = set()
    result = []
    for vert in bm.verts:
        if vert.index in seen:
            continue
        seen.add(vert.index)
        stack = [vert]
        part = []
        while stack:
            v = stack.pop()
            part.append(v.index)
            for edge in v.link_edges:
                other = edge.other_vert(v)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        result.append(part)
    bm.free()
    return result


def weight_arms(body):
    """The sleeves share one soup of small islands with the jacket, so classify whole islands,
    then blend bone weights smoothly by distance. A sleeve patch never gets torn in half."""
    mesh = body.data
    groups = {g.name: g for g in body.vertex_groups}
    for side in ARMS:
        for part in ('upper_arm', 'forearm', 'hand'):
            groups[f'{part}.{side}'] = body.vertex_groups.new(name=f'{part}.{side}')

    torso_groups = {'chest', 'spine', 'hips'}
    by_index = {g.index: g.name for g in body.vertex_groups}

    for part in islands(mesh):
        scores = {'L': 0, 'R': 0}
        allowed = 0
        for index in part:
            vertex = mesh.vertices[index]
            if not vertex.groups:
                continue
            main = by_index[max(vertex.groups, key=lambda g: g.weight).group]
            if main not in torso_groups:
                continue
            allowed += 1
            torso = segment_distance(vertex.co, *TORSO_AXIS)
            for side, a in ARMS.items():
                upper = segment_distance(vertex.co, a['shoulder'], a['elbow'])
                fore = segment_distance(vertex.co, a['elbow'], a['wrist'])
                hand = segment_distance(vertex.co, a['wrist'], a['tip'])
                near = min(upper, fore, hand)
                if near < 0.062 and near < torso - 0.018:
                    scores[side] += 1

        if allowed == 0:
            continue
        side = 'L' if scores['L'] >= scores['R'] else 'R'
        if scores[side] / len(part) < 0.55:
            continue

        a = ARMS[side]
        for index in part:
            co = mesh.vertices[index].co
            distances = {
                f'upper_arm.{side}': segment_distance(co, a['shoulder'], a['elbow']),
                f'forearm.{side}': segment_distance(co, a['elbow'], a['wrist']),
                f'hand.{side}': segment_distance(co, a['wrist'], a['tip']),
            }
            raw = {name: 1 / (d + 0.012) ** 4 for name, d in distances.items()}
            total = sum(raw.values())
            weights = {name: w / total for name, w in raw.items()}

            # Near the shoulder the sleeve still belongs partly to the chest
            keep_chest = 1 - smoothstep(0.02, 0.09, (co - a['shoulder']).length)
            for name in ('hips', 'spine', 'chest', 'neck'):
                if name in groups:
                    groups[name].remove([index])
            for name, w in weights.items():
                w *= 1 - keep_chest
                if w > 0.01:
                    groups[name].add([index], w, 'REPLACE')
            if keep_chest > 0.01:
                groups['chest'].add([index], keep_chest, 'REPLACE')


def split_arms(body):
    """Sleeves and gloves become their own mesh so first person can draw only them."""
    names = {g.index: g.name for g in body.vertex_groups}
    arm_names = {n for n in names.values() if n.startswith(('upper_arm', 'forearm', 'hand.'))}
    bm = bmesh.new()
    bm.from_mesh(body.data)
    layer = bm.verts.layers.deform.active

    def is_arm(vert):
        share = sum(w for g, w in vert[layer].items() if names[g] in arm_names)
        return share > 0.5

    for face in bm.faces:
        face.select_set(all(is_arm(v) for v in face.verts))
    bm.to_mesh(body.data)
    bm.free()

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')

    parts = [o for o in bpy.context.selected_objects if o is not body]
    if parts:
        parts[0].name = 'Arms'
        return parts[0]
    return None


def skin_hair(arm):
    """The hair came as a rigid mesh on the head bone. Skinned to the head and the pony bone,
    weighted by distance from the skull, the game can swing the sweep while the cap stays put."""
    hair = next(o for o in bpy.data.objects if o.name.startswith('Hair'))
    world = hair.matrix_world.copy()
    hair.parent = arm
    hair.parent_type = 'OBJECT'
    hair.parent_bone = ''
    hair.matrix_parent_inverse = Matrix.Identity(4)
    hair.matrix_basis = Matrix.Identity(4)
    hair.data.transform(world)

    head = hair.vertex_groups.new(name='head')
    pony = hair.vertex_groups.new(name='pony')
    for vert in hair.data.vertices:
        weight = smoothstep(*PONY_BLEND, (vert.co - SKULL).length)
        if weight < 1:
            head.add([vert.index], 1 - weight, 'REPLACE')
        if weight > 0:
            pony.add([vert.index], weight, 'REPLACE')

    modifier = hair.modifiers.new('Armature', 'ARMATURE')
    modifier.object = arm
    hair.name = 'Hair'
    return hair


def attach_rifle(arm):
    rifle = next(o for o in bpy.data.objects if o.name.startswith('Rifle'))
    world = rifle.matrix_world.copy()
    shrink = Matrix.Translation(RIFLE_GRIP) @ Matrix.Scale(RIFLE_SCALE, 4) @ Matrix.Translation(-RIFLE_GRIP)
    rifle.parent = arm
    rifle.parent_type = 'BONE'
    rifle.parent_bone = 'rifle'
    bpy.context.view_layer.update()
    rifle.matrix_world = shrink @ world
    rifle.name = 'Rifle'

    muzzle_local = Vector((0.49, 0.056, -0.385))
    socket = bpy.data.objects.new('muzzle', None)
    bpy.context.scene.collection.objects.link(socket)
    socket.parent = arm
    socket.parent_type = 'BONE'
    socket.parent_bone = 'rifle'
    bpy.context.view_layer.update()
    socket.matrix_world = Matrix.Translation((shrink @ world) @ muzzle_local)

    return rifle


def pole_angle(base, tip, pole_position):
    """Blender's IK pole angle that keeps a chain in its rest pose.
    Armature space throughout: Bone.head and .tail are relative to the parent, and using them
    here bent every knee backwards and twisted the elbows."""
    head = base.head_local
    normal = (tip.tail_local - head).cross(pole_position - head)
    projected = normal.cross(base.tail_local - head)
    axis = base.tail_local - head
    angle = base.x_axis.angle(projected)
    if base.x_axis.cross(projected).angle(axis) < 1:
        angle = -angle
    return angle


def add_constraints(arm):
    def ik(tip_name, base_name, target, pole):
        tip = arm.pose.bones[tip_name]
        c = tip.constraints.new('IK')
        c.target = arm
        c.subtarget = target
        c.pole_target = arm
        c.pole_subtarget = pole
        c.chain_count = 2
        c.pole_angle = pole_angle(arm.data.bones[base_name], arm.data.bones[tip_name], arm.data.bones[pole].head_local)

    for side in 'LR':
        ik(f'shin.{side}', f'thigh.{side}', f'ik_tgt.{side}', f'knee_pole.{side}')
        ik(f'forearm.{side}', f'upper_arm.{side}', f'hand_ik.{side}', f'elbow_pole.{side}')

        follow = arm.pose.bones[f'hand.{side}'].constraints.new('COPY_ROTATION')
        follow.target = arm
        follow.subtarget = f'hand_ik.{side}'
        follow.target_space = 'WORLD'
        follow.owner_space = 'WORLD'


def build(source):
    arm = import_source(source)
    add_bones(arm)
    body = next(o for o in bpy.data.objects if o.name.startswith('Body'))
    weight_arms(body)
    arms_mesh = split_arms(body)
    body.name = 'Body'
    skin_hair(arm)
    attach_rifle(arm)
    add_constraints(arm)
    return arm, body, arms_mesh
