import { test } from 'node:test'
import assert from 'node:assert/strict'
import Upgrades from '../src/Experience/Game/Upgrades.js'
import config from '../src/Experience/Game/config.js'

// The Game's spend(), on its own
const wallet = (scrap) => ({
    scrap,
    spend(amount)
    {
        if(this.scrap < amount)
            return false
        this.scrap -= amount
        return true
    }
})

test('each level costs the next price and adds one step', () =>
{
    const money = wallet(1000)
    const upgrades = new Upgrades(money)
    const dmg = config.UPGRADES.find((upgrade) => upgrade.id === 'dmg')
    assert.equal(upgrades.bonus('dmg'), 0)
    assert.equal(upgrades.buy('dmg'), true)
    assert.equal(upgrades.buy('dmg'), true)
    assert.equal(money.scrap, 1000 - dmg.cost[0] - dmg.cost[1])
    assert.equal(upgrades.bonus('dmg'), dmg.step * 2)
    assert.equal(upgrades.price('dmg'), dmg.cost[2])
})

test('no sale without the scrap, and none past the top level', () =>
{
    const money = wallet(10)
    const upgrades = new Upgrades(money)
    assert.equal(upgrades.buy('mag'), false)
    assert.equal(money.scrap, 10)

    money.scrap = 1e6
    const mag = config.UPGRADES.find((upgrade) => upgrade.id === 'mag')
    for(let n = 0; n < mag.cost.length; n++)
        assert.equal(upgrades.buy('mag'), true)
    assert.equal(upgrades.price('mag'), null)
    assert.equal(upgrades.buy('mag'), false)
    assert.equal(upgrades.levels.mag, mag.cost.length)
})

test('medkits stop at the most she can carry', () =>
{
    const money = wallet(1e6)
    const upgrades = new Upgrades(money)
    const max = config.CONSUMABLES.medkit.max
    for(let n = 0; n < max; n++)
        assert.equal(upgrades.buy('medkit'), true)
    assert.equal(upgrades.buy('medkit'), false)
    assert.equal(upgrades.medkits, max)
    assert.equal(upgrades.useMedkit(), true)
    assert.equal(upgrades.medkits, max - 1)
    upgrades.medkits = 0
    assert.equal(upgrades.useMedkit(), false)
})
