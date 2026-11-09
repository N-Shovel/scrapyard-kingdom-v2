# T20: Own letters for the title sign, shot and bitten

**Status:** done
**Check:** `npm test` -> 28 pass. `npm run playtest` -> all 13 scenarios pass, long run median 11.0 ms of work per fight frame. A first full run failed `weapons` once. It passed on its own right after, and on a second full run (message not kept). `ui_title.png` and a crop of the sign were looked at.

## What exists now
- The user asked for custom letters, a hammer and a wrench, and bullet holes or bites on the letters and the billboard.
- The sign no longer uses a font. Its heavy capitals were drawn for it, cut like plate with a torch: angled corners, edges a little crooked, each letter welded on a little out of line.
- The Y is an open-end wrench, the I is a claw hammer with a red grip, the O is a hex nut.
- Bullet holes go through letters C, A, D, G and M, and the board behind each hole is shot too. Bites are taken out of S, the second R, K and M. The board has a burst of cannon holes, a few strays and three bites out of its edges.
- The board is matousekfoto's scan, cut in Blender and baked into `title_sign.glb`. The game no longer loads it on its own.

## Files
- `tools/blender/sign_glyphs.py`: plain Python. Each glyph is an outline and a list of add or cut steps. Also has `hole()` and `bite()`, the outlines of the damage.
- `tools/blender/build_sign.py`: makes meshes from the glyphs with exact booleans. It sets the letters, adds damage from `DAMAGE`, `BOARD_HOLES` and `BOARD_BITES`, then fits the scanned board and adds the chains.
- `World/TitleSign.js`: has paint for `Letters`, `Tools`, `Grip` and `Chains`. The board keeps its texture with a `BOARD_TINT`. `setBoard` and the JunkBatch board are gone.
- `tools/optimize-assets.mjs`: `built()` now makes textures 1024 WebP. Sketchfab entries with `into` are skipped.
- `tools/assets.manifest.json`: `billboard_rusty` has `"into": "title_sign"`, so it is only a source.

## Interfaces other code uses
- `title_sign.glb` meshes: `Letters`, `Tools` (wrench, hammer head and handle, nut), `Grip`, `Board` (2 primitives, textured, two-sided) and `Chains`. `Bars` is gone.
- `titleSign.middle` and `hang()` work as before. `hang()` measures `Board` now.

## Decisions and why
- Glyphs are add and cut steps, joined with Blender's exact boolean. Overlapping strokes would z-fight on their front faces if only joined.
- The board is baked into the sign, so holes stay round and line up with the letters' holes. Before, the board was scaled in three.js, which stretches.
- Rebuild: `blender -b --python tools/blender/build_sign.py`, then `npm run assets:optimize -- title_sign` (about 15 s).
- The torch-cut wobble is a smooth sine of x and y. The front and back faces move together, and holes keep their shape.
- Tools are painted worn steel, `#8a8f90` with metalness 0.7. At `#5a5e60` the wrench disappeared into the board. Near white, they looked too new.

## Gotchas
- Imported glTF objects rotate by quaternion, so setting `rotation_euler` does nothing. The final turn is a `data.transform`.
- The scanned board is open, with 3800 boundary edges. Its booleans need `use_hole_tolerant`.
- The scan's colour maps are 8k JPEGs (52 MB). The script cuts them to 2048 before export.
- `static/models/billboard_rusty.glb` was deleted. The optimizer no longer writes it.

## Not done
- No petals or dents around the holes. The front rim of each hole is pressed in a little, so it catches light.
- The letters are one colour. Painting each letter as a different scrap plate would be easy with vertex colours.
