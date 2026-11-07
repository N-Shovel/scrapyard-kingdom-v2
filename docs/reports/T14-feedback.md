# T14: Flak on its own ring, Esc out of the workshop, more yard props

**Status:** done with gaps
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, long run fight frame work 7.3 to 9.8 ms per round, median 9.3 ms, 290 draw calls (265 before). `npm run build` passes. A throwaway headed-Chrome script: Esc closes the workshop, the browser drops the lock, the game waits under Take aim, one click locks again and fires no shot. Close-ups of the flak and the gear piles are in `tools/.playtest/look/`.

## What exists now
- The user's feedback: the flak's base did not fit its body, Esc in the workshop also paused the game, and they want more of the yard's prop options in the game to judge.
- The flak is Quaternius' Turret Cannon on the ring it was made for, the same ring as the turret, in a darker olive. The Kenney head, its post and the crate are gone.
- Esc in the workshop closes it and the fight goes on with the mouse, as E does. The game asks for the mouse once Esc is up, because Chrome drops a lock taken while Esc is still held. Checked with real Windows key presses (held 90 to 450 ms) in a headed Chrome, 6 of 6. The Take aim plate stays as the fallback if the browser still refuses: a click anywhere takes the mouse, Esc there opens the menu.
- 14 Poly Haven props are new in the yard. One cell in eight is a gear pile now: three machines and some litter. Five small props also mix into the bale piles.

## Files
- `Combat/createStructureModel.js`: the flak block. `Combat/Structure.js`: `FLAK_REST` 0.55, `FLAK_MIN` 0.2, `FLAK_MAX` 0.8. `config.js`: flak `height` 1.0.
- `Ui/Ui.js`: state `aim`, `waitForAim()`, `SHOP_RELOCK`, `shopClosed`, `aimOnRelease`, `ESC_HOLD` (asks anyway after 1 s held, in case the key-up went to another window). `Ui/Menu.js`: `setAim()`, `showAim()`. `style/menu.css`: `.aim`, `.aim-note`. `style/hud.css`: the HUD stays up in `aim`.
- `World/Junkyard.js`: `MACHINES`, `LITTER`, `gearPile()`, five more `LOOSE` entries.
- `tools/assets.manifest.json`, `sources.js`, `JunkLibrary.js` (`turret_cannon` rust), `CREDITS.md`.

## Interfaces other code uses
- `ui.state` can be `'aim'`. `Experience.update` treats it like pause, so nothing moves.
- Gear piles use the shadowed `junkyard.batch`, so `heights` covers them like a bale.

## Decisions and why
- The Quaternius launcher came with the same ring as the turret gun. The bounds match to the millimetre, so the flak reuses `turret_gun_base` and the files gain only the 434-triangle head.
- The launcher is one mesh, its yoke included, so the whole thing leans back on the post's foot. Past 0.8 rad its back sinks into the ring. Drones near overhead get shots from a lower barrel, and the tracer still goes to them.
- A browser does not count Esc as a user gesture, and drops a lock taken while Esc is still down. A lock lost within 1.5 s of leaving the workshop in the fight is therefore never the player's own Esc. That case waits for a click instead of pausing. Closing the workshop on the map does not count, so a round started right after still shows its Round N plate.
- The Take aim plate is a full-screen button. `Input` ignores clicks that are not on the canvas, so the click that takes the mouse fires no shot.
- Gear at 1.25 times life size. At 1 the cell looked like open ground, though it blocks the way.

## Gotchas
- Left out: `wooden_barrels_01` is a 4 m scene of many barrels, `steel_frame_shelves_01` comes 21 m tall, and `plastic_crate_01` keeps 10k triangles after decimation. Their static files were deleted.
- `old_military_compressor` lost thin parts to decimation (0.04), its bounds shrank from 1.68 to 1.25 m. It still reads as a compressor.
- `hand_truck` 5.4k and `industrial_storage_cart` 6.2k triangles: the simplifier stops at its error limit. Only a few stand in a yard.
- Playwright's Esc is not a real Esc: it never ends a lock. The real-key test was a throwaway that brings the game's Chrome window to the front and presses Esc through `user32 keybd_event`, only if the front window's title says Scrapyard.
- After a real Esc in the fight, Chrome refuses a new lock for about a second. A Back to work click 0.8 s later does nothing, a second click works. That is Chrome's, not the game's.

## Not done
- No mobs, Stash huts or ground options yet. The user asked for the field's objects.
- The user picks props from here. Removing one means taking it out of `MACHINES`, `LITTER` or `LOOSE`, the manifest and `sources.js`.
