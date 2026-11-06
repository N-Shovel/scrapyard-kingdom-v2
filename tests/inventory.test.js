import { test } from 'node:test'
import assert from 'node:assert/strict'
import Inventory from '../src/Experience/Game/Inventory.js'
import config from '../src/Experience/Game/config.js'

test('starts with config.START_INVENTORY at full health', () =>
{
    const inventory = new Inventory()
    for(const [type, count] of Object.entries(config.START_INVENTORY))
        assert.equal(inventory.count(type), count)
    assert.equal(inventory.take('wreck'), config.STRUCTURES.wreck.hp)
})

test('take hands out the healthiest first, damage is kept', () =>
{
    const inventory = new Inventory()
    while(inventory.take('container') !== null);
    inventory.add('container', 300)
    inventory.add('container', 1200)
    inventory.add('container', 700)
    assert.equal(inventory.take('container'), 1200)
    assert.equal(inventory.take('container'), 700)
    assert.equal(inventory.take('container'), 300)
    assert.equal(inventory.take('container'), null)
})
