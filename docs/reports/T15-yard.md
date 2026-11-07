# T15: No bales, more cars, every prop, new Stash and ground

**Status:** done with gaps
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, long run fight frame work 6.5 to 8.4 ms per round, median 7.3 ms (T14: 9.3). `npm run build` passes. Views of the Stash, the yard from above and five piles at eye level are in `tools/.playtest/look/`, and were looked at.

## What exists now
- The user's request: use every prop option, add more kinds of car and wreck them, get rid of the scrap bales (the "squished square box"). Their two pictures picked the `gravelly_sand` ground and Quaternius' Structure from the Stash options.
- No bales anywhere. A two-cell pile is a stack of three or four flattened cars, or a wreck dropped on a flat car or on the ground, sometimes with a second on top. A single cell is a tyre stack, a barrel group, a gear pile, a crate stack (rack or shelf behind), a junk heap (rubble mound, smashed barrier, chain-link, pipes) or a skip with bags.
- 12 kinds of car: the 6 from before plus a second Quaternius car, sports car, police car and taxi, and Kay Lousberg's hatchback and station wagon. A police car and a taxi keep their own colours under the rust, the rest get what is left of a paint job.
- All 28 prop options are in, except the two Stash-only ones, which were already at the Stash.
- The Stash is the blue industrial block with a chimney, dimmed and rusted, its back on the back of the Stash cells. The strip in front of it is the workshop yard.
- The floor is gravelly sand. The gravel and red ground still splat in.
- Single gaps in the border wall get a skip or a dumpster. Outside, flattened cars, rubble mounds and a power line on the south and west sides.

## Files
- `World/Junkyard.js`: `WRECKS` (with `keep`), `LOOSE`, `MACHINES`, `LITTER`, `CRATES`. `junkPile`, `crushed`, `wreckPile`, `crateStack`, `junkHeap`, `skipPile`, `pick`.
- `World/Fence.js`: border gaps, `setOutside`, `setPoles` (`POLE_EVERY` 13 m).
- `World/Stash.js`: rewritten around `structure`. `World/Ground.js`: `gravelly_sand`.
- `World/JunkLibrary.js`: bales gone, rust looks for the new Quaternius and Kay Lousberg models. `createBaleGeometry.js` and `createBaleTexture.js` are deleted.
- `tools/optimize-assets.mjs`: a Poly Haven entry takes `part` (keep only nodes whose name starts with it, for kits) and `error` (simplifier tolerance).
- `tools/assets.manifest.json`, `sources.js`, `CREDITS.md`.

## Interfaces other code uses
- `stash.position`, `width`, `pump`, `lamp` are unchanged. New `stash.front`: the building's front wall, in the Stash's own frame.
- Junk heights per cell are still in `junkyard.heights`.

## Decisions and why
- Crushed cars are the car models at a third of their height. From every side they read as flattened cars, not boxes, and need no new asset.
- Kits come as parts: `modular_electricity_poles` keeps `preset_01_` (a pole with its transformer), `modular_chainlink_fence` keeps one double panel, `wooden_barrels_01` one barrel.
- `steel_frame_shelves_01` comes ten times too big and is placed at 0.1.
- `plastic_crate_01` stays near 10k triangles at any setting, so it stands only at the Stash, twice.
- Dropped because nothing loads them now: textures `dirt`, `gravel_road`, `green_metal_rust`, `corrugated_iron_02`, `worn_corrugated_iron`, `rusted_shutter`, and models `rollershutter_door` and `street_lamp_01` (the Victorian lamps looked wrong in a scrapyard).
- Cars came only from Poly Pizza's CC0 models. Everything named wrecked or rusty there is CC-BY, or CC0 in name only on other sites. The wreck look is ours: rust shader, faded paint, flattened, tipped, stacked.

## Gotchas
- The first build had 6M triangles. Lighter tyres (576), torch, security light, crates, ammo box and fewer tyres per stack brought it back. `tricount` (a throwaway) counted placements times parts per batch.
- `hand_truck`, `industrial_storage_cart` and the poles do not simplify below 5k to 6k. Few of them stand in a yard.
- The rAF frame time in `world` and `rounds` reads 12 or 18 ms by luck of the 165 Hz display. The long run's measured work is the number to trust.
- The power poles stay off the north side, where the title looks.

## Since then
- T16 replaced the flattened cars with whole stacked cars, the Structure with a plank shed, and dropped the Debris Pile and the wall lamps. See T16.

## Not done
- No ground or hut options other than the two the user picked. No mobs.
- Piles are lower than the bales were in places. The site plan still reads, but the user should judge the maze from above.
