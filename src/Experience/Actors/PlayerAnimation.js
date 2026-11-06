import * as THREE from 'three'
import config from '../Game/config.js'

const PLAYER = config.PLAYER

// Meters covered by one full cycle of each gait clip, from tools/blender/clips.py
const STRIDE = { walk_f: 1.45, walk_b: 1.15, walk_l: 1.0, walk_r: 1.0, run_f: 2.9, run_b: 2.2, run_l: 2.1, run_r: 2.1, sprint: 3.9 }

// Forward, back, left and right clip of each gait. Sprint borrows the jog's for the little sideways part of a turn.
const GAITS =
{
    walk: ['walk_f', 'walk_b', 'walk_l', 'walk_r'],
    run: ['run_f', 'run_b', 'run_l', 'run_r'],
    sprint: ['sprint', 'run_b', 'run_l', 'run_r']
}

const LOWER = ['idle', 'jump', 'fall', 'land', 'slide', ...Object.keys(STRIDE)]
const UPPER = ['up_ready', 'up_aim', 'up_carry', 'up_reload']

// Clips posed from a time set here each frame instead of the mixer's clock
const POSED = [...Object.keys(STRIDE), 'up_carry', 'up_reload', 'jump', 'land', 'slide', 'death']

const SIDEWAYS = new THREE.Vector3(1, 0, 0)
const damp = (rate, delta) => 1 - Math.exp(-rate * delta)
const smoothstep = THREE.MathUtils.smoothstep

// Two layers on one mixer: lower clips drive legs and hips, upper clips chest and arms.
// Weights inside a layer always add up to 1, otherwise the mixer blends in the rest pose.
export default class PlayerAnimation
{
    constructor(player)
    {
        this.player = player
        this.model = player.model

        this.phase = 0          // shared by every gait clip, so feet never fight in a blend
        this.landTime = 9
        this.slideTime = 9
        this.deathTime = 0
        this.landStrength = 0
        this.blend = { air: 0, jump: 0, slide: 0, carry: 0, dead: 0, reload: 0 }
        this.weights = {}
        this.directions = { walk: [1, 0, 0, 0], run: [1, 0, 0, 0], sprint: [1, 0, 0, 0] }

        this.setActions()
        this.setLook()
    }

    setActions()
    {
        this.mixer = new THREE.AnimationMixer(this.model)
        this.actions = {}
        // death keys both layers, so it replaces everything else while it plays
        for(const name of [...LOWER, ...UPPER, 'death'])
        {
            const clip = this.player.clips.find((candidate) => candidate.name === name)
            const action = this.mixer.clipAction(clip)
            action.play()
            action.setEffectiveWeight(0)
            if(POSED.includes(name))
                action.timeScale = 0
            this.actions[name] = action
            this.weights[name] = 0
        }

        // A flinch and a kick added on top of whatever the upper body does. Kept out of actions, their weight never changes.
        const additive = (name) =>
        {
            const clip = this.player.clips.find((candidate) => candidate.name === name)
            const action = this.mixer.clipAction(THREE.AnimationUtils.makeClipAdditive(clip.clone()))
            action.setLoop(THREE.LoopOnce)
            return action
        }
        this.hurtAction = additive('hurt')
        this.fireAction = additive('up_fire')
    }

    hurt()
    {
        this.hurtAction.reset().play()
    }

    fire()
    {
        this.fireAction.reset().play()
    }

    die()
    {
        this.deathTime = 0
    }

    // Respawning puts her somewhere else, so there is nothing to blend back from
    revive()
    {
        this.blend.dead = 0
    }

    // Look pitch bends spine and chest after the mixer. The mixer only writes a bone when its
    // animated value changes, so the bend is undone before each update or it would pile up.
    setLook()
    {
        this.bent = ['spine', 'chest'].map((name) => ({
            bone: this.model.getObjectByName(name),
            animated: new THREE.Quaternion(),
            share: name === 'spine' ? 0.35 : 0.65
        }))
        for(const entry of this.bent)
            entry.animated.copy(entry.bone.quaternion)

        this.modelRotation = new THREE.Quaternion()
        this.parentRotation = new THREE.Quaternion()
        this.turn = new THREE.Quaternion()
    }

    // Called on touchdown. A hard landing at a standstill plays in full, at a run only a dip.
    land()
    {
        this.landTime = 0
        this.landStrength = 1 - smoothstep(this.player.speed, 1, 5) * 0.7
    }

    // Called when a slide starts. The clip drops into the slide once and holds its last pose:
    // looping it would jump back to the higher entry frame halfway through.
    slide()
    {
        this.slideTime = 0
    }

    // Direction weights so that the blended feet move back exactly as fast as the body moves forward.
    // Returns gait cycles per second for this gait alone.
    setDirections(gait, forward, right)
    {
        const [f, b, l, r] = GAITS[gait]
        const rates = [
            Math.max(0, forward) / STRIDE[f],
            Math.max(0, -forward) / STRIDE[b],
            Math.max(0, -right) / STRIDE[l],
            Math.max(0, right) / STRIDE[r]
        ]
        const cycles = rates[0] + rates[1] + rates[2] + rates[3]
        if(cycles > 1e-3)
            this.directions[gait] = rates.map((rate) => rate / cycles)
        return cycles
    }

    // Gait mix from speed: walk up to aiming speed, jog at jog speed, sprint above
    gaitWeights(speed)
    {
        if(speed <= PLAYER.walk)
            return { walk: 1, run: 0, sprint: 0 }
        if(speed <= PLAYER.jog)
        {
            const t = (speed - PLAYER.walk) / (PLAYER.jog - PLAYER.walk)
            return { walk: 1 - t, run: t, sprint: 0 }
        }
        const t = Math.min(1, (speed - PLAYER.jog) / (PLAYER.sprint - PLAYER.jog))
        return { walk: 0, run: 1 - t, sprint: t }
    }

