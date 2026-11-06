# T09: Weapons, effects, debris, sound

**Changed after T09:** the repair torch, fuel and the pump are gone, and so are the ambient and generator loops (the user found them loud). Repairs are bought with scrap on the prep map, see T08. A held trigger at round end no longer spills the inventory over the map.

**Status:** done with gaps
**Check:** `npm run playtest -- weapons` -> a raider 8 m away dies to one blast, its scrap drops and is collected (+10). The over the shoulder shot hits what the view centers on. An empty tube reloads by itself, six shells. No shot in build mode. 2 swaps rifle for torch, the torch repairs a wreck 100 to 169 hp for 6.9 fuel, the pump fills 20 to 55 fuel for 17 scrap. A mine kills a scuttler. Sounds counted: shot, reload, rack, explosion, steps, flesh and metal hits, audio context running. Passed 3 runs in a row. Shots `weapons_*.png` looked at. Full playtest passes, world median 6.1 ms.

## What exists now
Left button fires the scrap shotgun (9 pellets, 6 in the tube), R reloads, 1 and 2 or the wheel switch to the repair torch. Holding fire on a damaged structure in reach repairs it for fuel, F at the Stash's red pump refuels for scrap. Hip shots shoulder the rifle for a moment. Kills spill scrap that bounces on the ground and slides to her when she is close. Turrets and drones fire tracers, mines explode, broken things scatter plates. On the prep map 8 is the repair tool.

## Files
- `Combat/Weapons.js`: shotgun, torch, reload, fuel, refuel, the pellet trace.
- `Combat/Effects.js`: sparks, flash, fire, flame, dust, smoke, puff, oil, blood as two Points systems, tracers as one line batch.
- `Combat/Debris.js`: cannon-es world with the ground only. Shells, plates, scrap. Impact sound by collision strength.
- `Combat/Pickups.js`: scrap from kills, magnet and collect, `collectAll` at round end.
- `Audio/Sounds.js`: one listener on the camera, pools of positional and flat players, loops. `experience.sounds`.
- `Actors/Player.js`: torch on the rifle bone, `setWeapon`, `muzzle()`, `recoil()`, footsteps. `PlayerAnimation.js`: reload, torch, additive fire. `PlayerArms.js`: kick and reload dip.

## Interfaces other code uses
- `game.weapons`: `ammo`, `mag` (T10, with upgrades), `reloading` (s left), `busy`, `reload()`, `trace(origin, direction, start, far)`.
- `game.effects.burst(kind, position, count, { direction, spread, speed })`, `tracer(from, to, { color, life })`, `flash(position)`, `explosion(position, size)`.
- `game.debris.spawn(kind, position, velocity, { life, scale })` ('shell' | 'plate' | 'scrap'), `scatter(position, count, force)`, `remove(item)`.
- `game.pickups.drop(position, value)`, `collectAll()`. `enemy.hit()` drops `def.scrap` this way now.
- `experience.sounds.play(name, { position, volume, rate, offset, duration })`. No loops. Names `metal`, `flesh`, `step` pick a random take.
- `player.zoom` (right button only, for camera and sights), `aim` (rifle up, also after a hip shot), `shotHold`, `reloadProgress`, `muzzle(target)`.
- `structures.destroy(structure, quiet)`: quiet skips the debris and sound.
- Config: `ENEMIES.raider.flesh` picks blood and flesh sounds over oil and metal.

## Decisions and why
- Pellets hit boxes around enemies and march the world's cell heights, as the plan said. The top fifth of an enemy takes 1.6 times damage.
- In third person the shot ray starts level with her. Without that, a pile between camera and her eats the shot.
- No real light for flashes. A PointLight at intensity 0 took the render from 4.6 to 8.6 ms with `gl.finish()` timing: every lit pixel paid for it. T11 floodlights must stay very few.
- Particles fade inside 1.2 m of the camera and are capped at 220 px, otherwise muzzle smoke in first person filled the screen.
- Each enemy clones its material, and the rust patch goes on again, so one can flash on a hit.
- Reload in first person dips the view model instead of playing the clip, which would leave the sights.
- Sound offsets skip the silence at the start of the reload recordings (0.65 s and 0.55 s).
- After T10: steps at `0.04 + speed * 0.008` (jog 0.085, was 0.53), shot 0.4 (was 0.9), reload shell 0.3 and rack 0.1 (were 0.7 and 0.6, the rack recording clips at four times the shot's loudness). The user found all of them too loud. A slide plays `gravel` (stones_02) and `slide` (air_02 at 0.8 rate), both flat since they are her own. Picked by length and envelope, not by ear.

## Gotchas
- Frame times in the playtest come in steps of 6.06 ms, the 165 Hz display. 12.1 against 6.1 is one refresh, not double the work. Time with `gl.finish()` to compare.
- Debris only collides with the ground, it can sink into piles.
- Nobody has heard the sounds, only their length, level and start were measured.

## Not done
- No ammo, fuel or health on screen (T10).
- Effects are modest, the explosion mostly a glow. T11 polish.
- No muzzle flash light, see above.
