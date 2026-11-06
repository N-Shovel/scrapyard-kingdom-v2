import * as THREE from 'three'
import Experience from '../Experience.js'

// Hazard from tokens.css for the way the next round walks, red lead where the Brute smashes its own way
const ROUTE = '#e2b100'
const BRUTE = '#8c3b22'

// Arrows sprayed on the ground along each route from the next round's gates to the Stash,
// so a maze can be checked before the fight. Rebuilt only when the grid or the gates change.
export default class RouteArrows
{
    constructor()
    {
        this.experience = new Experience()
        this.grid = this.experience.world.grid

        this.group = new THREE.Group()
        this.group.visible = false
        this.experience.scene.add(this.group)
        this.version = -1
        this.gates = null

        const shape = new THREE.Shape()
        shape.moveTo(0, 0.5)
        shape.lineTo(-0.34, -0.25)
        shape.lineTo(0, -0.06)
        shape.lineTo(0.34, -0.25)
        shape.closePath()
        // Flat on the ground with the tip along +Z, the way a yaw of 0 faces
        this.arrow = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2)
        const paint = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
        this.materials = { route: paint(ROUTE, 0.85), brute: paint(BRUTE, 0.8) }
    }

    add(cells, material, y, scale)
    {
        const count = cells.length - 1
        if(count < 1)
            return
        const mesh = new THREE.InstancedMesh(this.arrow, material, count)
        const place = new THREE.Object3D()
        for(let n = 0; n < count; n++)
        {
            const a = this.grid.cellToWorld(cells[n].i, cells[n].j)
            const b = this.grid.cellToWorld(cells[n + 1].i, cells[n + 1].j)
            place.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2)
            place.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), 0)
            place.scale.setScalar(scale)
            place.updateMatrix()
            mesh.setMatrixAt(n, place.matrix)
        }
        mesh.renderOrder = 1
        this.group.add(mesh)
    }

    rebuild(gates)
    {
        this.version = this.grid.version
        this.gates = gates
        for(const mesh of this.group.children)
            mesh.dispose()
        this.group.clear()

        this.grid.updateRoutes()
        for(const gate of gates)
        {
            this.add(gate.route, this.materials.route, 0.05, 1.5)
            // The Brute's route only where it differs: it goes through a wall the others walk around
            if(gate.bruteBreach)
                this.add(gate.bruteRoute, this.materials.brute, 0.07, 1)
        }
    }

    update(visible, gates)
    {
        this.group.visible = visible
        if(visible && (this.version !== this.grid.version || this.gates !== gates))
            this.rebuild(gates)
    }
}
