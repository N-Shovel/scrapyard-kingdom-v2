# T19: Sketchfab enemies, cleanup, yard record

**Status:** done with gaps
**Check:** `npm test` -> 28 pass (the credits test covers the four new models). `npm run playtest` -> all 13 scenarios pass. Feet: scuttler drifts 0.23 m/s at 6 m/s, brute -0.12 m/s at 2 m/s, raider 1.89 m/s at 3.4 m/s (on purpose, see Decisions). Long run fight frame work, three runs: median 7.9, 14.7 and 11.6 ms. `npm run build` passes, `static/` 34 MB, `dist/` 39 MB. Every enemy looked at walking, standing, attacking and dying, front and side (`tools/.playtest/rounds_lineup.png`, `rounds_pack.png`, `robots.png`).

## What exists now
- The four enemies come from the user's Sketchfab downloads (CC-BY, credited):
  - Raider = `mob_humanoid`, an orange blocky robot. Clips IDLE and RUN.
  - Scuttler = `mob_chicken`, the bad chicken robot. Clips idle, walk, attack.
  - Brute = `mob_hope`, the caged robot on claws. Clips Robot_idleM and Robot_marchM.
  - Drone = `mob_drone`, the FNSD-500. Clips Idle, Fly Forward, Take Damage Light, Power Off.
- An enemy without an attack clip leans into each blow (`LUNGE` in `Enemy.js`). One without a death clip freezes where it stands and falls on its back, then sinks as before.
- Feet go on the ground and the model is centered on its spot whatever the download's origin. The model sits in a `Group` (`enemy.model`) that turns and tips over at the feet. The skinned copy is `enemy.body`.
- The game over ticket shows the yard record: the most rounds cleared in this browser (`localStorage`, key `scrapyard-kingdom-record`).
- Removed: the Quaternius SWAT, Mech and two robots (manifest, `static/`, credits), the rust patch on enemies, the optimizer's skinned Quaternius path and `stripBones`. The unused particle PNGs from the ITE-18 starter, whose license was never confirmed, moved out of `static/` to `tools/.cache/unused/particles/`.

## Files
- `tools/optimize-assets.mjs`: `rigidToSkinned()` turns parts hung under bones into skinned parts with weight 1, so `joinSkinned` makes one mesh of them. `mob_hope` went from 45 draws to 1.
- `src/Experience/Actors/Enemy.js`: model in a feet-pivot group, lunge and topple fallbacks, no rust.
- `src/Experience/Game/config.js`: `ENEMIES` models, clips, clip speeds, brute radius 1.2 (its body is 2.7 m wide).
- `src/Experience/sources.js`, `tools/assets.manifest.json`, `CREDITS.md`.
- `src/Experience/Ui/Ticket.js`: `record(cleared)`.
- `tools/scenarios.mjs`: feet found by bone name per type, `robots` shows the new models, hits must ring like metal.
- `docs/PLAN.md`, `CLAUDE.md`, `README.md`: names.

## Interfaces other code uses
- `config.ENEMIES[type].clips`: `attack`, `hit` and `death` may be `null`. `enemy.lunges` is true when there is no attack clip, then `actions.attack` is the idle action.
- `enemy.model` (group, position and yaw), `enemy.body` (the skinned clone, mixer root, `scale`).

## Decisions and why
- The raider's RUN is a short jog: matched to 3.4 m/s its legs cycle 8 times a second. `clipSpeed` 13 (the clip covers 5.8) keeps the cadence believable, the feet slide about half the speed. The test allows 0.6 for it, 0.1 for the rest. Seen mostly from the front, the slide shows less than racing legs would.
- The scuttler's walk is matched (clip at about 9x). A small fast robot with blurred legs reads as scurrying.
- No atlas for the raider's 6 materials. Measured with 30 of one type in view: raider +8.4 ms (18 draws each with shadows), brute +7.2 ms (2 draws each). Draw calls are not the main cost, the screen they cover is.
- Every enemy is a robot now, so `flesh` is set on none. It still works for a flesh enemy later.

## Gotchas
- three.js drops dots and spaces from bone names: `FEET.001_ROBOT_BONES` is `FEET001_ROBOT_BONES`, `pe.R_04` is `peR_04`.
- `mob_humanoid`'s WALK and ALL clips are not walks (WALK stands, ALL is run then idle).
- Frame work in the long run swings between 8 and 15 ms from run to run on this machine. Compare runs made back to back.

## Not done
- No hit clips for raider, scuttler and brute: they flash when shot, as before.
- The raider has 6 draws per copy. An atlas in the optimizer would make it one, if the raider count grows.
- `tools/.cache/sketchfab/` holds the zips the user downloaded (about 900 MB, already unzipped beside them) and four duplicate mob folders (`drone_fnsd`, `robot_hope`, `robot_humanoid`, `robo_galinha`, 86 MB). Deleting them is the user's call.
- Graph in `graphify-out/` not rebuilt (`/graphify src --update`).
