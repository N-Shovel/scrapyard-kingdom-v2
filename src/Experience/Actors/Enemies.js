import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'
import Enemy from './Enemy.js'

const frustum = new THREE.Frustum()
const viewProjection = new THREE.Matrix4()

// Every enemy in the yard. Spawns at gates, keeps them from standing inside each other, clears up.
export default class Enemies
{
    constructor()
    {
        this.experience = new Experience()
        this.world = this.experience.world
        this.grid = this.world.grid
        this.player = this.world.player

        // Shadows fall away from the sun, this far per meter of height
        const sun = this.world.environment.sun.position
        this.shadowAway = new THREE.Vector3(-sun.x, 0, -sun.z).normalize()
        this.shadowSlope = sun.y / Math.hypot(sun.x, sun.z)

        this.list = []
        this.group = new THREE.Group()
        this.experience.scene.add(this.group)
    }

    // Still a threat: spawned and not dying
    get alive()
    {
        let count = 0
        for(const enemy of this.list)
            if(!enemy.dying)
                count++
        return count
    }

    spawn(type, gate, scaling)
    {
        const { i, j } = gate.cells[Math.floor(Math.random() * gate.cells.length)]
        const { x, z } = this.grid.cellToWorld(i, j)
        const enemy = new Enemy(type, x + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.8, scaling, gate)
        this.list.push(enemy)
        this.group.add(enemy.model)
        return enemy
    }

    // End of a round: whoever is left goes, without scrap
    clear()
    {
        for(const enemy of this.list)
            enemy.destroy()
        this.list = []
    }

    // Enemies push each other apart, and ground ones push the player, mostly moving themselves
    separate()
    {
        const list = this.list
        const player = this.player
        const playerRadius = config.PLAYER.radius

        for(let a = 0; a < list.length; a++)
        {
            const first = list[a]
            if(first.dying)
                continue

            for(let b = a + 1; b < list.length; b++)
            {
                const second = list[b]
                if(second.dying || !!first.def.flying !== !!second.def.flying)
                    continue
                const dx = second.position.x - first.position.x
                const dz = second.position.z - first.position.z
                const reach = first.def.radius + second.def.radius
                const squared = dx * dx + dz * dz
                if(squared < reach * reach && squared > 1e-6)
                {
                    const distance = Math.sqrt(squared)
                    const push = (reach - distance) * 0.5
                    first.position.x -= (dx / distance) * push
                    first.position.z -= (dz / distance) * push
                    second.position.x += (dx / distance) * push
                    second.position.z += (dz / distance) * push
                }
            }

            if(player.alive && !first.def.flying && player.position.y < first.def.height)
            {
                const dx = first.position.x - player.position.x
                const dz = first.position.z - player.position.z
                const reach = first.def.radius + playerRadius
                const squared = dx * dx + dz * dz
                if(squared < reach * reach && squared > 1e-6)
                {
                    const distance = Math.sqrt(squared)
                    const push = reach - distance
                    first.position.x += (dx / distance) * push * 0.7
                    first.position.z += (dz / distance) * push * 0.7
                    player.position.x -= (dx / distance) * push * 0.3
                    player.position.z -= (dz / distance) * push * 0.3
                }
            }
        }

        for(const enemy of list)
            if(!enemy.def.flying && !enemy.dying)
                this.grid.resolveCircle(enemy.position, enemy.def.radius)
    }

    update(delta)
    {
        const camera = this.experience.camera.instance
        frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
        for(const enemy of this.list)
        {
            enemy.update(delta)
            enemy.setShadow(frustum, this.shadowAway, this.shadowSlope)
        }
        this.separate()

        if(this.list.some((enemy) => enemy.gone))
        {
            for(const enemy of this.list)
                if(enemy.gone)
                    enemy.destroy()
            this.list = this.list.filter((enemy) => !enemy.gone)
        }
    }
}
