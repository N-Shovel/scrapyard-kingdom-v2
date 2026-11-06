# T07: Enemies and rounds

**Status:** done with gaps
**Check:** `npm test` -> 20 pass, 6 of them for `Rounds` and `distanceToCells`. `npm run playtest -- rounds` -> round 1 from 2 gates with 31 enemies planned. After 20 s, 11 of 11 spawned enemies are closer to the Stash, none stuck in a pile, Stash down to 1281. All 31 spawn and die, round ends, prep for round 2, Stash held. Planted feet drift -0.02 (raider), 0.2 (scuttler), 0.04 (brute) m/s. Down and respawn checked. 25 enemies alive: median 12.2 ms, worst 18.3 ms. Shots `rounds_*.png` looked at. Full playtest passes.

## What exists now
G starts the countdown, a second G starts the round at once (the prep timer runs 180 s otherwise). Packs come from the gates whose lamps blink, walk the flow field, hit the player, turrets, locked walls and the Stash. Drones fly in and shoot. When all are dead, a bonus is paid, the yard changes and prep starts again. She can be hurt, go down, lose a fifth of her scrap and get up at the spawn.

## Files
- `Game/Rounds.js`: round director, no three.js. Composition, schedule, scaling, gate locks, events.
- `Game/Game.js`: scrap, kills, Stash health, wires rounds to enemies, the world and the gate lamps. `experience.game`.
- `Actors/Enemy.js`: one enemy: AI ported from the old `js/enemies.js`, own clips with crossfades, death and sinking.
- `Actors/Enemies.js`: spawning, separation, player push, clean-up.
- `World/Fence.js`: one lamp material per gate, `warn()`.
- `tools/optimize-assets.mjs`: manifest `strip` drops a skinned model's triangles by bone. The mech's frog pilot is cut this way.
- `tests/rounds.test.js`.

## Interfaces other code uses
- `game.scrap`, `game.kills`, `game.stashHp`, `game.over`, `addScrap(n)`, `steal(n)` (returns what it took), `damageStash(amount, enemy)`.
- `game.rounds`: `round`, `phase` ('prep' | 'combat'), `timer`, `elapsed`, `schedule`, `activeGates`, `nextGates`, `hotGates`, `ready()`, `start()`, `scaling(round)`. Events `start` (round), `spawn` ({ type, gate, t }), `end` (round, bonus).
- `game.enemies`: `list`, `alive` (not dying), `spawn(type, gate, scaling)`, `clear()`.
- `enemy.hit(amount)`: the one way to hurt an enemy. Also `position`, `yaw`, `def`, `hp`, `dying`, `slow` (seconds of tar, T08), `model`.
- Structures for T08 must have `type`, `def`, `cells`, `dead`, `damage(amount)`. Enemies attack the cells, `type` 'turret' or 'flak' draws raiders.
- `player.hp`, `alive`, `takeDamage(n)`, `die()`, `respawn()`. `animation.hurt()` plays the additive flinch.
- `fence.warn(gates, blink, elapsedMs)`, `grid.distanceToCells(x, z, cells)`.
- Config: `ENEMIES.*.clipSpeed`, `STASH_PATCH`, `ROUND_BONUS`, `PLAYER.deathLoss`.

## Decisions and why
- Rounds is three-free and talks through events, so its timing and counts are unit tested. It checks for the round's end before spawning, else the last pack would end the round in the frame it arrives.
- Walk clips run at `speed / (clipSpeed * scale)`. clipSpeed is the planted foot's speed in the clip, measured once. Brute's 7.9 came from two runs, a looser measure said 7.1 and drifted.
- One swing per blow: attack clips are stretched to `attackRate` and the first blow lands mid swing. The drone's 0.25 s shot loops as a burst instead.
- Scale per model from its bind pose box against `def.height`. Rust only on the robots, scale times 100 because their geometry is stored at 1/100.
- The mech's pilot was a cartoon frog. Its Head, Neck and Chest bones carry nothing else, so `strip` removes it: 5846 to 3858 triangles.
- Gate warnings are the existing red lamps, not beams: blinking in prep, steady in the fight, nearly dark otherwise.
- While she is down the camera pulls to third person and looks down at her.

## Gotchas
- `Experience` builds `Game` after `World`. Both wait for `ready`, World listens first, so the player exists when `Enemies` is built.
- The playtest `step()` now runs `game.update()` too. `hold()` in the player scenario does not, so no enemy spawns there.
- A started swing plays out (`enemy.swing`, one `attackRate`) before the enemy walks again. Without it a scuttler right at its reach flipped between chase and attack every frame, 48 clip restarts in 150 frames, and shook. The `rounds` scenario asserts 6 or fewer.
- Kill scrap drops as pickups since T09.
- No game over screen: `game.over` stops the rounds, T10 shows it.

## Not done
- Frame time doubles with 25 enemies. Round 5 brings about 100. T11 needs cheaper far enemies: no shadow past a distance, mixer updates every other frame.
- Hit flash came with T09. No health bars yet (T10).
- Top-down prep camera and build mode: done in T08.
