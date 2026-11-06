"""Every animation the player has. Nothing is motion captured: each gait comes from foot
paths and body offsets chosen here, so a stride length can be changed with one number.

Lower-body clips drive root, hips, spine, legs. Upper-body clips drive chest, neck, head, arms
and rifle. The game plays one of each at once, see src/Experience/Actors/PlayerAnimation.js.
All gait clips start on left foot contact, so they can blend without feet fighting.
"""
import math

from mathutils import Vector

from pose import Clip, rifle_pose
from rig import RIFLE_FORWARD, RIFLE_GRIP, RIFLE_UP

FPS = 30
PELVIS = Vector((0.035, 0.17, 0.92))
FOOT = {
    'L': Vector((0.110, 0.17, 0.120)),
    'R': Vector((-0.040, 0.17, 0.123)),
}
FOOT_REST = {
    'L': Vector((0.020, 0.000, 0.120)),
    'R': Vector((0.015, 0.370, 0.123)),
}
HIPS_REST = Vector((0.035, 0.170, 0.920))


def lerp(a, b, t):
    return a + (b - a) * t


def ease(t):
    return t * t * (3 - 2 * t)


def feet(positions, rotations=None):
    rotations = rotations or {}
    return {
        f'foot_ik.{side}': {'d': tuple(pos - FOOT_REST[side]), 'r': rotations.get(side, (0, 0, 0))}
        for side, pos in positions.items()
    }


def hips(height=0.0, x=0.0, y=0.0, r=(0, 0, 0)):
    target = PELVIS + Vector((x, y, height))
    return {'hips': {'d': tuple(target - HIPS_REST), 'r': r}}


def foot_path(q, stride, direction, stance, lift, heel, toe, side_rest, swing_shape=0.8):
    """Where one foot is at phase q of the gait. During stance it slides back at exactly the
    body's speed, which is why the feet do not skate in game."""
    reach = stride * stance / 2
    if q < stance:
        u = q / stance
        along = lerp(reach, -reach, u)
        height = 0.0
        pitch = heel * max(0.0, 1 - u / 0.18) - toe * max(0.0, (u - 0.72) / 0.28)
    else:
        v = (q - stance) / (1 - stance)
        along = lerp(-reach, reach, ease(v))
        height = lift * math.sin(math.pi * v) ** swing_shape
        pitch = lerp(-toe, heel, ease(v))

    position = side_rest + Vector((direction[0] * along, direction[1] * along, height))
    # The sole rolls over the ball of the foot, so a dropped toe raises the ankle.
    position.z += abs(math.sin(math.radians(pitch))) * 0.09
    return position, pitch


def gait(arm, name, frames, stride, direction, stance, lift, heel, toe, crouch, bob, bob_phase,
         sway, lean, yaw, roll=0.0, spine_counter=0.6, lateral=False):
    clip = Clip(arm, name)
    for frame in range(frames + 1):
        p = frame / frames
        left, pitch_l = foot_path(p % 1, stride, direction, stance, lift, heel, toe, FOOT['L'])
        right, pitch_r = foot_path((p + 0.5) % 1, stride, direction, stance, lift, heel, toe, FOOT['R'])

        twist = -yaw * math.cos(2 * math.pi * p)
        side = sway * math.sin(2 * math.pi * p)
        tilt = -roll * math.sin(2 * math.pi * p)
        height = -crouch + bob * bob_phase * math.cos(4 * math.pi * p)

        # pitch > 0 means toes up (heel strike). A positive x rotation tips the toes down.
        rotation_l = (-pitch_l, 0, 0) if not lateral else (0, pitch_l * 0.4, 0)
        rotation_r = (-pitch_r, 0, 0) if not lateral else (0, pitch_r * 0.4, 0)

        pose = {}
        pose.update(hips(height, side, 0, (lean * 0.45, tilt, twist)))
        pose['spine'] = {'r': (lean * 0.55, -tilt * 0.5, -twist * spine_counter)}
        pose.update(feet({'L': left, 'R': right}, {'L': rotation_l, 'R': rotation_r}))
        clip.key(frame + 1, pose)
    return clip.finish(1, frames + 1, True)


