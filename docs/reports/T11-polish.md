# T11: Polish, title sign, day to night, long run

**Status:** done with gaps
**Check:** `npm test` -> 26 pass, 1 new: gates and the cell inside each stay open over 300 seeds (failed before the fix). `npm run playtest -- long` -> six rounds by a bot that places its stock at random, buys an upgrade, and kills what comes near the Stash or her. No errors, every round ends, the Stash held. Frame work in the fight (update plus render, waited out with `gl.finish`): median per run 9.0 to 14.3 ms over 5 runs, under the 16.7 ms of 60 fps. The worst round reached 17.1 ms once, so there is little headroom. `night` -> lamps off by day, on at night. Full playtest passes, 13 scenarios. Shots `night_*.png`, `ui_title.png` and three points of the title drift looked at.

## What exists now
The title looks through the North gate at the yard's name, cut from steel in the stencil face and hung from the crane on two chains, swinging a little. The crane stands on columns now, it used to float. Prep is by day. Each fight falls toward night over 100 s, the crane's flood and the Stash lamp come on with a stutter, and the day comes back with the new yard.

## Files
- `tools/blender/build_sign.py`: the sign. Since T20 its own letters and the board, see T20. Meshes `Letters`, `Tools`, `Grip`, `Board`, `Chains`.
- `tools/optimize-assets.mjs`: `built(name)` for geometry-only glbs built in Blender.
- `World/TitleSign.js`: hangs it under the crane's bridge, rust materials, the swing, `middle` for the camera.
- `World/Environment.js`: `dusk` (0 day, 1 night), `setDusk`, `update(delta)`. `World/Floodlights.js`: the crane's searchlight and flood, the Stash lamp.
- `World/Fence.js`: the crane's columns and runways, `fence.crane`.

## Interfaces other code uses
- `fence.crane`: `{ x, z, yaw, top, along(meters, y) }`. `along` gives a point under the bridge, meters from its middle.
- `environment.dusk`, `environment.target()` (title 0.45, prep 0, fight `elapsed / NIGHTFALL`). Tests override `target`.
- `floodlights.flood` (SpotLight, decay 0, range 125), `stash.lamp`. `config.NIGHTFALL` 100.
- `titleSign.middle`: world point at the middle of the letters.

## Decisions and why
- Night is the fight getting longer, not the round number, so every round has the same rhythm: plan by day, fight into the dark.
- Two lights only. The flood has no distance falloff, so the far side of the yard is not black.
- The sign is built in Blender because three's `TTFLoader` pulls opentype.js from a CDN at run time. Blender reads the Fontsource woff directly.
- It hangs below the trolley: beside it, the trolley covered the end of Scrapyard from every angle.
- The title camera stays at eye height between the gate's posts. Higher, the letters sat on grey ground. Wider, a post crossed the sign.
- The bot run measures work per frame, not the rAF interval: on this 165 Hz display 12.8 ms of work shows as 18.2 ms.

## Gotchas
- Found by the long run: a junk cluster's random walk could step onto a gate. Every enemy from that gate spawned inside junk and stood there, and the round never ended. `placeJunk` skips `grid.reserved` now. Yards for a given seed changed with it.
- A fight frame draws about 3.4 million triangles, a third of them in the shadow pass. That is where the time goes, not the lights.
- The playtest's clip sheets set `scene.fog = null`, so `setDusk` checks for fog.

## Not done
- Turret and flak heads: done in T12.
- Post effects, the hair spring and balance without regen: done in T13.
