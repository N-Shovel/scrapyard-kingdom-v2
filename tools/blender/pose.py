"""Small keyframing layer. A pose is a dict of bone name -> offset, all given in armature axes,
so the numbers in clips.py read as plain directions: x = her left, -y = forward, z = up.

Rotations are Euler degrees (x, y, z):
    +x leans forward    +z turns to her left    +y tips toward her right side
"""
import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector


def euler(degrees):
    return Euler([math.radians(a) for a in degrees], 'XYZ').to_quaternion()


class Clip:
    def __init__(self, arm, name):
        self.arm = arm
        self.name = name
        self.action = bpy.data.actions.new(name)
        self.action.use_fake_user = True
        arm.animation_data_create()
        arm.animation_data.action = self.action
        self.rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}

    def local(self, bone, offset, rotation):
        """Pose basis for a bone so that it moves by `offset` and turns by `rotation`
        about its own head, measured in armature axes, relative to its parent."""
        rest = self.rest[bone].to_quaternion()
        pose = self.arm.pose.bones[bone]
        pose.rotation_quaternion = rest.conjugated() @ rotation @ rest
        pose.location = rest.conjugated() @ offset

    def key(self, frame, pose):
        for bone, value in pose.items():
            offset = Vector(value.get('d', (0, 0, 0)))
            rotation = value['q'] if 'q' in value else euler(value.get('r', (0, 0, 0)))
            self.local(bone, offset, rotation)
            target = self.arm.pose.bones[bone]
            target.keyframe_insert('location', frame=frame, group=bone)
            target.keyframe_insert('rotation_quaternion', frame=frame, group=bone)

    def finish(self, start, end, cyclic=False):
        """Linear between dense samples, Bezier between sparse keys, and the clip range set."""
        self.action.use_frame_range = True
        self.action.frame_start = start
        self.action.frame_end = end
        self.action.use_cyclic = cyclic
        return self


def chain_delta(arm, pose, chain):
    """World-space change of the last bone in `chain` given a pose dict of its parents."""
    delta = Matrix.Identity(4)
    for name in chain:
        if name not in pose:
            continue
        value = pose[name]
        head = arm.data.bones[name].head_local
        q = value['q'] if 'q' in value else euler(value.get('r', (0, 0, 0)))
        d = Vector(value.get('d', (0, 0, 0)))
        local = Matrix.Translation(d + head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
        delta = delta @ local
    return delta


def rifle_pose(arm, pose, grip, forward, up, rifle_forward, rifle_up, rifle_grip):
    """Bone values that put the rifle's grip at `grip`, barrel along `forward`, top toward `up`,
    in armature space, whatever the spine and chest are doing in this same pose."""
    def basis(f, u):
        f = Vector(f).normalized()
        r = f.cross(Vector(u)).normalized()
        u = r.cross(f).normalized()
        return Matrix((r, f, u)).transposed().to_4x4()

    turn = basis(forward, up) @ basis(rifle_forward, rifle_up).inverted()
    world = Matrix.Translation(Vector(grip)) @ turn @ Matrix.Translation(-rifle_grip)
    parent = chain_delta(arm, pose, ['root', 'hips', 'spine', 'chest'])
    local = parent.inverted() @ world
    q = local.to_quaternion()
    d = local @ rifle_grip - rifle_grip
    return {'q': q, 'd': tuple(d)}