def lower_body(arm):
    forward = (0, -1)
    back = (0, 1)
    left = (1, 0)
    right = (-1, 0)

    # Walk: used while aiming. Long stance, feet never both leave the ground.
    gait(arm, 'walk_f', 32, 1.45, forward, 0.62, 0.075, 16, 22, 0.035, 0.016, -1, 0.018, 4, 7)
    gait(arm, 'walk_b', 32, 1.15, back, 0.62, 0.06, -10, -16, 0.045, 0.012, -1, 0.018, -2, 5)
    gait(arm, 'walk_l', 32, 1.0, left, 0.60, 0.06, 6, 8, 0.05, 0.012, -1, 0.012, 2, 2, 3, lateral=True)
    gait(arm, 'walk_r', 32, 1.0, right, 0.60, 0.06, 6, 8, 0.05, 0.012, -1, 0.012, 2, 2, -3, lateral=True)

    # Jog: default combat speed. A short flight phase, weight drops through mid stance.
    gait(arm, 'run_f', 22, 2.9, forward, 0.36, 0.17, 12, 34, 0.075, 0.03, 1, 0.022, 9, 12)
    gait(arm, 'run_b', 22, 2.2, back, 0.46, 0.12, -8, -22, 0.085, 0.024, 1, 0.02, -4, 8)
    gait(arm, 'run_l', 22, 2.1, left, 0.46, 0.11, 6, 10, 0.095, 0.024, 1, 0.012, 4, 3, 6, lateral=True)
    gait(arm, 'run_r', 22, 2.1, right, 0.46, 0.11, 6, 10, 0.095, 0.024, 1, 0.012, 4, 3, -6, lateral=True)

    # Sprint: long reach, big knee lift, leaning into it.
    gait(arm, 'sprint', 18, 3.9, forward, 0.3, 0.27, 8, 42, 0.095, 0.04, 1, 0.024, 17, 16, spine_counter=0.8)

    idle(arm)
    air(arm)
    land(arm)
    slide(arm)


def idle(arm):
    """Weight drifts from foot to foot over three seconds. Feet stay staggered, not parallel."""
    clip = Clip(arm, 'idle')
    frames = 90
    left = FOOT['L'] + Vector((0.01, -0.09, 0))
    right = FOOT['R'] + Vector((-0.02, 0.10, 0))
    for frame in range(0, frames + 1, 6):
        p = frame / frames
        side = 0.014 * math.sin(2 * math.pi * p)
        breath = 0.006 * math.sin(4 * math.pi * p)
        pose = {}
        pose.update(hips(-0.055 + breath, side, 0.0, (2, -1.2 * math.sin(2 * math.pi * p), -6)))
        pose['spine'] = {'r': (1.5, 0.8 * math.sin(2 * math.pi * p), 4)}
        pose.update(feet({'L': left, 'R': right}, {'L': (0, 0, -6), 'R': (0, 0, 12)}))
        clip.key(frame + 1, pose)
    clip.finish(1, frames + 1, True)


def air(arm):
    # Takeoff to apex: trail leg tucks, lead knee stays high.
    clip = Clip(arm, 'jump')
    for frame, (h, lf, rf, lean) in {
        1: (-0.10, (0.00, 0.10), (0.00, 0.06), 6),
        5: (0.02, (-0.14, 0.26), (0.18, 0.12), 7),
        12: (0.04, (-0.20, 0.36), (0.26, 0.26), 4),
    }.items():
        pose = {}
        pose.update(hips(h, 0, 0, (lean * 0.5, 0, 0)))
        pose['spine'] = {'r': (lean * 0.5, 0, 0)}
        pose.update(feet({
            'L': FOOT['L'] + Vector((0, lf[0], lf[1] + h)),
            'R': FOOT['R'] + Vector((0, rf[0], rf[1] + h)),
        }, {'L': (-6, 0, 0), 'R': (26, 0, 0)}))
        clip.key(frame, pose)
    clip.finish(1, 12)

    # Falling: legs reach for the ground, a slow pedal so it never looks frozen.
    clip = Clip(arm, 'fall')
    frames = 24
    for frame in range(0, frames + 1, 4):
        p = frame / frames
        s = math.sin(2 * math.pi * p)
        pose = {}
        pose.update(hips(-0.02, 0, 0, (-3, 1.2 * s, 2 * s)))
        pose['spine'] = {'r': (-2, 0, -1.5 * s)}
        pose.update(feet({
            'L': FOOT['L'] + Vector((0, -0.13 + 0.05 * s, 0.14 + 0.03 * s)),
            'R': FOOT['R'] + Vector((0, 0.10 - 0.05 * s, 0.19 - 0.03 * s)),
        }, {'L': (-10, 0, 0), 'R': (14, 0, 0)}))
        clip.key(frame + 1, pose)
    clip.finish(1, frames + 1, True)