    updateLower(delta)
    {
        const player = this.player
        const blend = this.blend
        const weights = this.weights

        // Velocity in the model's own frame
        const sin = Math.sin(player.bodyYaw)
        const cos = Math.cos(player.bodyYaw)
        const forward = player.velocity.x * sin + player.velocity.z * cos
        const right = - player.velocity.x * cos + player.velocity.z * sin

        blend.air += ((player.onGround ? 0 : 1) - blend.air) * damp(14, delta)
        blend.slide += ((player.sliding ? 1 : 0) - blend.slide) * damp(12, delta)
        const rising = player.airTime < this.actions.jump.getClip().duration && player.velocity.y > 0
        blend.jump += ((rising ? 1 : 0) - blend.jump) * damp(10, delta)

        // One phase for all gaits. Rates add up as harmonic means, see setDirections.
        const gaits = this.gaitWeights(player.speed)
        let inverse = 0
        for(const gait in gaits)
        {
            const cycles = this.setDirections(gait, forward, right)
            if(gaits[gait] > 0 && cycles > 1e-3)
                inverse += gaits[gait] / cycles
        }
        // Idle mixed in shortens the stride, so step faster to make up for it
        const move = smoothstep(player.speed, 0.1, 1.4)
        const cycles = inverse > 0 ? 1 / inverse / Math.max(move, 0.25) : 0
        if(player.onGround)
            this.phase = (this.phase + cycles * delta) % 1

        this.landTime += delta
        this.slideTime += delta
        const landClip = this.actions.land.getClip().duration
        const land = this.landStrength * (1 - smoothstep(this.landTime, landClip * 0.4, landClip))

        for(const name of LOWER)
            weights[name] = 0

        const air = blend.air
        const ground = (1 - air) * (1 - blend.slide)
        const moving = ground * (1 - land)
        weights.jump = air * blend.jump
        weights.fall = air * (1 - blend.jump)
        weights.slide = (1 - air) * blend.slide
        weights.land = ground * land
        weights.idle = moving * (1 - move)
        for(const gait in gaits)
            GAITS[gait].forEach((name, index) =>
            {
                weights[name] += moving * move * gaits[gait] * this.directions[gait][index]
            })

        for(const name in STRIDE)
            this.actions[name].time = this.phase * this.actions[name].getClip().duration
        this.actions.jump.time = Math.min(player.airTime, this.actions.jump.getClip().duration)
        this.actions.land.time = Math.min(this.landTime, landClip)
        this.actions.slide.time = Math.min(this.slideTime, this.actions.slide.getClip().duration)
    }

    updateUpper(delta)
    {
        const player = this.player
        const blend = this.blend
        const weights = this.weights

        blend.carry += ((player.sprinting && player.onGround ? 1 : 0) - blend.carry) * damp(8, delta)
        blend.reload += ((player.reloadProgress > 0 ? 1 : 0) - blend.reload) * damp(12, delta)

        // Each pose takes its share of what the ones before it left: carry, reload, then aim or ready
        let left = 1
        weights.up_carry = left * blend.carry
        left -= weights.up_carry
        weights.up_reload = left * blend.reload
        left -= weights.up_reload
        weights.up_aim = left * player.aim
        weights.up_ready = left * (1 - player.aim)

        this.actions.up_reload.time = player.reloadProgress * this.actions.up_reload.getClip().duration

        // The carry swing is one stride long, so it rides on the gait phase
        this.actions.up_carry.time = this.phase * this.actions.up_carry.getClip().duration
    }

    // Turns a bone about an axis given in the model's own space, whatever its parents did
    turnBone(bone, axis, angle)
    {
        this.model.getWorldQuaternion(this.modelRotation).invert()
        bone.parent.getWorldQuaternion(this.parentRotation).premultiply(this.modelRotation)
        this.turn.setFromAxisAngle(axis, angle)
        // parent^-1 * turn * parent, applied on top of the bone's own rotation
        this.turn.premultiply(this.parentRotation.clone().invert()).multiply(this.parentRotation)
        bone.quaternion.premultiply(this.turn)
    }

    update(delta)
    {
        this.updateLower(delta)
        this.updateUpper(delta)

        const blend = this.blend
        blend.dead += ((this.player.alive ? 0 : 1) - blend.dead) * damp(8, delta)
        this.deathTime += delta
        this.actions.death.time = Math.min(this.deathTime, this.actions.death.getClip().duration)
        for(const name in this.weights)
            this.weights[name] *= 1 - blend.dead
        this.weights.death = blend.dead

        for(const name in this.actions)
            this.actions[name].setEffectiveWeight(this.weights[name])

        for(const entry of this.bent)
            entry.bone.quaternion.copy(entry.animated)
        this.mixer.update(delta)
        for(const entry of this.bent)
            entry.animated.copy(entry.bone.quaternion)

        // Positive pitch looks up. Turning about +X by a negative angle lifts the model's +Z forward.
        const pitch = THREE.MathUtils.clamp(this.player.pitch, -1.1, 1.1) * (1 - blend.carry * 0.7) * (1 - blend.slide * 0.5) * (1 - blend.dead)
        for(const entry of this.bent)
            this.turnBone(entry.bone, SIDEWAYS, - pitch * entry.share)

        this.player.arms.update(this, delta)
    }
}
