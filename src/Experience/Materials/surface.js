import * as THREE from 'three'
import Experience from '../Experience.js'

// A material from one Poly Haven texture set: surface('gravelly_sand'), surface('rusty_metal_02', { repeat: [2, 1] }).
// The arm map holds occlusion, roughness and metalness in its red, green and blue channels.
export default function surface(id, { repeat = [1, 1], ...options } = {})
{
    const { resources, renderer } = new Experience()

    const load = (map) =>
    {
        const texture = resources.items[`${id}_${map}`].clone()
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(repeat[0], repeat[1])
        texture.anisotropy = Math.min(8, renderer.instance.capabilities.getMaxAnisotropy())
        return texture
    }

    const arm = load('arm')

    return new THREE.MeshStandardMaterial({
        map: load('color'),
        normalMap: load('normal'),
        aoMap: arm,
        roughnessMap: arm,
        metalnessMap: arm,
        roughness: 1,
        metalness: 1,
        ...options
    })
}
