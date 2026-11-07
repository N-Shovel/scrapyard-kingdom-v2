import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'
import PlayerAnimation from './PlayerAnimation.js'
import PlayerArms from './PlayerArms.js'
import PlayerHair from './PlayerHair.js'

const PLAYER = config.PLAYER
const MEDKIT = config.CONSUMABLES.medkit
const PITCH_LIMIT = 1.35
const SLIDE_EYE = 0.95

// Shortest way round from one angle to another, in -PI..PI
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

// Share of the remaining distance to cover this frame, the same at any frame rate
const damp = (rate, delta) => 1 - Math.exp(-rate * delta)

// Movement, look and collision. Facing: the model is turned by bodyYaw, its forward is (sin, 0, cos).
export default class Player
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.input = this.experience.input
        this.time = this.experience.time
        this.resources = this.experience.resources
        this.grid = this.experience.world.grid

        this.position = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this.yaw = 0            // where the camera looks
        this.pitch = 0
        this.bodyYaw = 0        // where the model faces: the camera's yaw, or the way it runs while sprinting
        this.speed = 0          // over the ground, measured after collisions
        this.eyeHeight = PLAYER.eye
        this.onGround = true
        this.airTime = 0
        this.aiming = false     // right button held
        this.aim = 0            // rifle shouldered, eases between 0 and 1. Shooting from the hip shoulders it too.
        this.zoom = 0           // the view pulled in to the sights, only for the right button
        this.shotHold = 0       // seconds the rifle stays up after a shot
        this.reloadProgress = 0 // 0 to 1 while reloading, set by Weapons
        this.lastStep = 0
        this.sprinting = false
        this.sliding = false
        this.view = 'third'
        this.hp = PLAYER.maxHp
        this.alive = true
        this.patching = 0       // seconds left of a medkit going on
        this.respawnTimer = 0

        this.setModel()
        this.animation = new PlayerAnimation(this)
        this.arms = new PlayerArms(this)
        this.hair = new PlayerHair(this.model)
        this.spawn()
    }

    setModel()
    {
        this.model = this.resources.items.player.scene
        this.clips = this.resources.items.player.animations
        this.materials = new Set()

        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return
            child.castShadow = true
            child.receiveShadow = true
            this.materials.add(child.material)
        })
        this.scene.add(this.model)
    }

    // Where shots leave from: the rifle's muzzle on the copy that is seen
    muzzle(target)
    {
        const model = this.view === 'first' && this.alive ? this.arms.model : this.model
        return model.getObjectByName('muzzle').getWorldPosition(target)
    }

    // A shot from the hip shoulders the rifle at once and keeps it up for a moment
    recoil()
    {
        this.shotHold = 1.2
        this.animation.fire()
        this.arms.kick = 1
        if(this.aim < 0.95)
        {
            this.aim = 1
            this.animation.update(0)
        }
        this.pitch = Math.min(PITCH_LIMIT, this.pitch + 0.035)
    }

    // Nearest open cell two south of the Stash, facing out into the yard
    spawn()
    {
        const grid = this.grid
        const start = grid.stashCells.at(-1)
        for(let ring = 0; ring < 8; ring++)
        {
            for(let dj = -ring; dj <= ring; dj++)
            {
                for(let di = -ring; di <= ring; di++)
                {
                    const i = start.i + di
                    const j = start.j + 2 + dj
                    if(Math.max(Math.abs(di), Math.abs(dj)) !== ring || !grid.walkable(i, j) || grid.reserved.has(grid.index(i, j)))
                        continue

                    const { x, z } = grid.cellToWorld(i, j)
                    this.position.set(x, 0, z)
                    this.velocity.set(0, 0, 0)
                    this.yaw = this.bodyYaw = 0
                    this.pitch = -0.12
                    return
                }
            }
        }
    }

    // First person hides the full model, which still throws a shadow, and shows the arms copy on the camera
    setView(view)
    {
        this.view = view
        const first = view === 'first'
        for(const material of this.materials)
        {
            material.colorWrite = !first
            material.depthWrite = !first
        }
        this.arms.holder.visible = first
    }

    look()
    {
        if(!this.input.locked)
            return

        const { mouse } = this.input
        const sensitivity = config.MOUSE_SENS * (1 - this.zoom * 0.4)
        this.yaw -= mouse.dx * sensitivity
        this.pitch = THREE.MathUtils.clamp(this.pitch - mouse.dy * sensitivity, -PITCH_LIMIT, PITCH_LIMIT)
    }

    move(delta)
    {
        const input = this.input
        const velocity = this.velocity

        let forward = 0
        let right = 0
        if(input.down('KeyW'))
            forward++
        if(input.down('KeyS'))
            forward--
        if(input.down('KeyD'))
            right++
        if(input.down('KeyA'))
            right--

        // Wanted direction on the ground, from the camera's yaw
        const sin = Math.sin(this.yaw)
        const cos = Math.cos(this.yaw)
        let x = sin * forward - cos * right
        let z = cos * forward + sin * right
        const length = Math.hypot(x, z)
        if(length > 0)
        {
            x /= length
            z /= length
        }

        this.aiming = input.mouse.right && !this.sliding
        this.sprinting = input.down('ShiftLeft') && forward > 0 && !this.aiming && !this.sliding && this.shotHold <= 0

        let speed = (this.aiming ? PLAYER.walk : this.sprinting ? PLAYER.sprint : PLAYER.jog) * (1 + this.upgrades.bonus('speed'))
        if(forward < 0)
            speed *= PLAYER.back

        // A slide keeps its direction and only loses speed
        if(this.onGround && !this.sliding && input.justPressed('KeyC') && this.speed > PLAYER.jog * 0.8)
        {
            this.sliding = true
            this.animation.slide()
            // Her own body, so flat: a positional sound would stay behind where the slide began
            this.experience.sounds.play('gravel', { volume: 0.3 })
            this.experience.sounds.play('slide', { volume: 0.5, rate: 0.8 })
            velocity.setY(0).setLength(Math.max(this.speed, PLAYER.crouchSlide))
        }

        if(this.sliding)
        {
            const slower = Math.max(0, this.speed - PLAYER.slideDrag * delta)
            velocity.setY(0).setLength(slower)
            if(slower < PLAYER.jog * 0.6)
                this.sliding = false
        }
        else
        {
            const blend = damp(this.onGround ? 12 : 2, delta)
            velocity.x += (x * speed - velocity.x) * blend
            velocity.z += (z * speed - velocity.z) * blend
        }

        if(this.onGround && input.justPressed('Space'))
        {
            velocity.y = PLAYER.jump
            this.onGround = false
            this.sliding = false
            this.airTime = 0
        }

        // Fall, then move and get pushed out of anything solid
        const startX = this.position.x
        const startZ = this.position.z
        velocity.y -= PLAYER.gravity * delta
        this.position.addScaledVector(velocity, delta)
        this.grid.resolveCircle(this.position, PLAYER.radius)

        this.airTime += delta
        if(this.position.y <= 0)
        {
            if(!this.onGround)
                this.animation.land()
            this.position.y = 0
            velocity.y = 0
            this.onGround = true
        }

        // What a wall took away is not velocity any more, so the legs stop when pushing into one
        velocity.x = (this.position.x - startX) / delta
        velocity.z = (this.position.z - startZ) / delta
        this.speed = Math.hypot(velocity.x, velocity.z)
    }

    face(delta)
    {
        // Sprinting and sliding turn the whole body the way it runs, the rifle comes down to carry
        const running = (this.sprinting || this.sliding) && this.speed > 1
        const target = running ? Math.atan2(this.velocity.x, this.velocity.z) : this.yaw
        this.bodyYaw += wrap(target - this.bodyYaw) * damp(this.sliding ? 6 : 14, delta)

        this.shotHold -= delta
        this.aim += ((this.aiming || this.shotHold > 0 ? 1 : 0) - this.aim) * damp(10, delta)
        this.zoom += ((this.aiming ? 1 : 0) - this.zoom) * damp(10, delta)
        this.eyeHeight += ((this.sliding ? SLIDE_EYE : PLAYER.eye) - this.eyeHeight) * damp(10, delta)
    }

    // Max health grows with Scrap plating
    get maxHp()
    {
        return PLAYER.maxHp + this.upgrades.bonus('hp')
    }

    get upgrades()
    {
        return this.experience.game.upgrades
    }

    heal(amount)
    {
        this.hp = Math.min(this.maxHp, this.hp + amount)
    }

    // H: a medkit, if she carries one, is hurt and is not putting one on already. It heals over MEDKIT.time.
    useMedkit()
    {
        if(this.patching > 0 || this.hp >= this.maxHp || !this.upgrades.useMedkit())
            return
        this.patching = MEDKIT.time
        this.experience.sounds.play('metal_clink', { volume: 0.5 })
    }

    takeDamage(amount)
    {
        if(!this.alive)
            return
        this.hp -= amount * (1 - this.upgrades.bonus('armor'))
        this.animation.hurt()
        if(this.hp <= 0)
            this.die()
    }

    // Down for a few seconds, and some of the scrap is gone. The camera pulls out to watch.
    die()
    {
        this.alive = false
        this.hp = 0
        // A medkit going on is lost with her
        this.patching = 0
        this.respawnTimer = PLAYER.respawn
        this.sliding = false
        this.velocity.set(0, 0, 0)
        this.position.y = 0
        this.onGround = true
        const game = this.experience.game
        game.steal(Math.floor(game.scrap * PLAYER.deathLoss))
        this.animation.die()
        this.setView('third')
    }

    respawn()
    {
        this.alive = true
        this.hp = this.maxHp
        this.spawn()
        this.animation.revive()
        this.setView(this.experience.camera.mode)
    }

    update()
    {
        const delta = this.time.seconds
        if(delta <= 0)
            return

        this.look()
        if(this.alive)
        {
            // On the prep map the keys pan the map and on the title nothing is hers, she stays where she is
            const mode = this.experience.camera.mode
            if(mode === 'first' || mode === 'third')
            {
                this.move(delta)
                this.face(delta)
                if(this.input.justPressed('KeyH'))
                    this.useMedkit()
            }

            if(this.patching > 0)
            {
                const part = Math.min(delta, this.patching)
                this.heal(MEDKIT.heal * part / MEDKIT.time)
                this.patching -= part
            }
        }
        else
        {
            this.respawnTimer -= delta
            if(this.respawnTimer <= 0)
                this.respawn()
        }

        this.model.position.copy(this.position)
        this.model.rotation.y = this.bodyYaw
        this.animation.update(delta)
        this.hair.update(delta)
        this.steps()
    }

    // Two steps per gait cycle, as the shared phase passes 0 and a half
    steps()
    {
        const half = Math.floor(this.animation.phase * 2)
        if(half === this.lastStep)
            return
        this.lastStep = half
        if(this.alive && this.onGround && !this.sliding && this.speed > 1)
            this.experience.sounds.play('step', { position: this.position, volume: 0.04 + this.speed * 0.008 })
    }
}
