import test from 'node:test'
import assert from 'node:assert/strict'
import Grid, { EMPTY, JUNK, STASH } from '../src/Experience/Game/Grid.js'
import config from '../src/Experience/Game/config.js'

const makeGrid = (seed = 7) =>
{
    const grid = new Grid()
    grid.generate(seed)
    return grid
}

const structure = (grid, type, i, j, rotation = 0) =>
{
    const cells = grid.footprint(type, i, j, rotation)
    return { def: config.STRUCTURES[type], cells }
}

// Walks a route and tells whether it ends at the Stash.
const reachesStash = (grid, route) =>
{
    const last = route[route.length - 1]
    return grid.terrain[grid.index(last.i, last.j)] === STASH
}

test('a yard has fence, Stash and open gates, and is the same for the same seed', () =>
{
    const a = makeGrid(7)
    const b = makeGrid(7)
    const c = makeGrid(8)

    assert.deepEqual(a.terrain, b.terrain)
    assert.notDeepEqual(a.terrain, c.terrain)
    assert.equal(a.stashCells.length, config.STASH_CELLS ** 2)
    assert.equal(a.terrain[a.index(0, 5)], JUNK)
    for(const gate of a.gates)
        for(const { i, j } of gate.cells)
            assert.equal(a.terrain[a.index(i, j)], EMPTY)
})

test('junk never seals off an open cell, over many seeds', () =>
{
    for(let seed = 1; seed <= 30; seed++)
    {
        const grid = makeGrid(seed)
        const flow = grid.computeFlow(0)
        grid.terrain.forEach((value, k) =>
        {
            if(value === EMPTY)
                assert.ok(Number.isFinite(flow[k]), `seed ${seed} cell ${k}`)
        })
    }
})

// A junk cluster's random walk used to wander onto a gate, and every enemy from that gate spawned inside junk
test('gates and the cell inside each stay open, over many seeds', () =>
{
    for(let seed = 1; seed <= 300; seed++)
    {
        const grid = makeGrid(seed)
        for(const k of grid.reserved)
            assert.equal(grid.terrain[k], EMPTY, `seed ${seed}: reserved cell ${k % grid.size}, ${Math.floor(k / grid.size)} is open`)
    }
})

test('every gate has a walking route to the Stash', () =>
{
    const grid = makeGrid()
    grid.updateRoutes()
    for(const gate of grid.gates)
    {
        assert.ok(reachesStash(grid, gate.route), gate.name)
        assert.equal(gate.breach, null, gate.name)
    }
})

test('a car takes 2 cells and a container 3, both turn', () =>
{
    const grid = makeGrid()
    assert.deepEqual(grid.footprint('wreck', 10, 10), [{ i: 10, j: 10 }, { i: 10, j: 11 }])
    // Each R turns a car a quarter clockwise around its anchor: +j, -i, -j, +i
    assert.deepEqual(grid.footprint('wreck', 10, 10, 1), [{ i: 10, j: 10 }, { i: 9, j: 10 }])
    assert.deepEqual(grid.footprint('wreck', 10, 10, 2), [{ i: 10, j: 10 }, { i: 10, j: 9 }])
    assert.deepEqual(grid.footprint('wreck', 10, 10, 3), [{ i: 10, j: 10 }, { i: 11, j: 10 }])
    assert.deepEqual(grid.footprint('wreck', 10, 10, 4), grid.footprint('wreck', 10, 10, 0))
    assert.deepEqual(grid.footprint('container', 10, 10), [{ i: 10, j: 9 }, { i: 10, j: 10 }, { i: 10, j: 11 }])
    assert.deepEqual(grid.footprint('container', 10, 10, 1), [{ i: 11, j: 10 }, { i: 10, j: 10 }, { i: 9, j: 10 }])
    assert.deepEqual(grid.footprint('turret', 10, 10), [{ i: 10, j: 10 }])
})

test('nothing can be placed on junk, Stash, gates, or another structure', () =>
{
    const grid = makeGrid()
    const { i: si, j: sj } = grid.stashCells[0]
    assert.equal(grid.canPlace([{ i: si, j: sj }]), false)
    assert.equal(grid.canPlace([{ i: 0, j: 0 }]), false)
    assert.equal(grid.canPlace([{ i: -1, j: 3 }]), false)

    const gateCell = grid.gates[0].cells[0]
    assert.equal(grid.canPlace([gateCell]), false)
    assert.equal(grid.canPlace([{ i: gateCell.i, j: gateCell.j + 1 }]), false)

    const spot = { i: si - 3, j: sj }
    assert.equal(grid.canPlace([spot]), true)
    const wall = structure(grid, 'turret', spot.i, spot.j)
    grid.place(wall)
    assert.equal(grid.canPlace([spot]), false)
    assert.equal(grid.walkable(spot.i, spot.j), false)

    grid.remove(wall)
    assert.equal(grid.canPlace([spot]), true)
    assert.equal(grid.walkable(spot.i, spot.j), true)
})

