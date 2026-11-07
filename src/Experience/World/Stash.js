import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'
import JunkBatch from './JunkBatch.js'

// Erroratten's post-apocalyptic house is about 10 m square at life size. This fits it to the Stash's square,
// a little over: its door stays tall enough for her.
const LENGTH = 9.4
// Turns the house's door toward -z, the front of the Stash
const YAW = Math.PI / 2

// The thing being defended: a dirty old wooden house on the middle cells. It brings its own barrel, aircon
// and solar panel, and nothing else stands around it: more props there only made a mess.
export default class Stash
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.world = this.experience.world
        this.grid = this.world.grid

        // Middle of the Stash's square
        const cells = this.grid.stashCells
        const a = this.grid.cellToWorld(cells[0].i, cells[0].j)
        const d = this.grid.cellToWorld(cells.at(-1).i, cells.at(-1).j)
        this.position = new THREE.Vector3((a.x + d.x) / 2, 0, (a.z + d.z) / 2)
        this.width = this.grid.cell * config.STASH_CELLS - 0.2

        this.group = new THREE.Group()
        this.group.position.copy(this.position)
        this.scene.add(this.group)

        this.setProps()
        this.setLight()
    }

    setProps()
    {
        const library = this.world.junkLibrary
        const batch = new JunkBatch(this.group, library)
        batch.place('stash_house', { yaw: YAW, scale: library.scaleFor('stash_house', LENGTH), color: new THREE.Color('#d8d2c8') })
        batch.build()
    }

    // Warm work light over the front. It comes up as the evening falls.
    setLight()
    {
        this.lamp = new THREE.SpotLight('#ffcf94', 0, 22, 0.95, 0.75, 1.6)
        this.lamp.position.set(0, 3.6, - this.width / 2 - 0.4)
        this.lamp.target.position.set(0, 0, - this.width / 2 - 5.5)
        this.group.add(this.lamp)
        this.group.add(this.lamp.target)
    }
}
