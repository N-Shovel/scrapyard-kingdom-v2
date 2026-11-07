import * as THREE from 'three'
import Experience from '../Experience.js'
import Structure from './Structure.js'

// Everything placed in the yard. Placing writes the cells into the Grid, so enemy routes change at once.
export default class Structures
{
    constructor()
    {
        this.experience = new Experience()
        this.grid = this.experience.world.grid

        this.list = []
        this.group = new THREE.Group()
        this.experience.scene.add(this.group)
    }

    // rotation: quarter turns clockwise on the map
    place(type, i, j, rotation, hp)
    {
        const structure = new Structure(type, this.grid.footprint(type, i, j, rotation), rotation, hp)
        this.grid.place(structure)
        this.list.push(structure)
        this.group.add(structure.model.group)
        return structure
    }

    // Broken, worn out, blown up or picked up. Picking up and blowing up make their own noise.
    destroy(structure, quiet = false)
    {
        if(structure.dead)
            return
        structure.dead = true
        if(!quiet)
        {
            const game = this.experience.game
            const middle = structure.position.clone().setY(structure.def.height * 0.5)
            game.debris.scatter(middle, structure.def.blocks ? 8 : 3, 4)
            game.effects.burst('dust', middle, 14, { speed: 2 })
            this.experience.sounds.play('metal_bong', { position: middle, volume: 0.9 })
        }
        this.grid.remove(structure)
        structure.model.batch.clear()
        structure.model.gun?.clear()
        structure.model.yoke?.clear()
        structure.model.group.removeFromParent()
        this.list.splice(this.list.indexOf(structure), 1)
    }

    // End of a round: whatever still stands goes back into the inventory with the damage it took
    returnAll(inventory)
    {
        const count = this.list.length
        for(const structure of [...this.list])
        {
            inventory.add(structure.type, Math.ceil(structure.hp))
            this.destroy(structure, true)
        }
        return count
    }

    update(delta)
    {
        for(const structure of [...this.list])
            structure.update(delta)
    }
}
