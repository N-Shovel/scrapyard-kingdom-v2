# T21: Lean assets, one glass pass gone, no shadows for unseen enemies

**Status:** done
**Check:** `npm test` -> 28 pass. `npm run playtest` -> all 13 scenarios pass, long run median 9.4 ms. `npm run build` passes, `static/` 28 MB (was 34), `dist/` 33 MB (was 39).
Before and after, same yards (seeds 101, 202, 303), the old build rebuilt from the old manifest in a copy:

| | Before | After |
|---|---|---|
| Download at start | 32.0 MB, 139 files | 25.8 MB, 116 files |
| Texture memory (estimate, w x h x 4 x 4/3) | 939-955 MB, fight 1227-1243 MB | 722-726 MB, fight 918-922 MB |
| Map view | 401-411 draws, 5.9-6.1M tris, 5.9-6.8 ms | 246-250 draws, 3.5-3.7M tris, 2.1-3.1 ms |
| Fight view, round 1, 17 structures | 441-572 draws, 5.8-6.2M tris, 7.2-9.1 ms | 276-358 draws, 3.6-3.8M tris, 4.2-6.0 ms |
| 63-67 enemies, round 6 mix | 665-791 draws, 16.6-25.0 ms render | 374-430 draws, 9.5-12.2 ms render |
| Long run, median of runs (9 before, 10 after) | 12.1 ms, worst round 13.5-24.6 | 8.5 ms, worst round 7.8-15.1 |

## What exists now
- Removed, never placed by any code: `fire_hydrant`, `metal_tool_chest`, `plastic_crate_01`, `portable_welding_cart`, `stone_fire_pit`, the `rusty_corrugated_iron` set, and the sounds `shot_2`, `reload_first`, `metal_bing`, `loop_ambient`, `loop_machine`.
- Removed as repeats of a prop that stays: `car_vaz` (the heaviest car: 9 textures, 8756 tris), `metal_jerrycan_green` (1 copy, 2 other jerrycans), `rusted_wheel_rim_01` (rim 02 stays), `utility_box_01` (box 02 stays), `propane_tank` (`small_lpg_tank` stays), `power_box_01` (4248 tris for one wall box).
- Textures 1024 to 512: `tower_crane` (was 101 MB on the GPU), `flak_base` (123 MB), `tyre_heap`, `gantry_crane`, `water_tower`, `portable_generator`, `Barrel_01`, `concrete_road_barrier`.
- Maps nobody reads are not downloaded: `rust_coarse_01` color only, `cracked_red_ground` and `bitumen` color and normal.
- `portable_generator` and `covered_car` lose their glass and IOR extensions (`plain`).
- An enemy whose shadow cannot reach the screen skips the shadow pass.
- The four duplicate mob folders in `tools/.cache/sketchfab/` are deleted. The zips are still there, the user's call.

## Files
- `tools/assets.manifest.json`: entries gone, `size` and `plain` changed as above.
- `tools/optimize-assets.mjs`: `plain` also strips `KHR_materials_ior`.
- `src/Experience/sources.js`: textures are `{ set: [maps] }`, only maps the code reads.
- `src/Experience/World/Junkyard.js`: `WRECKS` and `LOOSE` without the removed models.
- `src/Experience/Actors/Enemy.js`: `meshes`, `setShadow(frustum, away, slope)`. `Enemies.js`: frustum per frame, `shadowAway`, `shadowSlope` from the sun.
- `CREDITS.md`: VAZ-2104 row gone.

## Interfaces other code uses
- `enemy.meshes`: its skinned meshes. `enemy.casting`: whether they are in the shadow pass now.
- `enemy.setShadow(frustum, away, slope)`: `away` is the unit vector a shadow falls along, `slope` is tan of the sun's elevation.

## Decisions and why
- The glass on `portable_generator` (KHR_materials_transmission) made three.js render every opaque object a second time for refraction whenever a generator was on screen: +2.4M triangles, +100 to 160 draws. That caused most of the gap between light and heavy yards. Found by listing visible materials with `transmission > 0`.
- Enemy shadows: with 62 of 66 enemies off screen, their shadow pass was 4 to 5 ms of a 14 to 17 ms render. The test sphere runs from the feet to the shadow's tip (height / tan 21 degrees, a drone's 6 m flight included), plus the body radius and 1 m, so no shadow is cut at the screen edge.
- Merging the raider's 6 parts into 1 draw was tried and measured: 524 to 339 draws, no clear change in time. The atlas is not worth it yet.
- Player (2048), Stash, cars and containers keep 1024: they are seen up close.

## Gotchas
- three.js makes a UUID with `Math.random` for every texture and mesh, so loading fewer assets shifts the world seed. To compare builds, force the yard: `world.newYard(seed)`.
- The long run sometimes leaves one enemy stuck and round 6 never ends (seen once: a brute at x 20.4, z 1, moving, no target). One run of the old build did not finish either, so this predates T21. Not fixed.
- The unread texture maps are still written to `static/` by the optimizer, so `dist/` ships them (0.4 MB, never downloaded).

## Not done
- `mob_hope` is one alpha-blended material (its glass dome), so the whole brute is drawn as transparent. Opaque was 1 ms faster in one test, but the dome would turn solid.
- Shadows are still the biggest single cost: about 40% of a fight frame, measured before T21 with 8 enemies on screen.
