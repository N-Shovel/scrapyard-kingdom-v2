# T13: Mouse lock in a real Chrome, health balance, lens, ponytail

**Status:** done with gaps
**Check:** `npm test` -> 26 pass. `npm run playtest` -> all 13 scenarios pass, long run fight frame work 6.9 to 9.3 ms per round, median 9.0 ms. `npm run build` passes. Throwaway scripts (not kept) drove a headed Chrome through every lock flow, ran a fighting bot for 3 to 8 rounds, timed a post pass and looked at the hair in close-ups.

## What exists now
- The mouse lock flows work in a real, headed Chrome: Take aim locks, the mouse turns her, Esc pauses, Back to work locks again, E at the Stash opens the workshop, E or Esc closes it and locks again, and the sound starts on Clock in.
- Patch up costs 0.4 scrap for each missing point of health, so a full 100 costs 40. It used to be a flat 25.
- The yard is seen through a lens: darker corners and a fine grain, drawn in CSS under every plate.
- Her hair's sweep is skinned to a new `pony` bone and swings on a spring when she starts, stops, turns and bobs.

## Files
- `Ui/Ui.js`: `pause()` drops the mouse lock first.
- `Ui/Shop.js`, `Game/config.js`: `CONSUMABLES.heal.costPerHp` 0.4 in place of `cost`.
- `style/base.css`: `.ui::before` is the vignette, `.ui::after` is the grain. `.ui` is `isolation: isolate` so both sit under the plates. `tokens.css`: `--lens`.
- `tools/blender/rig.py`: `PONY`, `PONY_BLEND`, `skin_hair()`. `tools/optimize-assets.mjs`: `pony` is in `CONTROL_BONES`, so no clip keeps a track for it.
- `Actors/PlayerHair.js`: the spring. `Actors/Player.js` runs it after the animation.
- `tools/scenarios.mjs`: `screens` checks the Patch up price and what it heals.

## Interfaces other code uses
- `player.hair`: `PlayerHair`. `update(delta)` must run after the mixer every frame. `bone`, `rest`.
- Meshes in `player.glb`: `Hair` is now a SkinnedMesh on `head` and `pony`, not a rigid child of `head`.
- `ui.pause()` calls `input.unlock()`.

## Decisions and why
- Esc in a real browser drops the lock before the page sees it. A page-level Esc with the lock held paused and resumed in the same frame, so `pause()` unlocks itself.
- Balance: a bot holding by the Stash, shooting at 70% of the ideal pellet hits, buying gear and running at whatever is closest to the Stash, took 0 to 280 damage per round, went down 0 to 1 times from round 3 on and used its two medkits. That is tense without being unfair, so health numbers stayed. What did not fit was Patch up: a full heal for 25 while the fight waits made no regen meaningless once scrap piles up. Priced by health it is cheap for a scratch, 40 for a full refill, still cheaper per point than a medkit, which is the price of carrying it.
- No post pass. An EffectComposer with bloom, a grade and the output pass cost about 4.5 ms, bloom alone about 2.5 ms, and the worst fight round is already near 16 ms. The vignette and grain are CSS and cost the compositor almost nothing. No bloom.
- The hair's strands each run from the crown to the tips, so no island split was possible. Weights go from the head to `pony` with distance from the skull's middle, 0.13 to 0.30 m.
- The spring works on the tip's offset from the bone's root and is pushed only by the head's acceleration. A world-space spring with drag streamed the hair at its limit for the whole sprint.
- 0.4 rad at most: at 0.6 the sweep flapped up like a lid.

## Gotchas
- Playwright's Escape does not end a pointer lock the way the real key does. The real-Esc cooldown, where Chrome refuses a new lock for about a second, is still not driven. `document.exitPointerLock()` stands in for it in a test.
- The bot's Stash results swung from holding eight rounds to falling in round 3 or 4. It walks straight at threats and gets stuck behind junk, so those numbers say little about the Stash. Do not tune the Stash from them.
- `renderer.info` counts per `render()` call. Any future composer must set `info.autoReset = false`, or the `world` scenario reads the last quad's triangles.
- After `build_player.py`, run `npm run assets:optimize -- player`. Blender warns about more than 4 influences, it did before too.

## Not done
- Nobody listened to the sounds. The audio context runs, that is all a script can tell.
- Going down still gives her full health at the Stash for 6 s and 20% of the scrap she carries, often little mid-round. It could become a cheap heal. Left as it is until someone plays it.
