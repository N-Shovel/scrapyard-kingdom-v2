import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'

const SHOTGUN = config.WEAPONS.shotgun
const HEADSHOT = 1.6      // damage multiplier in the top fifth of an enemy
const MARCH = 0.2         // meters per step when tracing through the world
const KICK = 0.035        // radians the view climbs per shot

// The scrap shotgun. Pellets are traced against boxes around enemies and the world's cell heights,
// never against meshes: thousands of instances are too slow to raycast. R reloads.
// Repairs are bought with scrap on the prep map, see Build.
export default class Weapons
{
    constructor()
    {
        this.experience = new Experience()
        this.input = this.experience.input
        this.camera = this.experience.camera
        this.sounds = this.experience.sounds
        this.world = this.experience.world
        this.grid = this.world.grid
        this.player = this.world.player
        this.game = this.experience.game

        this.ammo = SHOTGUN.mag
        this.reloading = 0
        this.cooldown = 0

        this.ray = new THREE.Ray()
        this.box = new THREE.Box3()
        this.point = new THREE.Vector3()
        this.origin = new THREE.Vector3()
        this.forward = new THREE.Vector3()
        this.right = new THREE.Vector3()
        this.up = new THREE.Vector3()
        this.direction = new THREE.Vector3()
        this.muzzle = new THREE.Vector3()
        this.start = 0
    }

    // Shells per reload, more with the Extended tube
    get mag()
    {
        return SHOTGUN.mag + this.game.upgrades.bonus('mag')
    }

    // No weapon while down, building, or on the prep map
    get busy()
    {
        return !this.player.alive || this.game.build.active || this.camera.mode === 'top'
    }

    reload()
    {
        if(this.reloading > 0 || this.ammo >= this.mag)
            return
        this.reloading = SHOTGUN.reload
        // The recording starts with silence
        this.sounds.play('reload_shell', { offset: 0.65, duration: 1, volume: 0.3 })
    }

    // The view's ray. In third person it starts level with her, so nothing between camera and her is hit.
    aimRay()
    {
        const camera = this.camera.instance
        camera.updateMatrixWorld()
        camera.getWorldPosition(this.origin)
        camera.getWorldDirection(this.forward)
        this.right.setFromMatrixColumn(camera.matrixWorld, 0)
        this.up.setFromMatrixColumn(camera.matrixWorld, 1)
        this.point.copy(this.player.position)
        this.point.y += this.player.eyeHeight
        this.start = Math.max(0, this.point.sub(this.origin).dot(this.forward))
    }

    // The first thing along a ray from start to far: { distance, point, enemy, head } or
    // { distance, point, structure, ground }, or null for nothing
    trace(origin, direction, start, far)
    {
        this.ray.set(origin, direction)
        let best = far
        let hit = null
        for(const enemy of this.game.enemies.list)
        {
            if(enemy.dying)
                continue
            const { position, def } = enemy
            const bottom = def.flying ? position.y - def.height / 2 : 0
            this.box.min.set(position.x - def.radius, bottom, position.z - def.radius)
            this.box.max.set(position.x + def.radius, bottom + def.height, position.z + def.radius)
            if(!this.ray.intersectBox(this.box, this.point))
                continue
            const distance = this.point.distanceTo(origin)
            if(distance < start || distance >= best)
                continue
            best = distance
            hit = { distance, point: this.point.clone(), enemy, head: this.point.y > bottom + def.height * 0.8 }
        }

        // Piles, structures, the wall and the ground, closer than any enemy that was hit
        for(let distance = start; distance < best; distance += MARCH)
        {
            const x = origin.x + direction.x * distance
            const y = origin.y + direction.y * distance
            const z = origin.z + direction.z * distance
            if(y > 0 && this.world.heightAt(x, z) <= y)
                continue
            const { i, j } = this.grid.worldToCell(x, z)
            const structure = y > 0 && this.grid.inBounds(i, j) ? this.grid.structures[this.grid.index(i, j)] : null
            return { distance, point: new THREE.Vector3(x, Math.max(y, 0.02), z), structure, ground: y <= 0 }
        }
        return hit
    }

    fire()
    {
        const upgrades = this.game.upgrades
        this.ammo--
        this.cooldown = SHOTGUN.fireRate / (1 + upgrades.bonus('rate'))
        // Raises the rifle at once, so even the first shot leaves the shouldered muzzle
        this.player.recoil()
        this.aimRay()
        const muzzle = this.player.muzzle(this.muzzle)

        this.game.effects.flash(muzzle)
        this.game.effects.burst('puff', muzzle, 3, { direction: this.forward, spread: 0.6 })
        this.sounds.play('shot_1', { volume: 0.4 })
        // Out of the receiver to the right, low, so in first person it flies past the edge of the view
        const shell = muzzle.clone().addScaledVector(this.forward, -0.35).addScaledVector(this.right, 0.12).addScaledVector(this.up, -0.08)
        this.game.debris.spawn('shell', shell, this.right.clone().multiplyScalar(1.8).addScaledVector(this.up, 2.4), { life: 4 })

        let struck = null
        for(let n = 0; n < SHOTGUN.pellets; n++)
        {
            const angle = Math.random() * Math.PI * 2
            const radius = Math.sqrt(Math.random()) * SHOTGUN.spread
            this.direction.copy(this.forward)
                .addScaledVector(this.right, Math.cos(angle) * radius)
                .addScaledVector(this.up, Math.sin(angle) * radius)
                .normalize()
            const hit = this.trace(this.origin, this.direction, this.start, SHOTGUN.range)
            const end = hit ? hit.point : this.origin.clone().addScaledVector(this.direction, SHOTGUN.range)
            this.game.effects.tracer(muzzle, end)
            if(!hit)
                continue

            const back = this.direction.clone().negate()
            if(hit.enemy)
            {
                const flesh = hit.enemy.def.flesh
                hit.enemy.hit(SHOTGUN.damage * (1 + upgrades.bonus('dmg')) * (hit.head ? HEADSHOT : 1))
                this.game.effects.burst(flesh ? 'blood' : 'oil', hit.point, 3, { direction: back, spread: 0.9 })
                if(!flesh)
                    this.game.effects.burst('spark', hit.point, 2, { direction: back })
                struck = struck ?? hit
            }
            else
            {
                this.game.effects.burst('spark', hit.point, 2, { direction: back, spread: 1.3 })
                this.game.effects.burst('dust', hit.point, 1, { speed: 0.5 })
            }
        }
        if(struck)
            this.sounds.play(struck.enemy.def.flesh ? 'flesh' : 'metal', { position: struck.point, volume: 0.7 })
    }

    update(delta)
    {
        this.cooldown -= delta
        if(this.reloading > 0)
        {
            this.reloading -= delta
            if(this.reloading <= 0)
            {
                this.reloading = 0
                this.ammo = this.mag
                // The rack recording clips, about four times as loud as the shot. 0.1 sits it under the shell inserts.
                this.sounds.play('reload_rack', { offset: 0.55, volume: 0.1 })
            }
        }
        this.player.reloadProgress = this.reloading > 0 ? 1 - this.reloading / SHOTGUN.reload : 0
        if(this.busy)
            return

        const input = this.input
        if(input.justPressed('KeyR'))
            this.reload()
        if(input.mouse.left && this.cooldown <= 0 && this.reloading <= 0)
        {
            if(this.ammo > 0)
                this.fire()
            else
                this.reload()
        }
    }
}
