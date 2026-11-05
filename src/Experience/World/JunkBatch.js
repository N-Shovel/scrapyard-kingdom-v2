import * as THREE from 'three'

const rotation = new THREE.Euler()
const quaternion = new THREE.Quaternion()
const position = new THREE.Vector3()
const scaling = new THREE.Vector3()
const toCenter = new THREE.Matrix4()
const white = new THREE.Color('#ffffff')

// Collects junk placements, then draws each model as InstancedMeshes in one go.
export default class JunkBatch
{
    // shadows: false for things too small or too far to be worth a second draw in the shadow pass.
    constructor(parent, library, { shadows = true } = {})
    {
        this.library = library
        this.shadows = shadows
        this.group = new THREE.Group()
        this.placements = new Map()
        parent.add(this.group)
    }

    // x, z: where the middle of the model goes. y: where its lowest point goes, whatever way it is
    // turned. Returns the height of its highest point.
    place(name, { x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, scale = 1, color = white })
    {
        const { center, size } = this.library.get(name)
        const [sx, sy, sz] = typeof scale === 'number' ? [scale, scale, scale] : scale

        rotation.set(pitch, yaw, roll, 'YXZ')
        quaternion.setFromEuler(rotation)
        scaling.set(sx, sy, sz)

        const placed = new THREE.Matrix4().compose(position.set(x, 0, z), quaternion, scaling)

        // How far the turned box reaches up and down from its middle
        const e = placed.elements
        const reach = (Math.abs(e[1]) * size.x + Math.abs(e[5]) * size.y + Math.abs(e[9]) * size.z) / 2
        placed.elements[13] = y + reach
        placed.multiply(toCenter.makeTranslation(-center.x, -center.y, -center.z))

        if(!this.placements.has(name))
            this.placements.set(name, [])
        this.placements.get(name).push({ matrix: placed, color })

        return y + reach * 2
    }

    build()
    {
        for(const [name, list] of this.placements)
        {
            for(const { geometry, material } of this.library.get(name).parts)
            {
                const mesh = new THREE.InstancedMesh(geometry, material, list.length)
                list.forEach((placement, index) =>
                {
                    mesh.setMatrixAt(index, placement.matrix)
                    mesh.setColorAt(index, placement.color)
                })
                mesh.castShadow = this.shadows
                mesh.receiveShadow = true
                mesh.computeBoundingSphere()
                this.group.add(mesh)
            }
        }
    }

    // The geometries and materials belong to the library, only the instance buffers go.
    clear()
    {
        for(const mesh of this.group.children)
            mesh.dispose()
        this.group.clear()
        this.placements.clear()
    }
}
