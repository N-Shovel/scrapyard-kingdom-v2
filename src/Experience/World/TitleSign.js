import * as THREE from 'three'
import Experience from '../Experience.js'
import applyRust from '../Materials/applyRust.js'

// Where it hangs: meters along the gantry's beam from its middle, and where to start before hang() measures
const ALONG = 0
const UNDER = 2.5
const CLEAR = 0.4    // meters between the hook's lowest point and the board's top edge
const LOOKS =
{
    Letters: { color: '#c4b48c', roughness: 0.75, metalness: 0.35, rust: 0.55 },
    Tools: { color: '#8a8f90', roughness: 0.5, metalness: 0.7, rust: 0.4 },
    Grip: { color: '#8a2f22', roughness: 0.85, metalness: 0, rust: 0.15 },
    Chains: { color: '#2b2925', roughness: 0.6, metalness: 0.8, rust: 0.6 }
}
// The board keeps its scanned colour map, a little darker
const BOARD_TINT = '#d6cfc4'

// The name of the yard in its own plate letters, a wrench for the Y, a hammer for the I and a nut for the O, bolted
// to a rusty steel board (matousekfoto's scan). Letters and board are shot through and bitten. It hangs from the
// gantry on two chains and swings a little. tools/blender/build_sign.py builds all of it.
export default class TitleSign
{
    constructor()
    {
        this.experience = new Experience()
        this.world = this.experience.world
        this.time = this.experience.time

        const crane = this.world.fence.crane
        this.group = new THREE.Group()
        this.group.position.copy(crane.along(ALONG, crane.top - UNDER))
        this.group.rotation.y = crane.yaw
        this.experience.scene.add(this.group)

        this.model = this.experience.resources.items.title_sign.scene
        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return
            const look = LOOKS[child.name]
            if(look)
            {
                child.material = new THREE.MeshStandardMaterial({ color: look.color, roughness: look.roughness, metalness: look.metalness })
                applyRust(child.material, { amount: look.rust, scale: 0.9 })
            }
            else
                child.material.color.set(BOARD_TINT)
            child.castShadow = true
            child.receiveShadow = true
        })
        this.group.add(this.model)
        this.group.updateMatrixWorld(true)
        this.hang(crane)
        this.center = new THREE.Box3().setFromObject(this.model.getObjectByName('Letters')).getCenter(new THREE.Vector3())
    }

    // The first thing on the gantry straight above a point, or null
    above(x, y, z)
    {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0))
        return ray.intersectObject(this.world.fence.group, true)[0]?.point.y ?? null
    }

    // The board hangs just below the hoist's hook, so the hook shows above it and not across the letters.
    // The chains came at a length for the old crane: they are stretched until they reach the gantry above them.
    hang(crane)
    {
        // The hook is the lowest thing hanging from the gantry near its middle. Rays start above the stacks.
        let hook = Infinity
        for(let dx = -0.8; dx <= 0.8; dx += 0.1)
            for(let dz = -0.6; dz <= 0.6; dz += 0.1)
            {
                const y = this.above(crane.x + dx, 5, crane.z + dz)
                if(y !== null)
                    hook = Math.min(hook, y)
            }
        const board = new THREE.Box3().setFromObject(this.model.getObjectByName('Board'))
        if(Number.isFinite(hook))
            this.group.position.y += hook - CLEAR - board.max.y
        this.group.updateMatrixWorld(true)

        const chains = this.model.getObjectByName('Chains')
        const before = new THREE.Box3().setFromObject(chains)
        const tops = [before.min.x + 0.05, before.max.x - 0.05].map((x) => this.above(x, before.min.y + 0.05, (before.min.z + before.max.z) / 2)).filter((y) => y !== null)
        if(!tops.length)
            return
        chains.scale.y *= (Math.min(...tops) - before.min.y) / (before.max.y - before.min.y)
        chains.updateMatrixWorld(true)
        // Keep their feet on the board: the mesh stretched about its own origin, not its feet
        chains.position.y += before.min.y - new THREE.Box3().setFromObject(chains).min.y
        chains.updateMatrixWorld(true)
    }

    // The middle of the letters, for the title camera
    get middle()
    {
        return this.center
    }

    update()
    {
        const seconds = this.time.elapsed * 0.001
        this.model.rotation.x = Math.sin(seconds * 0.7) * 0.018
        this.model.rotation.z = Math.sin(seconds * 0.43 + 1) * 0.012
    }
}
