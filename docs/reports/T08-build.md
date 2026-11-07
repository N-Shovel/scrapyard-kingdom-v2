# T08: Structures, traps, build mode

**Status:** done with gaps
**Check:** `npm test` -> 22 pass, 2 new for `Inventory`. `npm run playtest -- build` -> opens on the prep map. A click places a turret from the inventory, a right click picks it up. R lays a container across one row, and four presses step a car clockwise around its anchor, model and cells together. Two turrets, a flak and four traps placed. The next spikes cost 20 scrap, and placing changes the flow field. 40 s of fighting with no help: the turrets kill 9 to 13. A raider held on each trap: spikes stab and wear, tar slows and wears, the mine goes off once. B builds a wreck at the crosshair in third person. Round end: every structure still standing comes back. Passed 18 runs in a row. Shots `build_map.png`, `build_close.png` looked at. Frame time unchanged: world 6.1 ms, 26 enemies 12.2 ms.

## What exists now
Prep is a top-down map: WASD or the arrows pan, the wheel zooms, a right drag grabs the map. 1-7 choose, R turns a quarter clockwise, a left click places (hold and drag for a row), a right click or X picks up. Arrows sprayed on the ground show each coming route. G starts the round in the view used last. In the fight B or Tab is build mode at the crosshair, within 16 m. Turrets and flak track and fire, traps stab, slow or blow up, and enemies break walls in their way.

## Files
- `Game/Inventory.js`: owned but not placed, each item keeps its health. No three.js.
- `Combat/Structure.js`: one placed thing and what it does: turret aim and fire, spikes, tar, mine.
- `Combat/createStructureModel.js`: each type's look. Library junk through a `JunkBatch`, welded heads and traps from texture sets.
- `Combat/Structures.js`: place, destroy, `returnAll`. Placing writes the Grid, so routes change at once.
- `Combat/Build.js`: cursor or crosshair, ghost and reach ring, place, pick up, buy.
- `Combat/RouteArrows.js`: route preview for the coming gates, rebuilt when `grid.version` changes.
- `Camera.js`: `top` mode. `Game.js`: owns all of the above, map in prep, play view in the fight.

## Interfaces other code uses
- `game.inventory`: `count(type)`, `take(type)` (healthiest hp or null), `add(type, hp)`. `game.spend(n)` returns whether it paid.
- `game.structures`: `list`, `place(type, i, j, rotation, hp)`, `destroy(structure)`, `returnAll(inventory)`.
- `structure`: `type`, `def`, `cells`, `rotation` (quarter turns clockwise), `hp`, `maxHp`, `dead`, `position` (middle of the footprint), `damage(n)`, `model.{group, batch, gun, head, pitch, barrels, muzzle, spikes, lamp}` (`gun` since T12).
- `game.build`: `active` (fight build mode), `on`, `selected`, `rotation`, `target` ({ i, j, cells, structure, problem }), `aim()`, `findTarget()`.
- `camera.setMode('top')` remembers `camera.playMode` (first or third). The player takes no input while the map is up.
- `game.routes.update(visible, gates)`.

## Decisions and why
- Structure models reuse `JunkBatch` and the library, so walls and turret bases carry the yard's own paint and rust. Turret heads and traps are box and pipe shapes, but in Poly Haven texture sets, never flat color.
- The cursor marches the camera ray through `world.heightAt`, the same as the camera collision. A wall in front wins over the ground behind it.
- `Build.aim` updates the camera matrix itself. Fast playtest steps never render, so the matrix would be stale.
- In prep you may build where she stands. She moves to a free spot when the round starts.
- Turret damage applies at once. Tracers and the sound came with T09.

## Gotchas
- Clockwise on the map means a negative yaw: models are built along +Z and a positive yaw turns counterclockwise seen from above. Turret heads turn in the structure's own frame.
- Lamp blink is one shared material, every mine blinks together.
- The build scenario gives the Stash 1e9 health and keeps her alive during the build mode check. Alone in a 40 s fight either can fall, and the round or build mode then stops.
- Test cells must be ones the cursor really reaches from the map camera, see `window.reachable`.
- Not solved: once, all four traps on the route failed to place, cause unknown. The assert now prints where the cursor aimed and why, and has not caught it in 18 runs since.
- Two playtests at once share the GPU and double the frame times. Measure alone.

## Not done
- No range rings for every placed turret, only for what is under the cursor.
- No hotbar, prices or reasons on screen yet (T10). Problems are in `build.target.problem`.
- Weapons hold fire while `build.active`. Repairs: 8 on the prep map, one click fixes a placed structure for `REPAIR_SHARE` of its price times the share of health lost. Items in the inventory keep their damage until placed and repaired.
- Placing needs a fresh click (`build.dragging`). A button held from the fight placed the inventory along the cursor while the map camera flew in.
