# T12: Gun heads and workshop props

**Status:** done
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, new shot `build_flak.png`. Long run fight frame work 8.7 to 11.1 ms per round, median 9.9 ms (T11: 9.0 to 14.3). `npm run build` passes. Looked at `build_close.png`, `build_flak.png` and close-ups of both heads and the Stash taken by a throwaway scenario.

## What exists now
The user let me pick from `tools/.playtest/future-asset/`. The turret is Quaternius' twin Turret Gun on the ring it came with, sitting on the ground. The flak is Kenney's four-barrel Double Turret on its own post, bolted to an old military crate. Both are rusted and grimed by `applyRust` and tinted per structure. The Stash has a welding cart by the door and a tool chest on the left wall, both Poly Haven. Enemies, the Stash shack itself and the ground were left as they were.

## Files
- `tools/assets.manifest.json`: `turret_gun`, `turret_gun_base`, `turret_double`, `turret_double_base` (Poly Pizza, each with `part`), `metal_tool_chest`, `portable_welding_cart` (Poly Haven, `keep` 0.2).
- `tools/optimize-assets.mjs`: `part` on a Poly Pizza entry keeps only that node's mesh, so one file gives a head and a base as two models.
- `Combat/createStructureModel.js`: `GUN_SCALE` 1.4, `FLAK_SCALE` 1.4. The base is in `batch`, the head is its own `JunkBatch` inside `barrels`, so it turns, tilts and kicks back.
- `Game/config.js`: turret `height` 0.9, flak 1.5, to match the models. `world.heightAt` uses it for shots and the camera.
- `Combat/Structures.js`: `destroy` clears `model.gun` too.
- `World/JunkLibrary.js`: rust looks for both heads and both bases. `World/Stash.js`: the two props.

## Interfaces other code uses
- `structure.model.gun`: `JunkBatch` of the head, only on turret and flak. Since T17 both are Sketchfab models with `model.yoke` on the flak, see T17. Everything else from T08 is unchanged: `head` turns, `pitch` tilts (flak), `barrels` kicks, `muzzle` is the tracer start.

## Decisions and why
- Twin gun for the turret, four barrels for the flak, as first picked in the asset README. The four barrels read as anti-air at a glance.
- Each head on its own base. The first try kept the junk bases (tyres and a barrel, a utility box) and the user found a gun on a barrel weird and the flak floating over its box.
- The whole flak head tilts about its middle, right over the post. The post's top stays inside the head at every angle, so nothing shows a gap.
- Kenney's head comes yellow and white. Multiplied by `#5f5a4c` and rusted at 0.75 it reads as worn yard machinery, not a toy.
- The twin gun turns about its post, 0.22 m behind its middle. The placement offsets `z` by that much.
- Welding cart and tool chest because the Stash is the workshop where upgrades are bought.

## Gotchas
- Rust is offset by the instance's translation. Every head sits at the same spot in its own batch, so every turret has the same rust pattern.
- `structures.place(type, i, j, rotation, hp)` takes the cell, not a cells array. A wrong call puts NaN in the camera and the audio listener throws.
- Kenney's file sits at (-2, -1.5). `JunkBatch.place` centers by bounding box, so that does not matter.

## Not done
- Balance after removing regen, post effects and a spring on the ponytail: done in T13.
- The other options (mobs, Stash huts, junk props, ground) are not used. The current ones already work with their clips and look.