test('traps can be walked over, walls cannot', () =>
{
    const grid = makeGrid()
    const { i, j } = grid.stashCells[0]
    const trap = structure(grid, 'spikes', i - 3, j)
    grid.place(trap)
    assert.equal(grid.walkable(i - 3, j), true)
})

test('sealing the Stash makes routes breach a wall instead of failing', () =>
{
    const grid = makeGrid()
    const m = grid.size / 2

    // A ring of walls around the Stash, 2 cells out
    const walls = []
    for(let i = m - 3; i <= m + 2; i++)
        for(let j = m - 3; j <= m + 2; j++)
            if(i === m - 3 || i === m + 2 || j === m - 3 || j === m + 2)
                walls.push({ def: config.STRUCTURES.wreck, cells: [{ i, j }] })
    for(const wall of walls)
        grid.place(wall)

    grid.updateRoutes()
    for(const gate of grid.gates)
    {
        assert.ok(reachesStash(grid, gate.route), gate.name)
        assert.ok(gate.breach, gate.name)
        assert.ok(walls.includes(gate.breach))
    }
})

test('a lone wall on the route gets walked around', () =>
{
    const grid = makeGrid()
    grid.updateRoutes()

    const gate = grid.gates[0]
    const step = gate.route[Math.floor(gate.route.length / 2)]
    const wall = structure(grid, 'turret', step.i, step.j)
    grid.place(wall)
    grid.updateRoutes()

    assert.ok(reachesStash(grid, gate.route))
    assert.equal(gate.breach, null)
})

test('brutes value walls less than raiders do', () =>
{
    const grid = makeGrid()
    const k = grid.index(5, 5)
    const wall = { def: config.STRUCTURES.container, cells: [{ i: 5, j: 5 }] }
    grid.structures[k] = wall
    assert.ok(grid.enterCost(k, config.WALL_COST_BRUTE) < grid.enterCost(k, config.WALL_COST_NORMAL))
})

test('flowTo starts from all cells of a long structure', () =>
{
    const grid = makeGrid()
    const m = grid.size / 2
    const container = structure(grid, 'container', m - 4, m - 1)
    grid.place(container)

    const dist = grid.flowTo(container)
    for(const { i, j } of container.cells)
        assert.equal(dist[grid.index(i, j)], 0)

    // Walking next to any of its cells should step straight into it
    const beside = container.cells[2]
    const next = grid.nextCellTo(beside.i - 1, beside.j, container)
    assert.deepEqual(next, { i: beside.i, j: beside.j })
})

test('flowTo is cached until the grid changes', () =>
{
    const grid = makeGrid()
    const m = grid.size / 2
    const wall = structure(grid, 'wreck', m - 4, m)
    grid.place(wall)
    const first = grid.flowTo(wall)
    assert.equal(grid.flowTo(wall), first)

    const other = structure(grid, 'turret', m - 7, m)
    grid.place(other)
    assert.notEqual(grid.flowTo(wall), first)
})

test('a circle is pushed out of a solid cell, from outside and from inside', () =>
{
    const grid = makeGrid()
    grid.terrain.fill(EMPTY)
    grid.place(structure(grid, 'turret', 10, 10))
    const { x, z } = grid.cellToWorld(10, 10)

    const outside = { x: x - grid.cell / 2 - 0.1, z }
    grid.resolveCircle(outside, 0.4)
    assert.ok(Math.abs(outside.x - (x - grid.cell / 2 - 0.4)) < 1e-6)

    const inside = { x: x + 0.05, z }
    grid.resolveCircle(inside, 0.4)
    assert.ok(Math.abs(inside.x - (x + grid.cell / 2 + 0.4)) < 1e-6)
    assert.equal(inside.z, z)
})

test('a long structure counts as one obstacle', () =>
{
    const grid = makeGrid()
    const m = grid.size / 2
    const row = m - 5
    // Three quarter turns: lies along +i, cells in ascending i
    const container = structure(grid, 'container', m - 5, row, 3)
    for(const { i, j } of container.cells)
        grid.terrain[grid.index(i, j)] = EMPTY
    grid.place(container)

    const from = grid.cellToWorld(container.cells[0].i - 1, row)
    const to = grid.cellToWorld(container.cells[2].i + 1, row)
    assert.equal(grid.obstaclesBetween(from.x, from.z, to.x, to.z, 3), 1)
})

test('world and cell coordinates round trip', () =>
{
    const grid = makeGrid()
    for(const [i, j] of [[0, 0], [5, 12], [35, 35]])
    {
        const { x, z } = grid.cellToWorld(i, j)
        assert.deepEqual(grid.worldToCell(x, z), { i, j })
    }
})
