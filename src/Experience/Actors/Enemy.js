import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import Experience from '../Experience.js'
import config from '../Game/config.js'
import { STASH } from '../Game/Grid.js'

const FADE = 0.2
const SINK_AFTER = 1.2    // seconds a body lies there after its death clip, then it sinks away
const SINK_TIME = 1.5
// A model with no attack clip lunges at each blow, one with no death clip freezes and topples over
const LUNGE = 0.35        // radians of forward lean at the blow
const LUNGE_IN = 0.08     // seconds to lean in, then
const LUNGE_OUT = 0.3     // seconds to straighten up
const TOPPLE = 0.7        // seconds to fall flat

// Measured once per model: how much to scale it to its height in config
const prepared = {}

const shadowSphere = new THREE.Sphere()

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const damp = (rate, delta) => 1 - Math.exp(-rate * delta)

// One enemy: where it goes, what it hits, which clip plays. Facing works like the player's:
// the model looks along (sin yaw, 0, cos yaw).
// Ground enemies follow the flow field to the Stash, break off for the player or a turret, and go for
// the wall their gate is locked on. Drones fly straight in and shoot from range.
export default class Enemy
{
    constructor(type, x, z, scaling, gate)
    {
        this.experience = new Experience()
        this.resources = this.experience.resources
        this.world = this.experience.world
        this.grid = this.world.grid
        this.player = this.world.player

        this.type = type
        this.def = config.ENEMIES[type]
        this.gate = gate
        this.hp = this.maxHp = Math.round(this.def.hp * scaling.hp)
        this.strength = this.def.damage * scaling.damage
        this.speed = this.def.speed * scaling.speed

        this.position = new THREE.Vector3(x, this.def.flying ? this.def.flyHeight : 0, z)
        this.yaw = 0
        this.targetYaw = 0
        this.aggressive = Math.random() < (this.def.aggroChance ?? 0)
        this.chasing = false
        this.moving = false
        this.attackCooldown = 0
        this.stagger = 0      // seconds a hit reaction keeps playing
        this.swing = 0        // seconds left of a swing that has started, it plays out before walking again
        this.slow = 0         // seconds left in a tar pit (T08)
        this.orbit = Math.random() * Math.PI * 2
        this.hover = Math.random() * 10
        this.dying = false
        this.gone = false
        this.struck = Infinity    // seconds since its last blow landed

        this.setModel()
        this.setAnimation()
    }

