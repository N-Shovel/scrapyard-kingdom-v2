import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'
import createStructureModel from './createStructureModel.js'

const FLAK_REST = 0.55              // barrels' angle up from level with nothing to shoot
const FLAK_MIN = 0.2
const FLAK_MAX = 0.8                // the whole launcher leans on its post, further and its back sinks into the ring
const AIMED = 0.25                  // fires once the head is this close to the target, in radians

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const damp = (rate, delta) => 1 - Math.exp(-rate * delta)

// One placed thing: a wall, a turret or a trap. Enemies see type, def, cells, dead and damage().
export default class Structure
{
    constructor(type, cells, rotation, hp)
    {
        this.experience = new Experience()
        this.grid = this.experience.world.grid
        this.game = this.experience.game

        this.type = type
        this.def = config.STRUCTURES[type]
        this.cells = cells
        this.rotation = rotation  // quarter turns clockwise on the map
        this.hp = hp
        this.maxHp = this.def.hp
        this.dead = false

        this.cooldown = 0
        this.scan = 0
        this.target = null
        this.kick = 0
        this.shake = 0
        this.grow = 0

        // Middle of the footprint
        this.position = new THREE.Vector3()
        for(const { i, j } of cells)
        {
            const { x, z } = this.grid.cellToWorld(i, j)
            this.position.x += x / cells.length
            this.position.z += z / cells.length
        }

        this.model = createStructureModel(type)
        this.model.group.position.copy(this.position)
        // Models are built along +Z. A positive yaw turns counterclockwise seen from above, so clockwise is negative.
        this.model.group.rotation.y = - rotation * Math.PI / 2
        this.model.group.scale.y = 0.01
    }

    damage(amount)
    {
        if(this.dead)
            return
        this.hp -= amount
        this.shake = 0.15
        if(this.hp <= 0)
            this.game.structures.destroy(this)
    }

    // Ground enemies standing on it
    enemiesOn()
    {
        return this.game.enemies.list.filter((enemy) =>
            !enemy.dying && !enemy.def.flying &&
            this.grid.distanceToCells(enemy.position.x, enemy.position.z, this.cells) < enemy.def.radius * 0.5)
    }

    // Ground turrets fire over at most TURRET_MAX_COVER walls or piles. Flak shoots into open sky.
    canSee(enemy)
    {
        if(this.def.air)
            return true
        const cover = config.TURRET_MAX_COVER
        return this.grid.obstaclesBetween(this.position.x, this.position.z, enemy.position.x, enemy.position.z, cover) <= cover
    }

    pickTarget()
    {
        let best = null
        let bestDistance = this.def.range
        for(const enemy of this.game.enemies.list)
        {
            if(enemy.dying || !!enemy.def.flying !== !!this.def.air)
                continue
            const distance = Math.hypot(enemy.position.x - this.position.x, enemy.position.z - this.position.z)
            if(distance < bestDistance && this.canSee(enemy))
            {
                best = enemy
                bestDistance = distance
            }
        }
        return best
    }

