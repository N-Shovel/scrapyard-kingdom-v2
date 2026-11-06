import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import Experience from '../Experience.js'

const SHOWN = ['Arms', 'Rifle']

// Where the eye sits against the aimed rifle, in model space (+X is her left, +Z forward).
// Hip: up and left of the sights, so the rifle sits low on the right of the screen.
const HIP = new THREE.Vector3(0.11, 0.1, -0.04)
// Middle of the red dot window in the Rifle mesh's own space, measured from its vertices: between the
// hood's side walls, over the bottom bar, under the top bar. A guess 9 cm over the muzzle sat 8 mm high.
const OPTIC = new THREE.Vector3(0.2347, -0.0798, -0.0703)
const EYE_RELIEF = 0.04   // eye in front of the head bone
const SPRINT_TILT = new THREE.Euler(-0.3, 0.3, 0.25)

// First person: a second copy of the player on the camera, showing only arms and rifle.
// Always the aim clip: from the hip, the right button brings the sights to the eye, sprint tips it down.
export default class PlayerArms
{
    constructor(player)
    {
        this.player = player
        this.experience = new Experience()

        this.setModel()
        this.setAnimation()
        this.setAnchors()

        // The holder sits on the eye, so tilting it swings the rifle around the eye, not her feet
        this.holder = new THREE.Group()
        this.holder.visible = false
        this.model.rotation.y = Math.PI
        this.holder.add(this.model)
        this.experience.camera.instance.add(this.holder)
        this.anchor = new THREE.Vector3()
        this.optics = new THREE.Vector3()
        this.kick = 0   // set to 1 by a shot
    }

    setModel()
    {
        this.model = clone(this.player.model)
        this.model.position.set(0, 0, 0)
        this.model.rotation.set(0, 0, 0)

        const front = new Map()
        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return
            child.visible = SHOWN.includes(child.name) || SHOWN.includes(child.parent.name)
            child.castShadow = false
            child.frustumCulled = false
            if(child.visible)
            {
                if(!front.has(child.material))
                    front.set(child.material, this.inFront(child.material))
                child.material = front.get(child.material)
            }
        })
    }

    // Squeezes the depth into the first tenth of the range, so the rifle never sinks into a wall
    // the player stands against. Anything in the world farther than 6 cm still sorts behind it.
    inFront(material)
    {
        const copy = material.clone()
        copy.onBeforeCompile = (shader) =>
        {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                '#include <project_vertex>\n\tgl_Position.z = gl_Position.z * 0.1 - 0.9 * gl_Position.w;'
            )
        }
        copy.customProgramCacheKey = () => 'inFront'
        return copy
    }

    setAnimation()
    {
        this.mixer = new THREE.AnimationMixer(this.model)
        const clip = this.player.clips.find((candidate) => candidate.name === 'up_aim')
        this.aim = this.mixer.clipAction(clip)
        this.aim.play()
        this.aim.timeScale = 0
        this.mixer.update(0)
    }

    // The eye point for hip and sights, measured on the aim pose
    setAnchors()
    {
        this.model.updateMatrixWorld(true)
        this.rifle = this.model.getObjectByName('Rifle')
        const optic = this.rifle.localToWorld(OPTIC.clone())
        const head = this.model.getObjectByName('head').getWorldPosition(new THREE.Vector3())

        // Straight behind the optic's window, as far back as her eyes
        this.sights = new THREE.Vector3(optic.x, optic.y, head.z + EYE_RELIEF)
        this.optic = OPTIC  // for the playtest's sight check
        this.hip = this.sights.clone().add(HIP)
    }

    // Follows the world copy's breathing, the gait for bob, the sprint for the tilt, shots for the kick.
    // A reload dips the whole thing out of view and back, the reload clip itself would leave the sights.
    update(animation, delta = 0)
    {
        this.kick = Math.max(0, this.kick - delta * 7)
        if(!this.holder.visible)
            return

        this.aim.time = animation.actions.up_aim.time
        this.mixer.update(0)

        const player = this.player
        const carry = animation.blend.carry
        const dip = Math.sin(Math.PI * player.reloadProgress)
        this.holder.rotation.set(SPRINT_TILT.x * carry - 0.7 * dip + 0.12 * this.kick, SPRINT_TILT.y * carry, SPRINT_TILT.z * carry)

        // In the sights the eye follows the optic as she breathes, or the window drifts off the center.
        // From the hip the rifle breathes in view.
        this.model.updateMatrixWorld(true)
        this.model.worldToLocal(this.rifle.localToWorld(this.optics.copy(OPTIC)))
        this.optics.z = this.sights.z

        // The copy faces the camera's -Z, so the anchor ends up at the eye
        this.anchor.lerpVectors(this.hip, this.optics, player.zoom)
        const step = Math.sin(animation.phase * Math.PI * 4) * 0.012 * Math.min(1, player.speed / 6) * (1 - player.zoom)
        this.model.position.set(this.anchor.x, - this.anchor.y + step, this.anchor.z + 0.07 * this.kick)
    }
}
