import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'

// Ghost colors from tokens.css: manila where it fits, red lead where it cannot go, hazard on what would be picked up
const FITS = '#d6c58f'
const BLOCKED = '#8c3b22'
const PICK = '#e2b100'
const MARCH = 0.25

// Placing and picking up. In prep it follows the mouse over the top-down map. In the fight B or Tab
// turns it on and it follows the crosshair, within BUILD_RANGE of the player.
//   1-7 choose, R turns a quarter clockwise, left button places (hold and drag for a row), right button or X picks up.
//   On the prep map 8 is the repair tool: a click on something damaged fixes it for scrap, see repairCost.
export default class Build
{
    constructor()
    {
        this.experience = new Experience()
        this.input = this.experience.input
        this.world = this.experience.world
        this.grid = this.world.grid
        this.game = this.experience.game

        this.active = false
        this.selected = config.BUILD_ORDER[0]
        this.rotation = 0   // quarter turns clockwise on the map
        this.target = null
        this.lastCell = -1
        this.dragging = false   // a row being placed, only ever started by a fresh click
        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2()

        this.setGhost()
    }

    get prep()
    {
        return this.game.rounds.phase === 'prep'
    }

    get on()
    {
        return this.world.player.alive && (this.prep || this.active)
    }

    // One see-through box per cell of the footprint, and a ring on the ground for whatever has a reach
    setGhost()
    {
        this.ghostMaterial = new THREE.MeshBasicMaterial({ color: FITS, transparent: true, opacity: 0.35, depthWrite: false })
        const size = this.grid.cell * 0.96
        const box = new THREE.BoxGeometry(size, 1, size).translate(0, 0.5, 0)
        this.ghost = new THREE.Group()
        this.boxes = [0, 1, 2].map(() =>
        {
            const mesh = new THREE.Mesh(box, this.ghostMaterial)
            this.ghost.add(mesh)
            return mesh
        })

        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(0.96, 1, 72).rotateX(- Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: FITS, transparent: true, opacity: 0.6, depthWrite: false })
        )
        this.ghost.visible = false
        this.ring.visible = false
        this.experience.scene.add(this.ghost, this.ring)
    }

    // The cell under the mouse in prep, under the crosshair in the fight. Marches the ray through the
    // world's heights, so a wall in front wins over the ground behind it.
    aim()
    {
        const mouse = this.input.mouse
        this.pointer.set(this.prep ? mouse.ndcX : 0, this.prep ? mouse.ndcY : 0)
        // The camera moved since its matrix was last worked out, which happens when a frame renders
        const camera = this.experience.camera.instance
        camera.updateMatrixWorld()
        this.raycaster.setFromCamera(this.pointer, camera)
        const { origin, direction } = this.raycaster.ray

        // Nothing stands taller than 8 m, start the march there
        let distance = direction.y < 0 && origin.y > 8 ? (origin.y - 8) / - direction.y : 0
        const far = distance + (this.prep ? 150 : config.BUILD_RANGE + 10)
        for(; distance < far; distance += MARCH)
        {
            const x = origin.x + direction.x * distance
            const y = origin.y + direction.y * distance
            const z = origin.z + direction.z * distance
            if(y <= 0 || this.world.heightAt(x, z) > y)
                return this.grid.worldToCell(x, z)
        }
        return null
    }

    // Why the selected thing cannot go on these cells, or '' when it can
    problem(cells)
    {
        const def = config.STRUCTURES[this.selected]
        const grid = this.grid
        const player = this.world.player
        if(!grid.canPlace(cells))
            return 'Not here'
        if(!this.prep && grid.distanceToCells(player.position.x, player.position.z, cells) > config.BUILD_RANGE)
            return 'Too far'
        if(def.blocks)
        {
            // In prep she gets moved to a free spot when the round starts
            if(!this.prep && grid.distanceToCells(player.position.x, player.position.z, cells) < config.PLAYER.radius)
                return 'You are standing there'
            for(const enemy of this.game.enemies.list)
                if(!enemy.dying && !enemy.def.flying && grid.distanceToCells(enemy.position.x, enemy.position.z, cells) < enemy.def.radius)
                    return 'Enemy in the way'
        }
        if(this.game.inventory.count(this.selected) === 0 && this.game.scrap < def.cost)
            return 'Not enough scrap'
        return ''
    }

    findTarget()
    {
        const cell = this.aim()
        if(!cell || !this.grid.inBounds(cell.i, cell.j))
            return null
        const structure = this.grid.structures[this.grid.index(cell.i, cell.j)]
        if(this.selected === 'repair')
        {
            const cost = structure ? this.repairCost(structure) : 0
            const problem = !structure ? 'Nothing to repair' : cost <= 0 ? 'Not damaged' : this.game.scrap < cost ? 'Not enough scrap' : ''
            return { ...cell, cells: [], structure, cost, problem }
        }
        const cells = this.grid.footprint(this.selected, cell.i, cell.j, this.rotation)
        return {
            ...cell,
            cells,
            structure,
            problem: this.problem(cells)
        }
    }

    place(target)
    {
        const def = config.STRUCTURES[this.selected]
        let hp = this.game.inventory.take(this.selected)
        if(hp === null)
        {
            if(!this.game.spend(def.cost))
                return
            hp = def.hp
        }
        const structure = this.game.structures.place(this.selected, target.i, target.j, this.rotation, hp)
        this.lastCell = this.grid.index(target.i, target.j)
        this.experience.sounds.play('metal_4', { position: structure.position, volume: 0.5 })
    }

    // A share of its price for the share of health it lost
    repairCost(structure)
    {
        return Math.ceil(structure.def.cost * config.REPAIR_SHARE * (1 - structure.hp / structure.maxHp))
    }

    repair(structure)
    {
        const cost = this.repairCost(structure)
        if(cost <= 0 || !this.game.spend(cost))
            return false
        structure.hp = structure.maxHp
        this.game.effects.burst('spark', structure.position.clone().setY(structure.def.height * 0.6), 8)
        this.experience.sounds.play('metal_clink', { position: structure.position, volume: 0.6 })
        return true
    }

    // Back into the inventory, damage and all
    pickUp(structure)
    {
        const player = this.world.player
        if(!this.prep && this.grid.distanceToCells(player.position.x, player.position.z, structure.cells) > config.BUILD_RANGE)
            return
        this.game.inventory.add(structure.type, Math.ceil(structure.hp))
        this.game.structures.destroy(structure, true)
        this.experience.sounds.play('metal_clink', { volume: 0.5 })
    }

    show(target)
    {
        const picking = target.structure
        // The repair tool over open ground has nothing to show
        if(!picking && !config.STRUCTURES[this.selected])
            return
        const cells = picking ? picking.cells : target.cells
        const def = picking ? picking.def : config.STRUCTURES[this.selected]
        const color = picking ? PICK : target.problem ? BLOCKED : FITS
        this.ghostMaterial.color.set(color)

        const middle = { x: 0, z: 0 }
        this.boxes.forEach((box, n) =>
        {
            box.visible = n < cells.length
            if(!box.visible)
                return
            const { x, z } = this.grid.cellToWorld(cells[n].i, cells[n].j)
            box.position.set(x, 0, z)
            box.scale.y = def.height + (picking ? 0.15 : 0)
            middle.x += x / cells.length
            middle.z += z / cells.length
        })
        this.ghost.visible = true

        const reach = def.range || def.radius
        this.ring.visible = !!reach
        if(reach)
        {
            this.ring.position.set(middle.x, 0.06, middle.z)
            this.ring.scale.setScalar(reach)
            this.ring.material.color.set(color === BLOCKED ? BLOCKED : FITS)
        }
    }

    update(delta)
    {
        const input = this.input
        const order = config.BUILD_ORDER
        if(this.prep || !this.world.player.alive)
            this.active = false
        else if(input.justPressed('KeyB') || input.justPressed('Tab'))
            this.active = !this.active

        this.ghost.visible = false
        this.ring.visible = false
        this.target = null
        if(!this.on)
        {
            this.dragging = false
            return
        }

        order.forEach((type, n) =>
        {
            if(input.justPressed(`Digit${n + 1}`))
                this.selected = type
        })
        if(this.prep && input.justPressed(`Digit${order.length + 1}`))
            this.selected = 'repair'
        if(!this.prep && this.selected === 'repair')
            this.selected = order[0]
        // In prep the wheel zooms the map
        if(!this.prep && input.mouse.wheel)
            this.selected = order[(order.indexOf(this.selected) + Math.sign(input.mouse.wheel) + order.length) % order.length]
        if(input.justPressed('KeyR'))
            this.rotation = (this.rotation + 1) % 4

        const target = this.target = this.findTarget()
        if(!target)
            return
        this.show(target)

        if(this.selected === 'repair')
        {
            if(target.structure && input.mouse.leftPressed && !target.problem)
                this.repair(target.structure)
            if(target.structure && (input.justPressed('KeyX') || input.mouse.rightClick))
                this.pickUp(target.structure)
            return
        }

        const pickUp = input.justPressed('KeyX') || (this.prep ? input.mouse.rightClick : input.mouse.rightPressed)
        if(pickUp && target.structure)
        {
            this.pickUp(target.structure)
            return
        }

        // A button still held from the fight when the map comes up must place nothing: the camera flying up
        // moves the cell under the cursor every frame, and dragging would spill the inventory over the map
        if(input.mouse.leftPressed)
            this.dragging = true
        if(!input.mouse.left)
        {
            this.dragging = false
            this.lastCell = -1
        }
        const cell = this.grid.index(target.i, target.j)
        if(this.dragging && (input.mouse.leftPressed || cell !== this.lastCell) && !target.problem)
            this.place(target)
    }
}
