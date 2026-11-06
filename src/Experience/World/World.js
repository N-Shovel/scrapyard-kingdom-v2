import Experience from '../Experience.js'
import Grid, { EMPTY } from '../Game/Grid.js'
import Environment from './Environment.js'
import Ground from './Ground.js'
import JunkLibrary from './JunkLibrary.js'
import Fence from './Fence.js'
import Junkyard from './Junkyard.js'
import Stash from './Stash.js'
import Dust from './Dust.js'
import Floodlights from './Floodlights.js'
import TitleSign from './TitleSign.js'
import Player from '../Actors/Player.js'

// Height used for the border wall and the Stash, which keep no per-cell height
const WALL_HEIGHT = 6

export default class World
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.seed = Math.floor(Math.random() * 1e9)

        // Wait for resources
        this.resources.on('ready', () =>
        {
            this.grid = new Grid()
            this.grid.generate(this.seed)

            this.environment = new Environment()
            this.junkLibrary = new JunkLibrary()
            this.ground = new Ground()
            this.ground.paint(this.seed)
            this.fence = new Fence()
            this.junkyard = new Junkyard()
            this.junkyard.build(this.seed)
            this.stash = new Stash()
            this.dust = new Dust()
            this.floodlights = new Floodlights()
            this.titleSign = new TitleSign()
            this.player = new Player()

            this.ready = true
        })
    }

    // Round change: new map data right away, then the piles sink and rise with the new layout.
    newYard(seed)
    {
        this.seed = seed
        this.grid.generate(seed)
        this.junkyard.swap(seed, () => this.ground.paint(seed))
    }

    // Top of whatever stands at a point: a pile, a structure, the border wall. Open ground is 0.
    // The camera and shots march through this instead of raycasting thousands of instances.
    heightAt(x, z)
    {
        const grid = this.grid
        const { i, j } = grid.worldToCell(x, z)
        if(!grid.inBounds(i, j))
            return WALL_HEIGHT

        const k = grid.index(i, j)
        const structure = grid.structures[k]
        if(structure)
            return structure.def.height
        if(grid.terrain[k] === EMPTY)
            return 0
        return this.junkyard.heights[k] || WALL_HEIGHT
    }

    update()
    {
        if(!this.ready)
            return

        const delta = this.experience.time.seconds
        this.player.update()
        this.dust.update()
        this.environment.update(delta)
        this.floodlights.update(delta)
        this.titleSign.update()
    }
}
