# T03: Player rig and clips

**Status:** done with gaps
**Check:** `npm run playtest -- clips sleeves` -> all 17 clip pairs rendered with both layers on, in `tools/.playtest/clip_*.png`, and looked at. Sole stays within 3 cm of the ground in every gait. Knee direction checked at 16 moments of every leg clip: worst 0.75 (sprint), 1 is straight forward. Build: `blender -b --python tools/blender/build_player.py`, 598 arm faces, 1644 body faces, 22 actions.

## What exists now
The source model had no arm bones. The script adds them, weights the sleeves and gloves, splits those into an `Arms` mesh, frees the rifle on its own bone with IK hands, and authors 22 clips from foot paths and offsets. After `optimize-assets`, each clip holds only its own layer's tracks, so a lower and an upper action just play together.

## Files
- `tools/source/player_source.glb`: the Blender asset from the old game. Do not edit.
- `tools/blender/rig.py`: bones, weights, split, IK. Arm joint positions are at the top.
- `tools/blender/pose.py`: keyframing in armature axes, `rifle_pose()`.
- `tools/blender/clips.py`: every clip. Gait parameters are in `lower_body()`.
- `tools/blender/build_player.py`: entry point, `--preview`, `--no-export`.

Blender: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"`, not on PATH. After a rebuild run `npm run assets:optimize -- player`.

## Interfaces other code uses
- Meshes: `Body`, `Arms`, `Hair` (skinned, `Hair` on `head` and `pony` since T13), `Rifle` (rigid on `rifle` bone), plus rigid accessories. Empty `muzzle` under `rifle`.
- Model faces +Z in three.js. Height about 1.71.
- Lower clips, bones `root hips spine thigh.* shin.* foot_ik.* foot.*`:
  `idle`, `walk_{f,b,l,r}`, `run_{f,b,l,r}`, `sprint`, `jump`, `fall`, `land`, `slide`
- Upper clips, bones `chest neck head upper_arm.* forearm.* hand.* rifle`:
  `up_ready`, `up_aim`, `up_carry`, `up_torch`, `up_reload`
- Additive, run through `makeClipAdditive`, upper bones only: `up_fire`, `hurt`
- Full body: `death`
- 30 fps, time starts at 0. Gait clips are loops starting on left foot contact.

Stride per full cycle, in meters, for speed sync. Natural speed = stride / duration. Run and sprint were lengthened in T06 for the game speeds, `STRIDE` in `PlayerAnimation.js` must match:

| Clip | Duration s | Stride |
|---|---|---|
| walk_f | 1.067 | 1.45 |
| walk_b | 1.067 | 1.15 |
| walk_l, walk_r | 1.067 | 1.0 |
| run_f | 0.733 | 2.9 |
| run_b | 0.733 | 2.2 |
| run_l, run_r | 0.733 | 2.1 |
| sprint | 0.6 | 3.9 |

## Decisions and why
- Rifle scaled to 0.82 about the grip. At full length the left hand cannot reach the handguard while shouldered, arms total 0.39.
- Aim pose blades the chest 28 degrees so the left shoulder comes forward.
- Whole sleeve islands are classified as arm or torso. The body is 401 small islands, so per-vertex rules would tear patches.
- `ik_tgt.*` bones exist because `shin.L` runs past the ankle in the source. IK aiming at `foot_ik` would bend the rest pose.
- Blender bakes bones a clip does not key at whatever the last built clip left them at. `optimize-assets.mjs` drops those tracks by bone name, and tracks that only repeat the rest pose.
- The rifle is pinned to the chest during `death`. Aimed in armature space it hung in the air.

## Gotchas
- Blender's default 24 fps slowed every clip by a fifth against the numbers above, and frame 1 exported as time 1/24, causing a hitch at each loop. Both fixed in `build_player.py`.
- A Blender `--preview` shows the other layer in a leftover pose. Trust the `clips` playtest scenario instead.
- `up_*` clips do not touch `spine`, so bending the chest at runtime for look pitch moves the rifle with it. T06 checked: under 1 degree off.
- Fixed after T06: every knee bent backwards in every clip. `pole_angle()` mixed `Bone.head` (relative to the parent) with armature-space positions, so the leg poles were 163 and 189 degrees off and the arm poles 60 to 80. The side-view clip sheets did not show it. The `clips` scenario now asserts every bent knee points forward.
- Fixed after T06: the source's knee poles sat 0.45 m ahead of the hips, where a high sprint swing lines the foot up with them, and the knee turned 24 cm sideways. `rig.py` moves them 1.5 m ahead of each knee.

## Not done
- The elbow point in `up_aim` from T03 came from the twisted arm IK. After the fix `sleeves_up_aim.png` looks clean, but nobody has looked at it close up in game.
- Skating is measured in T06: 0 m/s on a planted foot in every gait.