def land(arm):
    # Knees absorb the drop, then she stands back up. Heavier than it needs to be, on purpose.
    clip = Clip(arm, 'land')
    for frame, h, lean in ((1, -0.10, 6), (4, -0.27, 15), (10, -0.15, 8), (16, -0.06, 3)):
        pose = {}
        pose.update(hips(h, 0, 0, (lean * 0.5, 0, 0)))
        pose['spine'] = {'r': (lean * 0.5, 0, 0)}
        pose.update(feet({
            'L': FOOT['L'] + Vector((0.01, -0.09, 0)),
            'R': FOOT['R'] + Vector((-0.02, 0.10, 0)),
        }))
        clip.key(frame, pose)
    clip.finish(1, 16)


def slide(arm):
    # Lead leg out straight, trail leg folded under, leaning back with one hip near the ground.
    clip = Clip(arm, 'slide')
    for frame, h, wobble in ((1, -0.30, 0), (6, -0.45, 0.01), (14, -0.47, -0.008), (22, -0.46, 0.006)):
        pose = {}
        pose.update(hips(h, 0.015 + wobble, 0.10, (-34, -10, 16)))
        pose['spine'] = {'r': (22, 4, -10)}
        pose.update(feet({
            'L': FOOT['L'] + Vector((0.02, -0.56, 0.02 + wobble)),
            'R': FOOT['R'] + Vector((-0.10, 0.02, 0.05)),
        }, {'L': (-44, 0, 0), 'R': (6, -26, 0)}))
        clip.key(frame, pose)
    clip.finish(1, 22, True)


# ---------- upper body ----------

def upper(arm, pose, grip, forward, up):
    pose['rifle'] = rifle_pose(arm, pose, grip, forward, up, RIFLE_FORWARD, RIFLE_UP, RIFLE_GRIP)
    return pose


def ready_pose(arm, t=0.0):
    """Compressed low ready: stock in the armpit, muzzle down and to her front left."""
    breath = 0.005 * math.sin(t)
    pose = {
        'chest': {'r': (2 + breath * 40, 0, -8)},
        'neck': {'r': (0, 0, 4)},
        'head': {'r': (-3, 0, 5)},
    }
    return upper(arm, pose, (-0.035, -0.02, 1.145 + breath), (0.52, -0.72, -0.46), (0.28, -0.32, 0.9))


def aim_pose(arm, t=0.0, climb=0.0, back=0.0):
    """Shouldered. Chest bladed so the left arm can reach the handguard, head turned back to the sights."""
    breath = 0.002 * math.sin(t)
    pose = {
        'chest': {'r': (4 - climb * 12, 0, -28)},
        'neck': {'r': (2, 0, 17)},
        'head': {'r': (7 + climb * 8, -6, 13)},
    }
    return upper(arm, pose, (-0.02, -0.075 + back, 1.35 + breath + climb * 0.02), (0, -1, climb), (0, climb, 1))


def carry_pose(arm, s):
    """Sprint: rifle high across the chest, swinging with the stride."""
    pose = {
        'chest': {'r': (6, 2 * s, 8 * s)},
        'neck': {'r': (-3, 0, -4 * s)},
        'head': {'r': (-5, 0, -4 * s)},
    }
    return upper(arm, pose, (-0.02 + 0.012 * s, -0.045, 1.2), (0.62 + 0.08 * s, -0.3, 0.72), (-0.55, -0.4, 0.6))


