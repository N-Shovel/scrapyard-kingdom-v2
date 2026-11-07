import * as THREE from 'three'

const LENGTH = 0.2        // the pony bone, from where the hair leaves the skull to the middle of the sweep
const STIFFNESS = 140     // pull of the tip back to where the pose puts it, per second squared
const DAMPING = 8         // per second. Under 24 it bounces once or twice before it settles.
const MAX_ANGLE = 0.4     // radians the sweep may swing away from the pose. At 0.6 it flaps up like a lid.
const MAX_ACCELERATION = 40 // m/s2 of the head that still swings it. A landing or a respawn is not a whip.

// The hair's sweep trails behind her head. The tip of the pony bone sits on a damped spring around the
// bone's root: the head's acceleration throws it, and it chases where the pose puts it. Running at a steady
// speed leaves it alone, starts, stops, turns and the bob of each step swing it. The bone has no keys of
// its own, so this runs after the mixer and starts from the rest pose every frame.
export default class PlayerHair
{
    constructor(model)
    {
        this.bone = model.getObjectByName('pony')
        this.rest = this.bone.quaternion.clone()
        this.pivot = new THREE.Vector3()
        this.posed = new THREE.Vector3()    // tip minus pivot, where the animation puts it
        this.offset = new THREE.Vector3()   // tip minus pivot, where the spring has it
        this.speed = new THREE.Vector3()    // of the offset
        this.before = new THREE.Vector3()
        this.lastPivot = new THREE.Vector3()
        this.pivotSpeed = new THREE.Vector3()
        this.lastPivotSpeed = new THREE.Vector3()
        this.force = new THREE.Vector3()
        this.from = new THREE.Vector3()
        this.to = new THREE.Vector3()
        this.turn = new THREE.Quaternion()
        this.parent = new THREE.Quaternion()
        this.inverse = new THREE.Quaternion()
        this.started = false
    }

    update(delta)
    {
        const bone = this.bone
        bone.quaternion.copy(this.rest)
        bone.updateWorldMatrix(true, false)
        bone.getWorldPosition(this.pivot)
        bone.localToWorld(this.posed.set(0, LENGTH, 0)).sub(this.pivot)

        if(!this.started || delta <= 0)
        {
            this.offset.copy(this.posed)
            this.speed.set(0, 0, 0)
            this.lastPivot.copy(this.pivot)
            this.lastPivotSpeed.set(0, 0, 0)
            this.started = true
            return
        }

        const step = Math.min(delta, 0.05)
        this.pivotSpeed.subVectors(this.pivot, this.lastPivot).divideScalar(delta)
        this.lastPivot.copy(this.pivot)
        // The head's acceleration, felt by the hair the other way round
        this.force.subVectors(this.lastPivotSpeed, this.pivotSpeed).divideScalar(delta).clampLength(0, MAX_ACCELERATION)
        this.lastPivotSpeed.copy(this.pivotSpeed)

        this.force.addScaledVector(this.to.subVectors(this.posed, this.offset), STIFFNESS)
        this.force.addScaledVector(this.speed, - DAMPING)
        this.speed.addScaledVector(this.force, step)
        this.before.copy(this.offset)
        this.offset.addScaledVector(this.speed, step)

        // The hair does not stretch, and it only swings so far
        const length = this.posed.length()
        this.offset.setLength(length)
        this.from.copy(this.posed).normalize()
        this.to.copy(this.offset).normalize()
        const angle = this.from.angleTo(this.to)
        if(angle > MAX_ANGLE)
        {
            this.to.lerp(this.from, 1 - MAX_ANGLE / angle).normalize()
            this.offset.copy(this.to).multiplyScalar(length)
        }
        // What the length and the limit took away is gone from its speed too
        this.speed.subVectors(this.offset, this.before).divideScalar(step)
        if(angle < 1e-4)
            return

        // The turn from the posed direction to the spring's, in world space, then in the head's frame
        this.turn.setFromUnitVectors(this.from, this.to)
        bone.parent.getWorldQuaternion(this.parent)
        this.turn.premultiply(this.inverse.copy(this.parent).invert()).multiply(this.parent)
        bone.quaternion.premultiply(this.turn)
    }
}
