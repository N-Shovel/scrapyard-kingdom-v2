# T16: Whole cars, a shed for the Stash, a title backdrop, nothing floating

**Status:** done with gaps
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, long run fight frame work 6.3 to 8.6 ms per round, median 8.1 ms. `npm run build` passes. The title, the Stash from four sides, the site plan, oil stains and six piles at eye level are in `tools/.playtest/look/`, and were looked at.

## What exists now
- The user's feedback on T15: flattened cars looked squished, the Stash looked weird, the title background was dull, many things floated or sat oddly, and the black spots on the ground looked like pixelated waste.
- No flattened cars. A two-cell pile is one whole car, often with a second stacked square on its roof, now and then a third. A car alone may lie on its side or on its roof, never tilted on nothing.
- The Stash is Quaternius' plank shed with a tin roof, door to the front. The workshop props stand on the ground around it. Nothing is fixed to its walls.
- The title looks out of the North gate down a clear lane. Behind the sign, rows of stacked cars, container stacks and tyres fill the ground to the hills.
- Oil stains are drawn with Poly Haven's `bitumen` texture, blended at 70%, with frayed edges from a 2048 mask. Fewer of them.
- The pixelated rubble (Quaternius Debris Pile) is gone. A junk heap is a smashed barrier, chain-link lying flat, pipes and loose bits.

## Files
- `World/Junkyard.js`: `car(x, y, z, along, pose)` (`'wheels' | 'side' | 'roof'`), `wreckPile`, `junkHeap`. Loose items on top stay within 0.2 m of the middle and nearly flat. Stacked crates are square on each other.
- `World/Fence.js`: `carStack`, `tyres`, `setBackdrop` (5 rows north of the wall, a lane out of the North gate, clear of the crane's posts).
- `World/Stash.js`: `storage_shed` at `[2.5, 3.2, 2.5]`, `YAW` `Math.PI`.
- `World/Ground.js`: `MASK_SIZE` 2048, `uOil`, `uOilNormal`, frayed oil edge.
- `tools/assets.manifest.json`, `sources.js`, `JunkLibrary.js`, `CREDITS.md`.

## Interfaces other code uses
- `stash.position`, `width`, `pump`, `lamp` unchanged. `stash.front` from T15 is gone.

## Decisions and why
- A stacked car sits 0.3 m into the one below, square to it (yaw within 0.12 rad), so its floor rests on the roof and its wheels hang past it. Any turn or offset left wheels in the air.
- The shed comes 0.76 m tall. Stretched to 3.2 up, its door fits her. Across, 2.5 fills the two Stash cells.
- Picked from 16 CC0 buildings on Poly Pizza (a contact sheet was made). The rest were houses, barns, towers or sci-fi pods.
- Wall-mounted props (aircon, power box, lamps) were floating because no wall stood where they were placed. They stand on the ground now.
- Dropped: `structure` (the T15 Stash), `debris_pile`, `street_lamp_02` (a Victorian lantern, out of place).

## Gotchas
- The site plan's dark blocky smudges were the Debris Pile model, not shadows: they stayed with the shadow map off.
- Triangle counts in `world` swing between 2.8M and 5.4M with the seed and the view. The long run's measured work is the number to trust.

## Since then
- T17 replaced the cars, containers, shed, turret, flak and the title gantry with Sketchfab models. See T17.

## Not done
- No CC0 oil stain decal exists on Poly Haven or ambientCG. The stains are the bitumen texture in the ground shader.
- Enemies still unchanged.
