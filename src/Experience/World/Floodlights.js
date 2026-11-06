import * as THREE from 'three'
import Experience from '../Experience.js'
import JunkBatch from './JunkBatch.js'

// Real lights cost every lit pixel on this GPU (see T09), so night gets only two: a flood on the crane
// over the north fence, and the Stash's work light over its door.
// No falloff with distance, so the far side of the yard gets light too. It ends at the light's range.
const FLOOD = 3.2
const LAMP = 9
const ON = { from: 0.35, to: 0.55 }   // the dusk at which they come on
const FLICKER = 0.7                   // seconds a cold lamp stutters before it holds
const BRIDGE_TOP = 0.95               // the bridge's walkway is this far under the crane's highest point

// Turns the lamps up as the light falls. The crane's searchlight is a prop with a lit lens in front.
export default class Floodlights
{
    constructor()
    {
        this.experience = new Experience()
        this.world = this.experience.world
        this.environment = this.world.environment
        this.group = new THREE.Group()
        this.experience.scene.add(this.group)
        this.flicker = 0
        this.wasOn = false

        this.setCrane()
    }

    setCrane()
    {
        // On top of the crane's bridge, a little toward the yard, turned to face it
        const crane = this.world.fence.crane
        const base = crane.along(-1, crane.top - BRIDGE_TOP).add(new THREE.Vector3(0, 0, 1.2))
        const aim = new THREE.Vector3(0, 0, 6)
        const yaw = Math.atan2(aim.x - base.x, aim.z - base.z)
        const batch = new JunkBatch(this.group, this.world.junkLibrary)
        const top = batch.place('portable_searchlight', { x: base.x, y: base.y, z: base.z, yaw, scale: 1.6 })
        batch.build()

        // The light and its lit lens sit in the housing's head, just in front of it
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
        const position = base.clone().setY(base.y + (top - base.y) * 0.72).addScaledVector(forward, 0.35)
        this.flood = new THREE.SpotLight('#ffe2b0', 0, 125, 0.66, 0.6, 0)
        this.flood.position.copy(position)
        this.flood.target.position.copy(aim)
        this.group.add(this.flood, this.flood.target)

        this.lensMaterial = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false, fog: false })
        this.lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), this.lensMaterial)
        this.lens.position.copy(position)
        this.lens.lookAt(aim)
        this.group.add(this.lens)
    }

    update(delta)
    {
        const on = THREE.MathUtils.smoothstep(this.environment.dusk, ON.from, ON.to)
        // A cold lamp stutters for a moment when it first comes on
        if(on > 0 && !this.wasOn)
            this.flicker = FLICKER
        this.wasOn = on > 0
        this.flicker = Math.max(0, this.flicker - delta)
        const level = on * (this.flicker > 0 && Math.random() < 0.45 ? 0.15 : 1)

        this.flood.intensity = FLOOD * level
        this.world.stash.lamp.intensity = LAMP * level
        this.lensMaterial.color.setRGB(1.6 * level, 1.4 * level, 1.05 * level)
    }
}