    turret(delta)
    {
        const { head, pitch, barrels } = this.model
        this.cooldown -= delta
        this.scan -= delta
        this.kick = Math.max(0, this.kick - delta * 6)
        barrels.position.z = -0.12 * this.kick

        // Re-picking a few times a second is enough, the cover check marches the grid
        if(this.scan <= 0 || !this.target || this.target.dying)
        {
            this.scan = 0.2
            this.target = this.pickTarget()
        }

        const target = this.target
        if(!target)
        {
            head.rotation.y += delta * 0.4
            if(pitch)
                pitch.rotation.x += (- FLAK_REST - pitch.rotation.x) * damp(3, delta)
            return
        }

        // The head turns in the structure's own frame
        const want = Math.atan2(target.position.x - this.position.x, target.position.z - this.position.z) - this.model.group.rotation.y
        head.rotation.y += wrap(want - head.rotation.y) * damp(12, delta)

        if(pitch)
        {
            const flat = Math.hypot(target.position.x - this.position.x, target.position.z - this.position.z)
            const up = THREE.MathUtils.clamp(Math.atan2(target.position.y - head.position.y - pitch.position.y, flat), FLAK_MIN, FLAK_MAX)
            // Turning about +X by a negative angle lifts the barrels' +Z
            pitch.rotation.x += (- up - pitch.rotation.x) * damp(10, delta)
        }

        if(this.cooldown <= 0 && Math.abs(wrap(want - head.rotation.y)) < AIMED)
        {
            this.cooldown = this.def.fireRate
            this.kick = 1
            const effects = this.game.effects
            const from = this.model.muzzle.getWorldPosition(new THREE.Vector3())
            const to = target.position.clone()
            if(!target.def.flying)
                to.y = target.def.height * 0.6
            effects.tracer(from, to, { color: this.def.air ? '#cfe8ff' : '#ffd27a' })
            effects.burst('flash', from, 1)
            effects.burst(this.def.air ? 'smoke' : 'spark', to, this.def.air ? 2 : 3)
            this.experience.sounds.play('shot_3', { position: from, volume: 0.45, rate: this.def.air ? 1.25 : 1 })
            target.hit(this.def.damage * (1 + this.game.upgrades.bonus('turret')))
        }
    }

    // Stabs whatever stands on it, sinks and dulls as it wears out
    spikes(delta)
    {
        const spikes = this.model.spikes
        this.cooldown -= delta
        spikes.position.y = Math.max(0, spikes.position.y - delta * 2)
        spikes.scale.y = 0.35 + 0.65 * Math.max(0, this.hp / this.maxHp)
        if(this.cooldown > 0)
            return

        const victims = this.enemiesOn()
        if(!victims.length)
            return
        this.cooldown = this.def.rate
        spikes.position.y = 0.15
        for(const enemy of victims)
            enemy.hit(this.def.damage)
        this.experience.sounds.play('metal_clink', { position: this.position, volume: 0.4 })
        this.damage(this.def.wear * victims.length)
    }

    // Slows everything wading through it, and wears down while in use
    tar(delta)
    {
        const victims = this.enemiesOn()
        for(const enemy of victims)
            enemy.slow = 0.15
        if(victims.length)
            this.damage(this.def.wear * victims.length * delta)
    }

    // Goes off the first time a ground enemy steps on it, hurting everything around
    mine()
    {
        this.model.lamp.material.emissiveIntensity = Math.sin(this.experience.time.elapsed * 0.02) > 0 ? 2.5 : 0.2
        if(!this.enemiesOn().length)
            return

        const radius = this.def.radius
        for(const enemy of this.game.enemies.list)
        {
            if(enemy.dying || enemy.def.flying)
                continue
            const distance = Math.hypot(enemy.position.x - this.position.x, enemy.position.z - this.position.z)
            if(distance < radius)
                enemy.hit(this.def.damage * (1 - 0.6 * distance / radius))
        }
        const blast = this.position.clone().setY(0.4)
        this.game.effects.explosion(blast)
        this.experience.sounds.play('explosion', { position: blast, volume: 1 })
        this.game.structures.destroy(this, true)
    }

    update(delta)
    {
        // Drops into place, shudders when hit
        if(this.grow < 1)
        {
            this.grow = Math.min(1, this.grow + delta * 5)
            this.model.group.scale.y = 1 - (1 - this.grow) ** 3
        }
        this.shake -= delta
        const jolt = this.shake > 0 ? 0.06 : 0
        this.model.group.position.x = this.position.x + (Math.random() - 0.5) * jolt
        this.model.group.position.z = this.position.z + (Math.random() - 0.5) * jolt

        if(this.type === 'turret' || this.type === 'flak')
            this.turret(delta)
        else if(this.type === 'spikes')
            this.spikes(delta)
        else if(this.type === 'tar')
            this.tar(delta)
        else if(this.type === 'mine')
            this.mine()
    }
}
