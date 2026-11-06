# T05: Grid and flow field

**Status:** done. Built before T04, because the junk piles need its map.
**Check:** `npm test` -> 14 tests, 14 pass.

## What exists now
The map as plain data, with no three.js, so it runs under `node --test`. Ported from the old `js/grid.js`, with footprints. `Game/config.js` holds all balance numbers from the old game, with the plan's changes.

## Files
- `src/Experience/Game/config.js`: every balance number.
- `src/Experience/Game/Grid.js`: map, collision, pathfinding.
- `src/Experience/Game/MinHeap.js`: priority queue.
- `src/Experience/Game/seededRandom.js`: mulberry32, same seed gives the same yard.
- `tests/grid.test.js`: 14 tests.

## Interfaces other code uses
```js
import Grid, { EMPTY, JUNK, STASH } from './Game/Grid.js'
const grid = new Grid()
grid.generate(seed)                         // new yard, recomputes flows
grid.size, grid.cell, grid.half             // 36, 2.2, 39.6
grid.terrain[grid.index(i, j)]              // EMPTY, JUNK or STASH
grid.structures[grid.index(i, j)]           // whoever stands there, or null
grid.cellToWorld(i, j)                      // { x, z }, the cell's center
grid.worldToCell(x, z)                      // { i, j }
grid.walkable(i, j), grid.solid(i, j)
grid.footprint(type, i, j, rotation)        // [{ i, j }, ...], rotation 0-3 quarter turns clockwise (T08)
grid.canPlace(cells)
grid.place(structure), grid.remove(structure)  // structure = { def, cells, ... }
grid.resolveCircle(position, radius)        // pushes position.x and .z out of solids
grid.lineClear(ax, az, bx, bz)
grid.obstaclesBetween(ax, az, bx, bz, max)  // a long structure counts once
grid.flowNormal, grid.flowBrute             // { dist, wallCost }
grid.nextCell(i, j, flow)                   // best neighbour toward the Stash
grid.updateRoutes()                         // fills gate.route, .breach, .bruteRoute, .bruteBreach
grid.flowTo(structure), grid.nextCellTo(i, j, structure)
grid.gates                                  // { name, cells, center: { x, z }, route, breach, lock, bruteLock, ... }
grid.stashCells, grid.reserved, grid.version
```
`grid.version` goes up whenever a flow changes. Cache against it.

## Decisions and why
- Footprint grows from the anchor: a car is `j, j+1` at rotation 0, then swings clockwise around the anchor: -i, -j, +i. A container stays centered, `j-1, j, j+1` or across.
- Path cost uses the structure's full hp, not current hp, so a route does not flip while a wall is being hit.
- `obstaclesBetween` counts a structure once, otherwise a container end on would block turret fire three times over.
- Junk cluster count scales with area: 45 on 36x36. The old game had 46 on 40x40, which looked thin here.

## Gotchas
- `node --test tests/` no longer works on Node 24, it looks for a file named `tests`. The npm script uses `tests/*.test.js`.
- Float64 in the flow fields is on purpose, see the comment in `computeFlow`.

## Not done
Heights per cell, for shot marching in T09, are not here yet.