    setModel()
    {
        const source = this.resources.items[this.def.model]
        if(!prepared[this.type])
        {
            // Measured in the rest pose. Downloads put their origin anywhere, so the feet go onto it.
            source.scene.updateMatrixWorld(true)
            const box = new THREE.Box3().setFromObject(source.scene, true)
            const scale = this.def.height / box.getSize(new THREE.Vector3()).y
            const center = box.getCenter(new THREE.Vector3())
            prepared[this.type] = { scale, offset: new THREE.Vector3(-center.x, -box.min.y, -center.z).multiplyScalar(scale) }
        }

        const { scale, offset } = prepared[this.type]
        this.scale = scale
        // The model turns and tips over about its feet
        this.body = clone(source.scene)
        this.body.scale.setScalar(scale)
        this.body.position.copy(offset)
        this.model = new THREE.Group()
        this.model.add(this.body)
        this.model.rotation.order = 'YXZ'
        this.model.position.copy(this.position)
        // Its own copy of the material, so it can flash when hit while the rest of the pack does not.
        // The shader program stays shared.
        this.materials = []
        this.meshes = []
        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return
            child.castShadow = true
            this.meshes.push(child)
            child.material = child.material.clone()
            this.materials.push(child.material)
        })
        this.flash = 0
    }

    setAnimation()
    {
        const clips = this.resources.items[this.def.model].animations
        this.mixer = new THREE.AnimationMixer(this.body)
        this.actions = {}
        for(const [role, name] of Object.entries(this.def.clips))
            if(name)
                this.actions[role] = this.mixer.clipAction(clips.find((clip) => clip.name === name))

        // No attack clip: it stands and lunges (see update)
        this.lunges = !this.actions.attack
        this.actions.attack ??= this.actions.idle
        // One swing per blow, whatever the clip's own length. The drone's quick shot loops as a burst instead.
        if(!this.def.flying && !this.lunges)
            this.actions.attack.timeScale = this.actions.attack.getClip().duration / this.def.attackRate
        for(const role of ['hit', 'death'])
        {
            if(!this.actions[role])
                continue
            this.actions[role].setLoop(THREE.LoopOnce)
            this.actions[role].clampWhenFinished = true
        }

        this.current = this.actions.idle
        this.current.play()
        // Out of step with the rest of the pack
        this.mixer.update(Math.random() * 2)
    }

    // Crossfade to another clip, as in lesson 4.3
    play(role)
    {
        const next = this.actions[role]
        if(!next || next === this.current)
            return
        next.reset().play()
        next.crossFadeFrom(this.current, FADE)
        this.current = next
    }

    // What every attack, shot and trap calls
    hit(amount)
    {
        if(this.dying)
            return
        this.hp -= amount
        this.flash = 0.07
        if(this.hp <= 0)
        {
            this.die()
            return
        }
        if(this.actions.hit && this.stagger <= 0)
        {
            this.play('hit')
            this.stagger = this.actions.hit.getClip().duration
        }
    }

    die()
    {
        this.dying = true
        this.deathTime = 0
        this.play('death')
        // No death clip: it powers down where it stands and topples over
        if(!this.actions.death)
            this.mixer.timeScale = 0
        const game = this.experience.game
        game.kills++

        const middle = this.position.clone().setY(this.def.flying ? this.position.y : this.def.height * 0.5)
        game.pickups.drop(middle, this.def.scrap)
        this.experience.sounds.play(this.def.flesh ? 'flesh' : 'metal_bong', { position: middle, volume: 0.8 })
        if(!this.def.flying && !this.def.flesh)
        {
            game.debris.scatter(middle, 3, 3)
            game.effects.burst('oil', middle, 8, { speed: 1.4 })
        }
    }

    face(x, z)
    {
        this.targetYaw = Math.atan2(x - this.position.x, z - this.position.z)
    }

    // The wall this enemy's gate is locked on, if any
    lock()
    {
        if(!this.gate)
            return null
        const wall = this.def.wallBreaker ? this.gate.bruteLock : this.gate.lock
        return wall && !wall.dead ? wall : null
    }

    // Raiders go for a turret or flak right next to them
    turretInReach()
    {
        const grid = this.grid
        const { i, j } = grid.worldToCell(this.position.x, this.position.z)
        for(let dj = -1; dj <= 1; dj++)
            for(let di = -1; di <= 1; di++)
            {
                if(!grid.inBounds(i + di, j + dj))
                    continue
                const structure = grid.structures[grid.index(i + di, j + dj)]
                if(structure && (structure.type === 'turret' || structure.type === 'flak') && this.reaches(structure.cells))
                    return this.target('structure', structure)
            }
        return null
    }

    reaches(cells, extra = 0.2)
    {
        return this.grid.distanceToCells(this.position.x, this.position.z, cells) < this.def.range + extra
    }

    target(kind, structure)
    {
        if(kind === 'stash')
            return { kind, x: this.world.stash.position.x, z: this.world.stash.position.z }
        const { i, j } = structure.cells[0]
        return { kind, structure, ...this.grid.cellToWorld(i, j) }
    }

    think(delta)
    {
        const def = this.def
        const grid = this.grid
        const player = this.player
        const { x, z } = this.position
        let moveTo = null
        let attack = null

        const toPlayer = player.alive ? Math.hypot(player.position.x - x, player.position.z - z) : Infinity
        // Once chasing it keeps going a little further before it gives up
        const chaseRange = this.chasing ? def.aggro * 1.5 : def.aggro

        if(toPlayer < def.range + config.PLAYER.radius && player.position.y < def.height)
            attack = { kind: 'player', x: player.position.x, z: player.position.z }
        else if(this.aggressive && toPlayer < chaseRange && grid.lineClear(x, z, player.position.x, player.position.z))
        {
            moveTo = player.position
            this.chasing = true
        }
        else
        {
            this.chasing = false
            if(def.hatesTurrets)
                attack = this.turretInReach()

            const { i, j } = grid.worldToCell(x, z)
            const wall = attack ? null : this.lock()
            if(wall)
            {
                if(this.reaches(wall.cells))
                    attack = this.target('structure', wall)
                else
                {
                    const next = grid.nextCellTo(i, j, wall)
                    if(next)
                        moveTo = grid.cellToWorld(next.i, next.j)
                }
            }

            if(!attack && !moveTo)
            {
                const next = grid.nextCell(i, j, def.wallBreaker ? grid.flowBrute : grid.flowNormal)
                const atStash = this.reaches(grid.stashCells)
                if(!next)
                {
                    if(atStash)
                        attack = this.target('stash')
                    else
                        moveTo = this.world.stash.position
                }
                else
                {
                    const k = grid.index(next.i, next.j)
                    const structure = grid.structures[k]
                    if(grid.terrain[k] === STASH && atStash)
                        attack = this.target('stash')
                    else if(structure && structure.def.blocks && this.reaches(structure.cells))
                        attack = this.target('structure', structure)
                    else
                        moveTo = grid.cellToWorld(next.i, next.j)
                }
            }
        }

        this.act(delta, moveTo, attack)
    }

    act(delta, moveTo, attack)
    {
        this.moving = false
        if(attack)
        {
            this.face(attack.x, attack.z)
            if(this.current !== this.actions.attack && this.stagger <= 0)
            {
                // The first blow lands mid swing, not the moment the clip starts
                this.attackCooldown = Math.max(this.attackCooldown, this.def.attackRate * 0.45)
                this.swing = this.def.attackRate
            }
            this.setState('attack')
            if(this.attackCooldown <= 0)
            {
                this.attackCooldown = this.def.attackRate
                this.strike(attack)
            }
        }
        // A target stepping just out of reach would flip it between walking and swinging every frame
        else if(this.swing > 0)
        {
            if(moveTo)
                this.face(moveTo.x, moveTo.z)
        }
        else if(moveTo)
        {
            const dx = moveTo.x - this.position.x
            const dz = moveTo.z - this.position.z
            const distance = Math.hypot(dx, dz)
            if(distance > 0.05)
            {
                const slow = this.slow > 0 ? config.STRUCTURES.tar.slow : 1
                const step = Math.min(distance, this.speed * slow * delta)
                this.position.x += (dx / distance) * step
                this.position.z += (dz / distance) * step
                this.face(moveTo.x, moveTo.z)
                this.moving = true
            }
            this.setState(this.moving ? 'walk' : 'idle')
        }
        else
            this.setState('idle')

        this.yaw += wrap(this.targetYaw - this.yaw) * damp(10, delta)
    }

    strike(attack)
    {
        this.struck = 0
        const sound = attack.kind === 'player' ? 'flesh' : 'metal'
        this.experience.sounds.play(sound, { position: this.position, volume: attack.kind === 'player' ? 0.5 : 0.45 })
        if(attack.kind === 'player')
            this.player.takeDamage(this.strength)
        else if(attack.kind === 'structure')
            attack.structure.damage(this.strength)
        else
            this.experience.game.damageStash(this.strength, this)
    }

    // A hit reaction plays out before anything else takes over
    setState(role)
    {
        if(this.stagger <= 0)
            this.play(role)
    }

    // Drones fly over every wall toward the Stash, or the player, circle in range and shoot
    thinkAir(delta)
    {
        const def = this.def
        const player = this.player
        const toPlayer = player.alive ? Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) : Infinity
        const chaseRange = this.chasing ? def.aggro * 1.5 : def.aggro
        this.chasing = this.aggressive && toPlayer < chaseRange
        const target = this.chasing
            ? { kind: 'player', x: player.position.x, z: player.position.z }
            : this.target('stash')

        const dx = target.x - this.position.x
        const dz = target.z - this.position.z
        const distance = Math.hypot(dx, dz)
        this.face(target.x, target.z)
        this.moving = false

        if(distance > def.range * 0.8)
        {
            const step = Math.min(distance - def.range * 0.7, this.speed * delta)
            this.position.x += (dx / distance) * step
            this.position.z += (dz / distance) * step
            this.moving = true
            this.setState('walk')
        }
        else
        {
            // Strafe around the target while shooting
            this.orbit += delta * 0.6
            this.position.x += Math.cos(this.orbit) * delta * 1.5
            this.position.z += Math.sin(this.orbit) * delta * 1.5
            this.setState('attack')
            if(this.attackCooldown <= 0)
            {
                this.attackCooldown = def.attackRate
                // Drones shoot: a streak from under the body to the target
                const game = this.experience.game
                const from = this.position.clone().setY(this.position.y - 0.3)
                const to = new THREE.Vector3(target.x, target.kind === 'player' ? player.position.y + 1.2 : 2, target.z)
                game.effects.tracer(from, to, { color: '#ff7a4a', life: 0.08 })
                game.effects.burst('spark', to, 3)
                this.experience.sounds.play('shot_3', { position: this.position, volume: 0.35 })
                this.strike(target)
            }
        }

        this.hover += delta
        this.position.y = def.flyHeight + Math.sin(this.hover * 2) * 0.3
        this.yaw += wrap(this.targetYaw - this.yaw) * damp(6, delta)
    }

    // Lies there a moment, then sinks into the dirt. Drones drop out of the sky first.
    fall(delta)
    {
        this.deathTime += delta
        if(this.def.flying)
            this.position.y = Math.max(0, this.position.y - delta * (2 + this.deathTime * 18))

        const lying = this.actions.death?.getClip().duration ?? TOPPLE
        const sinking = this.deathTime - lying - SINK_AFTER
        if(sinking > 0)
            this.position.y -= delta * this.def.height / SINK_TIME
        if(sinking > SINK_TIME)
            this.gone = true
    }

    // The sun is low, so a shadow reaches well past the feet: a sphere from the feet to the shadow's tip.
    // When that sphere is out of view the enemy skips the shadow pass. With a crowd off screen, that pass
    // was a third of the frame (docs/reports/T21-lean.md).
    setShadow(frustum, away, slope)
    {
        const half = (this.position.y + this.def.height) / slope / 2
        shadowSphere.center.set(this.position.x + away.x * half, 0, this.position.z + away.z * half)
        shadowSphere.radius = half + this.def.radius + 1
        const cast = frustum.intersectsSphere(shadowSphere)
        if(cast === this.casting)
            return
        this.casting = cast
        for(const mesh of this.meshes)
            mesh.castShadow = cast
    }

    update(delta)
    {
        if(this.dying)
            this.fall(delta)
        else
        {
            this.attackCooldown -= delta
            this.stagger -= delta
            this.swing -= delta
            this.slow -= delta
            if(this.def.flying)
                this.thinkAir(delta)
            else
                this.think(delta)
        }

        // Walk clip as fast as the feet really move
        if(this.def.clipSpeed && this.moving)
            this.actions.walk.timeScale = this.speed * (this.slow > 0 ? config.STRUCTURES.tar.slow : 1) / (this.def.clipSpeed * this.scale)

        this.mixer.update(delta)
        this.model.position.copy(this.position)
        this.model.rotation.y = this.yaw
        this.model.rotation.x = this.def.flying && !this.dying && this.moving ? 0.25 : 0
        this.struck += delta
        if(this.lunges && !this.dying)
            this.model.rotation.x = LUNGE * (this.struck < LUNGE_IN ? this.struck / LUNGE_IN : Math.max(0, 1 - (this.struck - LUNGE_IN) / LUNGE_OUT))
        if(this.dying && !this.actions.death)
        {
            // Falls on its back, faster as it goes
            const t = Math.min(1, this.deathTime / TOPPLE)
            this.model.rotation.x = -Math.PI * 0.5 * t * t
        }

        this.flash -= delta
        // A warm flash, like the shot heated it, not a white silhouette
        const glow = this.flash > 0 ? 0.32 : 0
        for(const material of this.materials)
            material.emissive.setRGB(glow, glow * 0.65, glow * 0.4)
    }

    destroy()
    {
        for(const material of this.materials)
            material.dispose()
        this.mixer.stopAllAction()
        this.mixer.uncacheRoot(this.model)
        this.model.removeFromParent()
    }
}
