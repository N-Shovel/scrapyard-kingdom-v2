import * as THREE from 'three'
import Experience from '../Experience.js'
import applyRust from '../Materials/applyRust.js'

// Rust painted over the Quaternius models. plain drops the palette so instance colors can repaint them.
// The Sketchfab downloads come textured and worn already and get none.
const LOOKS =
{
    barrier_trash: { amount: 0.5, scale: 0.8 },
    gas_can: { amount: 0.4, scale: 1.6 },
    dumpster: { amount: 0.6, scale: 1.2 },
    trash_container: { amount: 0.6, scale: 1 }
}

// What each junk model is made of: geometry and material pairs, plus where its feet are.
export default class JunkLibrary
{
    constructor()
    {
        this.experience = new Experience()
        this.resources = this.experience.resources
        this.models = new Map()
    }

    describe(parts)
    {
        const box = new THREE.Box3()
        for(const { geometry } of parts)
        {
            if(!geometry.boundingBox)
                geometry.computeBoundingBox()
            box.union(geometry.boundingBox)
        }
        return { parts, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) }
    }

    // The uniform scale that makes a model's longer side across the ground this many meters. The downloads
    // come in any unit: centimetres, inches, a tenth of a metre.
    scaleFor(name, length)
    {
        const { size } = this.get(name)
        return length / Math.max(size.x, size.z)
    }

    get(name)
    {
        if(!this.models.has(name))
            this.models.set(name, this.describe(this.partsOf(name)))
        return this.models.get(name)
    }

    partsOf(name)
    {
        const look = LOOKS[name]
        const parts = []

        this.resources.items[name].scene.traverse((child) =>
        {
            if(!child.isMesh)
                return

            let material = child.material
            if(look)
            {
                material = material.clone()
                if(look.plain)
                {
                    material.map = null
                    material.color.set('#ffffff')
                }
                applyRust(material, look)
            }
            parts.push({ geometry: child.geometry, material })
        })

        return parts
    }
}