def upper_body(arm):
    clip = Clip(arm, 'up_ready')
    for frame in range(0, 61, 10):
        clip.key(frame + 1, ready_pose(arm, frame / 60 * 2 * math.pi))
    clip.finish(1, 61, True)

    clip = Clip(arm, 'up_aim')
    for frame in range(0, 61, 10):
        clip.key(frame + 1, aim_pose(arm, frame / 60 * 2 * math.pi))
    clip.finish(1, 61, True)

    clip = Clip(arm, 'up_carry')
    for frame in range(0, 19, 3):
        clip.key(frame + 1, carry_pose(arm, -math.cos(2 * math.pi * frame / 18)))
    clip.finish(1, 19, True)

    # Torch: the same rifle bone holds the torch. The game swaps which mesh is visible.
    clip = Clip(arm, 'up_torch')
    for frame in range(0, 41, 10):
        s = math.sin(frame / 40 * 2 * math.pi)
        pose = {
            'chest': {'r': (8, 0, -10)},
            'neck': {'r': (4, 0, 6)},
            'head': {'r': (6, 0, 5)},
        }
        clip.key(frame + 1, upper(arm, pose, (0.0 + 0.004 * s, -0.11, 1.2), (0.12, -1, -0.1), (0, 0, 1)))
    clip.finish(1, 41, True)

    # Fire: stacked on top of aim as an additive. Only the difference from frame 1 matters.
    clip = Clip(arm, 'up_fire')
    for frame, climb, back in ((1, 0, 0), (2, 0.13, 0.045), (4, 0.09, 0.03), (8, 0.03, 0.008), (13, 0, 0)):
        clip.key(frame, aim_pose(arm, 0, climb, back))
    clip.finish(1, 13)

    # Hurt: additive flinch.
    clip = Clip(arm, 'hurt')
    for frame, s in ((1, 0), (3, 1), (7, 0.4), (12, 0)):
        pose = ready_pose(arm)
        pose['chest']['r'] = (2 - 12 * s, 4 * s, -8 + 8 * s)
        pose['head']['r'] = (-3 - 14 * s, 0, 5)
        clip.key(frame, pose)
    clip.finish(1, 12)

    reload_clip(arm)
    death(arm)


def reload_clip(arm):
    """Rifle tips up and out, left hand drops to the belt pouch, comes back, racks."""
    clip = Clip(arm, 'up_reload')
    keys = (
        (1, 0.0, (0, 0, 0)),
        (8, 1.0, (0, 0, 0)),
        (16, 1.0, (0.06, 0.20, -0.24)),
        (24, 1.0, (0.09, 0.22, -0.30)),
        (34, 1.0, (0.03, 0.08, -0.12)),
        (40, 1.0, (0, 0, 0.02)),
        (44, 0.8, (0, 0, -0.03)),
        (50, 0.0, (0, 0, 0)),
    )
    for frame, up, hand in keys:
        pose = {
            'chest': {'r': (8 * up + 2, 0, -8 - 6 * up)},
            'neck': {'r': (6 * up, 0, 4)},
            'head': {'r': (8 * up - 3, 0, 5 + 4 * up)},
        }
        grip = (-0.035 + 0.02 * up, -0.02 - 0.03 * up, 1.145 + 0.035 * up)
        forward = (0.52 + 0.1 * up, -0.72, -0.46 + 0.75 * up)
        upper(arm, pose, grip, forward, (0.28, -0.32, 0.9))
        pose['hand_ik.L'] = {'d': hand}
        clip.key(frame, pose)
    clip.finish(1, 50)


def death(arm):
    """She takes the hit in the chest, knees go, drops onto her side. Keys both layers.
    The rifle stays pinned to her chest. Aimed in armature space it would hang in the air at the end."""
    clip = Clip(arm, 'death')
    held = ready_pose(arm)['rifle']
    keys = (
        (1, -0.06, (0, 0, 0), 0, 0),
        (7, -0.10, (-14, 6, 8), -8, 0.08),
        (16, -0.34, (-22, 18, 16), -14, 0.18),
        (26, -0.56, (-48, 46, 22), -16, 0.28),
        (34, -0.64, (-84, 72, 26), -20, 0.33),
        (44, -0.64, (-86, 76, 28), -24, 0.34),
    )
    for frame, h, r, chest, back in keys:
        pose = {}
        pose.update(hips(h, 0.0, back, r))
        pose['spine'] = {'r': (chest * 0.5, 0, 0)}
        pose['chest'] = {'r': (chest, 0, 0)}
        pose['head'] = {'r': (chest * 0.5, 0, 0)}
        drop = min(1, frame / 26)
        pose.update(feet({
            'L': FOOT['L'] + Vector((0.04, 0.05 - 0.22 * drop, 0.0)),
            'R': FOOT['R'] + Vector((-0.04, 0.10 + 0.12 * drop, 0.0)),
        }, {'L': (-26 * drop, 0, 18 * drop), 'R': (-12 * drop, 0, -24 * drop)}))
        pose['rifle'] = held
        clip.key(frame, pose)
    clip.finish(1, 44)


def build(arm):
    lower_body(arm)
    upper_body(arm)
