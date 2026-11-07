import { test } from 'node:test'
import assert from 'node:assert/strict'
import Grid from '../src/Experience/Game/Grid.js'
import Rounds from '../src/Experience/Game/Rounds.js'
import seededRandom from '../src/Experience/Game/seededRandom.js'
import config from '../src/Experience/Game/config.js'

const setup = () =>
{
    const grid = new Grid()
    grid.generate(7)
    return new Rounds(grid, seededRandom(3))
}

const count = (list, type) => list.filter((entry) => entry === type).length

test('composition follows config.SPAWN, types only from their first round', () =>
{
    const rounds = setup()
    const first = rounds.composition(1)
    assert.equal(count(first, 'raider'), 26)
    assert.equal(count(first, 'scuttler'), 5)
    assert.equal(count(first, 'drone'), 0)
    assert.equal(count(first, 'brute'), 0)

    const third = rounds.composition(3)
    assert.equal(count(third, 'drone'), 10)
    assert.equal(count(third, 'brute'), 3)
})

test('schedule spawns every enemy from an active gate inside the window, in time order', () =>
{
    const rounds = setup()
    rounds.activeGates = rounds.nextGates
    const types = rounds.composition(2)
    const schedule = rounds.buildSchedule(types)
    const { firstSpawn, window, packMax } = config.SPAWN

    assert.equal(schedule.length, types.length)
    for(let n = 0; n < schedule.length; n++)
    {
        const entry = schedule[n]
        assert.ok(rounds.activeGates.includes(entry.gate))
        assert.ok(entry.t >= firstSpawn && entry.t <= firstSpawn + window + packMax * 0.5)
        if(n > 0)
            assert.ok(entry.t >= schedule[n - 1].t)
    }
})

test('a round runs from ready to end once everything spawned has died', () =>
{
    const rounds = setup()
    const spawned = []
    let ended = null
    rounds.on('spawn', (entry) => spawned.push(entry))
    rounds.on('end', (round, bonus) =>
    {
        ended = { round, bonus }
    })

    rounds.ready()
    assert.equal(rounds.timer, config.COUNTDOWN)
    rounds.ready()
    assert.equal(rounds.phase, 'combat')
    assert.equal(rounds.round, 1)
    const planned = rounds.schedule.length

    // Nobody killed yet: the round must not end, even after everyone has spawned
    for(let t = 0; t < 70; t += 0.1)
        rounds.update(0.1, spawned.length)
    assert.equal(spawned.length, planned)
    assert.equal(ended, null)

    rounds.update(0.1, 0)
    assert.deepEqual(ended, { round: 1, bonus: config.ROUND_BONUS.base + config.ROUND_BONUS.perRound })
    assert.equal(rounds.phase, 'prep')
    assert.equal(rounds.timer, config.PREP_TIME)
})

test('the last pack spawning does not end the round in the same frame', () =>
{
    const rounds = setup()
    let ended = false
    rounds.on('end', () =>
    {
        ended = true
    })
    rounds.start()
    rounds.schedule = [{ type: 'raider', gate: rounds.activeGates[0], t: 0 }]
    rounds.update(0.1, 0)
    assert.equal(ended, false)
})

test('more gates open as rounds go on, scaling grows with the round', () =>
{
    const rounds = setup()
    assert.equal(rounds.nextGates.length, 2)
    rounds.round = 4
    rounds.pickNextGates()
    assert.equal(rounds.nextGates.length, 4)

    assert.deepEqual(rounds.scaling(1), { hp: 1, damage: 1, speed: 1 })
    const late = rounds.scaling(30)
    assert.ok(late.hp > 5)
    assert.equal(late.speed, config.SCALING.speedMax)
})

test('distanceToCells is 0 inside a cell and grows outside', () =>
{
    const grid = new Grid()
    grid.generate(7)
    const { x, z } = grid.cellToWorld(grid.stashCells[0].i, grid.stashCells[0].j)
    assert.equal(grid.distanceToCells(x, z, grid.stashCells), 0)
    // Its far edge is STASH_CELLS - 0.5 cells from this cell's center
    const far = grid.distanceToCells(x + 20, z, grid.stashCells)
    assert.ok(Math.abs(far - (20 - grid.cell * (config.STASH_CELLS - 0.5))) < 1e-9)
})
