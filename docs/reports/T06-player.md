# T06: Player controller, cameras, layered animation

**Status:** done with gaps
**Check:** `npm run playtest -- player` -> 15 runs (jog, walk and sprint, every direction and diagonal): planted foot moves 0 m/s in all of them, lifted foot 2.7 to 7.2 m/s, so the measurement sees motion. Collision run ends on an open cell. Jump reaches 1.04 m, slide starts. Rifle stays within 0.55 degrees of the look at pitch -0.6, 0.5 and 1. 11 view screenshots looked at. Full `npm run playtest` passes, world median 6.1 ms.

## What exists now
She stands two cells south of the Stash. WASD jog, Shift sprint, right button aim (slow walk), Space jump, C slide while running, V switches first and third person. Click the canvas to take the mouse. Gaits are retimed in Blender for the game speeds.

## Files
- `Actors/Player.js`: input, movement, jump, slide, collision, facing, `setView`.
- `Actors/PlayerAnimation.js`: one mixer, lower and upper layer, shared gait phase, look pitch on spine and chest.
- `Actors/PlayerArms.js`: first person copy on the camera, arms and rifle only, drawn in front of everything.
- `Camera.js`: modes `third`, `first`, `free`. Shoulder camera with grid collision.
- `World/World.js`: creates the player, `heightAt(x, z)`.
- `tools/blender/clips.py`: `run_*` and `sprint` strides changed, see T03.
- `tools/blender/rig.py`: IK pole angle in armature space, knee poles far ahead. Knees bent backwards before, see T03.

## Interfaces other code uses
- `world.player`: `position`, `velocity`, `yaw`, `pitch` (camera), `bodyYaw` (model), `speed`, `onGround`, `aiming`, `aim` (0..1 eased), `sprinting`, `sliding`, `eyeHeight`, `model`, `clips`, `spawn()`, `setView(mode)`.
- Forward is `(sin yaw, 0, cos yaw)`, right is `(-cos yaw, 0, sin yaw)`. Camera rotation is `(pitch, yaw + PI, 0)`, order YXZ.
- `player.animation`: `actions[name]`, `weights[name]`, `blend.{air, jump, slide, carry, dead}`, `phase` (0..1), `land()`, `slide()`, `hurt()`, `die()`, `revive()`.
- Health (T07): `player.hp`, `alive`, `takeDamage(n)`, `die()`, `respawn()`. See T07. T10 added `maxHp` (getter, with upgrades), `heal(n)`, `useMedkit()` on H, `patching` (seconds of a medkit left).
- T10: she only takes keys in `first` and `third`. The canvas click that took the mouse is gone, the Ui's plates lock it now.
- `player.arms.holder`: Group on the camera. `arms.sights`, `arms.hip`: eye points in model space.
- `camera.setMode('third' | 'first' | 'top' | 'free')`, `top` is the prep map (T08). Scenarios that place the camera by hand call `setMode('free')` first.
- `world.heightAt(x, z)`: top of a pile, structure or wall at that point, 0 on open ground, 6 outside or on the Stash.
- Config: `PLAYER.walk` 2.6, `back` 0.7, `crouchSlide` 7.5, `slideDrag` 5.
- Bone names lose their dots in three.js: `footL`, `upper_armR`.

## Decisions and why
- Direction weights are `(speed along a direction / that clip's stride)`, normalized. Then the blended feet move exactly at body speed, diagonals too. Gaits mix by speed, walk to jog to sprint, and the cycle rate is the harmonic mean over gaits.
- Sprint and slide turn the body to the run direction. The sprint clip only goes forward, so this beats a sideways sprint blend.
- First person always plays `up_aim`. `up_ready` points the rifle out of view. Hip is an eye point measured on that pose. The sights point follows the red dot window (`OPTIC`, measured from the Rifle mesh's vertices) every frame, so breathing never moves it off the screen center (was 11 px left, 13 px low). Sprint tilts the holder around the eye.
- The arms copy squeezes its depth into the first tenth of the depth range in its vertex shader. One pass, real lighting and shadows, and no rifle in the wall. A second render pass would redraw the sky and the shadow map.
- In first person the world copy keeps casting a shadow: `colorWrite` and `depthWrite` off.
- Velocity is set to what the position really did after collision. Running into a pile gives speed 0, so the legs stop.

## Gotchas
- The mixer only writes a bone when its animated value changes. The look bend is undone before `mixer.update` and saved after, or it piles up.
- Gait actions, `up_carry`, `jump`, `land` and `slide` have `timeScale = 0`. Their time is set each frame, the mixer's clock never moves them.
- `slide` plays once from `animation.slide()` and holds its last pose. Looped, it jumped back to the higher entry frame and popped the hips 15 cm up mid slide. The `player` scenario asserts under 2 cm per frame.
- The playtest `hold()` turns collisions off and freezes `player.update` for the screenshot, `thaw()` undoes it. A frozen player still renders.
- Camera collision is per cell. A pile that spills past its cell edge can still clip the near plane.

## Not done
- Turning on the spot rotates the planted feet with the body. Needs a turn-in-place step, maybe in T11.
- No crosshair or HUD (T10). No shooting, reload or torch in the controller yet (T09).
- Top-down camera: done in T08.
- Pointer lock and mouse look were not driven in the playtest. The scenario sets `pitch` directly.
