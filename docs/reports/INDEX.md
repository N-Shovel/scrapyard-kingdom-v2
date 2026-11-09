# Task reports

Read this first in a new session. Details are in the linked report, code only if the report is not enough.

| Task | Done | Result | One line |
|---|---|---|---|
| [T01](T01-setup.md) | 2026-11-05 | done | Vite, Experience tree, playtest harness, skills, plugins |
| [T02](T02-assets.md) | 2026-11-05 | done | `optimize-assets.mjs`, 19.7 MB in `static/`, `sources.js` filled, every model checked in game |
| [T03](T03-player-rig.md) | 2026-11-06 | done with gaps | Arm bones, IK rifle, 22 clips reviewed with both layers on. Knee IK fixed after T06, knees bent backwards before |
| [T05](T05-grid.md) | 2026-11-05 | done | `Grid.js`, flow fields, footprints, `config.js`. 14 tests pass. Done before T04 |
| [T04](T04-world.md) | 2026-11-05 | done with gaps | Dusk yard: sky, splat ground, scrap bales, wrecks, container wall, Stash. No sign on the Stash yet |
| [T06](T06-player.md) | 2026-11-06 | done with gaps | Player: jog, walk, sprint, jump, slide, first and third person, layered clips, no foot slide. No turn-in-place step |
| [T07](T07-enemies.md) | 2026-11-06 | done with gaps | Rounds (tested), 4 enemy types with own clips and no skating, Stash damage, player down and respawn. Slow with many enemies |
| [T08](T08-build.md) | 2026-11-06 | done with gaps | Prep map, build and pick up with the mouse or the crosshair, turrets, flak, spikes, tar, mines, route arrows. No hotbar yet |
| [T09](T09-weapons.md) | 2026-11-06 | done with gaps | Shotgun, particles and tracers, cannon-es debris, scrap pickups, recorded sounds. Torch and loops removed after, repairs cost scrap on the map. No HUD yet |
| [T10](T10-ui.md) | 2026-11-06 | done with gaps | Title, site plan, parts tags, gauges, tally, shells, workshop with upgrades, pause, weighbridge tickets, game over. Pointer lock flows untested |
| [T11](T11-polish.md) | 2026-11-06 | done with gaps | Steel title sign on the crane, each fight falls to night with a flood, six-round bot run at 9 to 14 ms of work (median). Fixed junk sealing gates. Turret heads, post, ponytail left |
| [T12](T12-heads.md) | 2026-11-07 | done | Picked assets: CC0 turret and flak with their own mounts, welding cart and tool chest at the Stash. Long run median 9.9 ms |
| [T13](T13-finish.md) | 2026-11-07 | done with gaps | Mouse lock flows pass in headed Chrome, Patch up priced by missing health, CSS vignette and grain (no bloom), spring on the hair's `pony` bone |
| [T14](T14-feedback.md) | 2026-11-07 | done with gaps | User feedback: flak is Quaternius' launcher on the turret's ring, Esc out of the workshop resumes the fight, 14 new yard props and gear piles |
| [T15](T15-yard.md) | 2026-11-07 | done with gaps | No bales: flattened-car stacks and six single-cell pile types, 12 kinds of car, every prop option, Structure as the Stash, gravelly sand floor. Long run median 7.3 ms |
| [T16](T16-yard-fixes.md) | 2026-11-07 | done with gaps | User feedback: whole cars stacked square (no flattened ones), plank shed as the Stash, scrapyard backdrop behind the title, nothing floating, oil stains in bitumen, pixelated rubble gone |
| [T17](T17-sketchfab.md) | 2026-11-07 | done with gaps | CC-BY from Sketchfab, downloaded by the user: scanned wrecks, rusted containers, a house as the Stash (4 x 4 cells), Darwin turret, air defence flak, gantry and rusty board for the title. Long run median 7 to 12 ms |
| [T18](T18-finish.md) | 2026-11-07 | done | Credits sheet on the title (CREDITS.md, tested), README, `dist/` checked in Chrome, code graph in `graphify-out/` |
| [T19](T19-mobs.md) | 2026-11-09 | done with gaps | The user's four Sketchfab robots as the enemies (lunge and topple where a clip is missing), brute in one draw, yard record on the last ticket, Quaternius robots and unlicensed particles gone |
| [T20](T20-sign-letters.md) | 2026-11-09 | done | Title sign in its own plate letters, wrench Y, hammer I, nut O. Letters and board shot through and bitten, board baked into `title_sign.glb` |
| [T21](T21-lean.md) | 2026-11-09 | done | 11 models, 1 texture set and 5 sounds gone (unused or repeats), 4 unread maps not loaded, backdrop and flak textures at 512, generator glass that redrew the whole scene removed, no shadow pass for enemies out of view. Start download 32 to 25.8 MB, long run median 12.1 to 8.5 ms |

**Next up, in this order:**
1. The user's feedback on the new enemies in play: the raider's foot slide, the scuttler's speed, the lunge and the topple (T19).
2. For the user: listen to the sounds once, and play a few rounds by hand to judge the Stash and going down (see T13).
3. The user's look at the new title sign (`tools/.playtest/ui_title.png`, T20).
4. If the user agrees: delete the downloaded zips in `tools/.cache/sketchfab/` (about 0.9 GB, local only, already unzipped beside them). The duplicate mob folders are gone (T21).
5. One enemy sometimes gets stuck in the long run and round 6 never ends (T21 Gotchas). Predates T21.
6. Shadows are the next cost to cut (T21 Not done).

**Known state:**
- `npm test` (28 tests) and `npm run playtest` (13 scenarios) pass. Long run median 7 to 10 ms of work per fight frame (T21), noisy.
- The whole loop plays from the title: build on the map, G, click to aim, fight, collect scrap, workshop, next round, game over ticket.
- No health regen, by the user's choice.
- Asset options are in `tools/.playtest/future-asset/`, one README per folder, model files in `tools/.cache/candidates/`. In use: the prop options minus the repeats T21 removed (T14, T15, T21), `gravelly_sand` as the floor (T15). Since T17 cars, containers, Stash, turret, flak and the title come from Sketchfab (CC-BY), see T17. Since T19 the enemies too.
- The code graph is in `graphify-out/` (T18). Query it with `/graphify query`, rebuild with `/graphify src --update`.
