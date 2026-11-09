# T17: Realistic cars, Stash, guns and title from Sketchfab (CC-BY)

**Status:** done with gaps
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, long run fight frame work 8.6 to 14.6 ms per round, median 11.8 ms (another run: 7.1 ms; it swings with the machine). `npm run build` passes, `static/` 32 MB. The title, the guns, the Stash and piles were looked at in `tools/.playtest/look/`.

## What exists now
- The user found the low-poly cars AI-looking and chose CC-BY. They downloaded 19 Sketchfab models by hand. The zips were moved from the desktop into `tools/.cache/sketchfab/<id>/` and unzipped there. A duplicate "crashed_abandoned_car (1).zip" is still on the desktop.
- Cars: 9 scanned or game-ready wrecks plus Poly Haven's covered car. They are used in the piles, on the wall, outside it and as the Car wreck structure. All Quaternius cars are gone.
- Walls: a rusted shipping container replaces the Quaternius one, in the border, the backdrop and the Container structure.
- Stash: Erroratten's post-apocalyptic house, with nothing else placed around it (the user asked). The Stash is 4 x 4 cells now (`config.STASH_CELLS`), or its door would be shorter than her.
- Turret: seangorman's Darwin auto cannon, cut at its neck. The housing turns on the column. Flak: CG Lads' air defence unit. The chassis stays, the yoke and sensor turn, the cannon tilts.
- Title: speedtwo's gantry stands over the lane out of the North gate. The letters are on matousekfoto's rusty board, which hangs below the hoist's hook on chains that reach the beam. Behind it: rows of wrecks, containers and tyre heaps, a rail crane, a tower crane and a water tower.

## Files
- `tools/optimize-assets.mjs`: `gltfModel` (was `polyhavenModel`) takes `part` and `drop` (regex on node names), `turn` (degrees about Y), `cut` ({ at, keep } by triangle height) and `plain` and `twoSided`. Sketchfab entries can share one download through `from`.
- `tools/assets.manifest.json`: `sketchfab` section, 22 entries.
- `World/JunkLibrary.js`: `scaleFor(name, length)`. `World/Junkyard.js`: `WRECKS` with `length`. `World/Fence.js`: `container()`, `wreckScale()`, `tyres()` (the tyre heap), `setBackdrop`, `setCrane` (the gantry).
- `World/TitleSign.js`: `hang`, `above` (`setBoard` gone in T20, the board is baked into the sign). `World/Stash.js`: the house. `Game/Grid.js`: the Stash square from `STASH_CELLS`.
- `Combat/createStructureModel.js`: `mount`, `piece`, the turret and the flak. `Combat/Structures.js`: also clears `model.yoke`.
- `CLAUDE.md`, `.claude/skills/assets/SKILL.md`, `CREDITS.md`: CC-BY is allowed with a full credit line. Every Sketchfab model is credited.

## Interfaces other code uses
- `config.STASH_CELLS` 4. `grid.stashCells` holds 16 cells, from the north-west corner row by row. `stashCells.at(-1)` is the south-east one.
- `stash.position`, `width`, `lamp`. `stash.pump` is gone, nothing used it.
- `fence.crane` keeps its shape `{ x, z, yaw, top, along(meters, y) }`, now for the gantry.
- `structure.model.yoke`: the flak's turning `JunkBatch`. `model.pitch` tilts only the cannon.

## Decisions and why
- Sketchfab exports set every material two-sided, and add a specular extension that makes three.js build `MeshPhysicalMaterial`. With them the long run took 18.6 ms. With `plain` it is back under budget.
- Cars are scaled to a length in meters, because the downloads come in centimetres, inches or tenths. Some came turned (sedan_b by 62 degrees). Their long axis was measured (PCA of the body) and `turn` lines it up with z.
- The Darwin turret is one mesh. `cut` at half its height splits it at the neck. Base and head stay in the file's frame, so the head turns where the column is.
- The sign hangs under the hook, not across it. The chains are stretched to whatever is above them, found by rays, so they never end in the air.
- Container door rods, VAZ hub caps and the heaviest pipe piece are dropped: each was thousands of triangles nobody sees.

## Gotchas
- Raycasting the hook needs a scan: a single ray from the board's middle missed the hook and hit the beam.
- The rusty board is two-sided (`twoSided`). It is a thin panel.
- `world` and `rounds` read the rAF interval, 12 or 18 ms by luck of the 165 Hz display. The long run's work number is the one to trust.

## Not done
- No in-game credits screen. CC-BY credit is in `CREDITS.md` only.
- "Crashed Abandoned Truck" was never downloaded, so it is not in the manifest.
- Backdrop repeats a van now and then.
