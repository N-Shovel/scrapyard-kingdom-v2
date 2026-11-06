import * as THREE from 'three'
import Experience from './Experience.js'

// Over the right shoulder. Aiming pulls in close.
const SHOULDER = { side: 0.7, back: 3.5, up: 0.45, fov: 62 }
const SIGHTS = { side: 0.85, back: 1.9, up: 0.3, fov: 50 }
const SPRINT_FOV = 6     // added at full sprint
const FIRST_FOV = 72
const FIRST_AIM_FOV = 54
const PIVOT = 0.07       // third person turns around a point this far above the eyes
const CLEARANCE = 0.35   // kept between the camera and a pile
const DOWN_PITCH = -0.8  // looking down at her while she is down
// Prep map: high over the yard, tilted a little toward the north gate
const TOP = { height: 90, back: 28, fov: 50, pan: 40, zoomMin: 0.35, zoomMax: 1.25 }

const damp = (rate, delta) => 1 - Math.exp(-rate * delta)

// Modes: 'third', 'first', 'top' (the prep map), and 'free' where nothing moves the camera (playtest views).
export default class Camera
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.input = this.experience.input
        this.time = this.experience.time

        this.mode = 'third'
        this.distance = SHOULDER.back
        this.pivot = new THREE.Vector3()
        this.direction = new THREE.Vector3()
        this.forward = new THREE.Vector3()
        this.right = new THREE.Vector3()
        this.playMode = 'third'   // first or third, whichever was on before the map
        this.top = { center: new THREE.Vector3(), zoom: 0.8, look: new THREE.Vector3() }

        this.setInstance()
    }

    setInstance()
    {
        this.instance = new THREE.PerspectiveCamera(SHOULDER.fov, this.sizes.width / this.sizes.height, 0.05, 700)
        this.instance.rotation.order = 'YXZ'
        this.instance.position.set(0, 30, 50)
        this.instance.lookAt(0, 0, 0)
        this.scene.add(this.instance)
    }

    setMode(mode)
    {
        if(mode === 'top' && this.mode !== 'top')
        {
            if(this.mode === 'first' || this.mode === 'third')
                this.playMode = this.mode
            // Flies up from wherever the camera is now
            this.top.center.set(0, 0, 3)
            this.top.zoom = 0.8
            this.top.look.set(this.instance.position.x, 0, this.instance.position.z)
            this.input.unlock()
        }
        this.mode = mode
        const player = this.experience.world.player
        if(player)
            player.setView(player.alive ? mode : 'third')
    }

    resize()
    {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    // How far the camera can back away from the pivot before it enters a pile, a structure or the
    // border wall. Marches the world's cell heights instead of raycasting thousands of instances.
    clearance(from, direction, length)
    {
        const world = this.experience.world
        for(let distance = 0.1; distance < length; distance += 0.1)
        {
            const x = from.x + direction.x * distance
            const y = from.y + direction.y * distance
            const z = from.z + direction.z * distance
            if(world.heightAt(x, z) > y - CLEARANCE)
                return Math.max(0.2, distance - CLEARANCE)
        }
        return length
    }

    thirdPerson(player, delta)
    {
        const aim = player.zoom
        const lerp = THREE.MathUtils.lerp
        const side = lerp(SHOULDER.side, SIGHTS.side, aim)
        const back = lerp(SHOULDER.back, SIGHTS.back, aim)
        const up = lerp(SHOULDER.up, SIGHTS.up, aim)

        const pitch = this.pitch(player)
        const cosPitch = Math.cos(pitch)
        this.forward.set(Math.sin(player.yaw) * cosPitch, Math.sin(pitch), Math.cos(player.yaw) * cosPitch)
        this.right.set(- Math.cos(player.yaw), 0, Math.sin(player.yaw))
        this.pivot.copy(player.position)
        this.pivot.y += player.eyeHeight + PIVOT

        this.direction.copy(this.right).multiplyScalar(side).addScaledVector(this.forward, - back)
        this.direction.y += up
        const length = this.direction.length()
        this.direction.divideScalar(length)

        // Pull in at once when something is in the way, ease back out after
        const free = this.clearance(this.pivot, this.direction, length)
        this.distance = free < this.distance ? free : this.distance + (free - this.distance) * damp(5, delta)

        this.instance.position.copy(this.pivot).addScaledVector(this.direction, this.distance)
        this.instance.position.y = Math.max(this.instance.position.y, 0.3)
        this.setFov(lerp(SHOULDER.fov, SIGHTS.fov, aim) + SPRINT_FOV * player.animation.blend.carry)
    }

    firstPerson(player)
    {
        // Head bob: two steps per gait cycle, gone while aiming or in the air
        const bob = player.onGround ? Math.sin(player.animation.phase * Math.PI * 4) * 0.025 * Math.min(1, player.speed / 6) * (1 - player.zoom) : 0
        this.instance.position.copy(player.position)
        this.instance.position.y += player.eyeHeight + bob
        this.setFov(THREE.MathUtils.lerp(FIRST_FOV, FIRST_AIM_FOV, player.zoom) + SPRINT_FOV * player.animation.blend.carry)
    }

    // WASD or the arrows pan, the wheel zooms, holding the right button drags the map
    topDown(delta)
    {
        const input = this.input
        const { center, look } = this.top
        const pan = TOP.pan * this.top.zoom * delta
        if(input.down('KeyW') || input.down('ArrowUp'))
            center.z -= pan
        if(input.down('KeyS') || input.down('ArrowDown'))
            center.z += pan
        if(input.down('KeyA') || input.down('ArrowLeft'))
            center.x -= pan
        if(input.down('KeyD') || input.down('ArrowRight'))
            center.x += pan

        if(input.mouse.right)
        {
            // Meters of ground per screen pixel, so the map stays under the cursor
            const metersPerPixel = 2 * this.instance.position.distanceTo(look) * Math.tan(THREE.MathUtils.degToRad(this.instance.fov / 2)) / this.sizes.height
            center.x -= input.mouse.dx * metersPerPixel
            center.z -= input.mouse.dy * metersPerPixel
        }
        if(input.mouse.wheel)
            this.top.zoom = THREE.MathUtils.clamp(this.top.zoom * (1 + Math.sign(input.mouse.wheel) * 0.1), TOP.zoomMin, TOP.zoomMax)

        const half = this.experience.world.grid.half
        center.x = THREE.MathUtils.clamp(center.x, - half, half)
        center.z = THREE.MathUtils.clamp(center.z, - half, half)

        const blend = damp(6, delta)
        this.instance.position.lerp(this.direction.set(center.x, TOP.height * this.top.zoom, center.z + TOP.back * this.top.zoom), blend)
        look.lerp(center, blend)
        this.instance.lookAt(look)
        this.setFov(TOP.fov)
    }

    pitch(player)
    {
        return player.alive ? player.pitch : DOWN_PITCH
    }

    setFov(fov)
    {
        if(Math.abs(this.instance.fov - fov) < 0.01)
            return
        this.instance.fov = fov
        this.instance.updateProjectionMatrix()
    }

    update()
    {
        const player = this.experience.world.player
        if(this.mode === 'free' || !player)
            return
        if(this.mode === 'top')
        {
            this.topDown(this.time.seconds)
            return
        }

        if(this.input.justPressed('KeyV'))
            this.setMode(this.mode === 'first' ? 'third' : 'first')

        // Down, the camera pulls out to third person whatever the mode
        if(this.mode === 'first' && player.alive)
            this.firstPerson(player)
        else
            this.thirdPerson(player, this.time.seconds)

        // Looking along the player's aim. The camera's -Z points along the model's +Z when yaw is 0.
        this.instance.rotation.set(this.pitch(player), player.yaw + Math.PI, 0)
    }
}
