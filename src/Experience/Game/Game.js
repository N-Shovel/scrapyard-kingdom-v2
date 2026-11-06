import Experience from '../Experience.js'
import config from './config.js'
import Rounds from './Rounds.js'
import Inventory from './Inventory.js'
import Upgrades from './Upgrades.js'
import Enemies from '../Actors/Enemies.js'
import Structures from '../Combat/Structures.js'
import Build from '../Combat/Build.js'
import RouteArrows from '../Combat/RouteArrows.js'
import Effects from '../Combat/Effects.js'
import Debris from '../Combat/Debris.js'
import Pickups from '../Combat/Pickups.js'
import Weapons from '../Combat/Weapons.js'

// Scrap, kills, the Stash's health, what is placed and owned, and the round loop.
// Built once the world is, like World waits for resources.
export default class Game
{
    constructor()
    {
        this.experience = new Experience()
        this.input = this.experience.input
        this.time = this.experience.time

        this.scrap = config.START_SCRAP
        this.earned = 0     // every bit of scrap that came in, for the tickets
        this.kills = 0
        this.stashHp = config.STASH_HP
        this.over = false
        this.inventory = new Inventory()
        this.upgrades = new Upgrades(this)

        // World listens first, so the yard and the player exist by now
        this.experience.resources.on('ready', () =>
        {
            this.world = this.experience.world
            this.camera = this.experience.camera
            this.effects = new Effects()
            this.debris = new Debris()
            this.pickups = new Pickups()
            this.weapons = new Weapons()
            this.enemies = new Enemies()
            this.structures = new Structures()
            this.setRounds()
            this.build = new Build()
            this.routes = new RouteArrows()
            // Every round starts with preparing, on the map
            this.camera.setMode('top')
            this.ready = true
        })
    }

    setRounds()
    {
        this.rounds = new Rounds(this.world.grid)

        this.rounds.on('start', () =>
        {
            // Something may have been built where she stood
            this.world.player.spawn()
            this.camera.setMode(this.camera.playMode)
        })

        this.rounds.on('spawn', ({ type, gate }) =>
        {
            this.enemies.spawn(type, gate, this.rounds.scaling())
        })

        this.rounds.on('end', (round, bonus) =>
        {
            this.enemies.clear()
            this.pickups.collectAll()
            this.structures.returnAll(this.inventory)
            this.addScrap(bonus)
            this.stashHp = Math.min(config.STASH_HP, this.stashHp + config.STASH_HP * config.STASH_PATCH)
            this.world.newYard(Math.floor(Math.random() * 1e9))
            // The new layout may have buried her
            this.world.player.respawn()
            this.camera.setMode('top')
        })
    }

    addScrap(amount)
    {
        this.scrap += amount
        this.earned += amount
    }

    // Pays if there is enough, says whether it did
    spend(amount)
    {
        if(this.scrap < amount)
            return false
        this.scrap -= amount
        return true
    }

    // Takes what is there, up to amount, and says how much that was
    steal(amount)
    {
        const taken = Math.min(this.scrap, amount)
        this.scrap -= taken
        return taken
    }

    damageStash(amount, enemy)
    {
        if(this.over)
            return
        this.stashHp -= amount
        if(enemy.def.steals)
            this.steal(config.STASH_STEAL)
        if(this.stashHp <= 0)
        {
            this.stashHp = 0
            // Ui sees this and shows the last ticket
            this.over = true
        }
    }

    update()
    {
        if(!this.ready)
            return

        const delta = this.time.seconds
        if(!this.over)
        {
            if(this.input.justPressed('KeyG'))
                this.rounds.ready()
            this.rounds.update(delta, this.enemies.alive)
        }
        this.weapons.update(delta)
        this.structures.update(delta)
        this.enemies.update(delta)
        this.debris.update(delta)
        this.pickups.update()
        this.effects.update(delta)
        this.build.update(delta)
        this.routes.update(this.build.on, this.rounds.hotGates)
        this.world.fence.warn(this.rounds.hotGates, this.rounds.phase === 'prep', this.time.elapsed)
    }
}
