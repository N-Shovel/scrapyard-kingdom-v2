import * as THREE from 'three'
import Experience from '../Experience.js'
import surface from '../Materials/surface.js'
import seededRandom from '../Game/seededRandom.js'
import { JUNK } from '../Game/Grid.js'
import JunkBatch from './JunkBatch.js'
import { WRECKS } from './Junkyard.js'

const POLE_HEIGHT = 5.2
const POLE_EVERY = 13   // meters between the power poles that run past the yard outside the wall
// The gantry over the lane out of the North gate, the sign hangs from its beam. span: meters between its legs.
const GANTRY = { behind: 12, span: 19 }

// What closes the yard and never changes between rounds: stacked containers along the border,
// gate posts, and scrap mountains out in the haze so the yard has no visible edge.
export default class Fence
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.world = this.experience.world
        this.grid = this.world.grid
        this.random = seededRandom(404)

        this.group = new THREE.Group()
        this.scene.add(this.group)
        this.batch = new JunkBatch(this.group, this.world.junkLibrary)
        this.outside = new JunkBatch(this.group, this.world.junkLibrary, { shadows: false })

        this.setWall()
        this.setGates()
        this.setOutside()
        this.setPoles()
        this.setMountains()
        this.setCrane()
        this.setBackdrop()
        this.batch.build()
        this.outside.build()
    }

    // The downloads are painted and rusted already: only a little lighter or darker each
    color()
    {
        return new THREE.Color('#ffffff').multiplyScalar(0.8 + this.random() * 0.35)
    }

    // A container that lies `length` meters along x, `height` tall and `width` across
    container(length, height = 2.5, width = 2.2)
    {
        const { size } = this.world.junkLibrary.get('container_rusted')
        return [length / size.x, height / size.y, width / size.z]
    }

    wreckScale(wreck)
    {
        return this.world.junkLibrary.scaleFor(wreck.name, wreck.length)
    }

    spread(amount)
    {
        return (this.random() - 0.5) * amount
    }

    // Walks each side of the border. A run of two free cells takes a container, a single one a skip or a dumpster.
    setWall()
    {
        const size = this.grid.size
        const sides = [
            (n) => [n, 0],
            (n) => [n, size - 1],
            (n) => [0, n],
            (n) => [size - 1, n]
        ]

        sides.forEach((cellAt, side) =>
        {
            const along = side < 2 ? 0 : Math.PI / 2
            for(let n = 0; n < size;)
            {
                const [i, j] = cellAt(n)
                const [nextI, nextJ] = cellAt(n + 1)
                if(this.grid.terrain[this.grid.index(i, j)] !== JUNK)
                {
                    n++
                    continue
                }

                if(n + 1 < size && this.grid.terrain[this.grid.index(nextI, nextJ)] === JUNK)
                {
                    const a = this.grid.cellToWorld(i, j)
                    const b = this.grid.cellToWorld(nextI, nextJ)
                    this.wallSection((a.x + b.x) / 2, (a.z + b.z) / 2, along)
                    n += 2
                }
                else
                {
                    const { x, z } = this.grid.cellToWorld(i, j)
                    const skip = this.random() < 0.5
                    this.batch.place(skip ? 'trash_container' : 'dumpster', {
                        x, z, yaw: along + this.spread(0.2), scale: skip ? 0.66 : 0.9, color: this.color()
                    })
                    n++
                }
            }
        })
    }

    wallSection(x, z, along)
    {
        const length = this.grid.cell * 2
        let top = this.batch.place('container_rusted', {
            x: x + this.spread(0.25),
            z: z + this.spread(0.25),
            yaw: along + this.spread(0.09) + (this.random() < 0.5 ? Math.PI : 0),
            scale: this.container(length),
            color: this.color()
        })

        // Second row: another container, or a car dropped on top. Sometimes nothing, so the skyline is broken.
        const roll = this.random()
        if(roll < 0.5)
        {
            top = this.batch.place('container_rusted', {
                x: x + this.spread(0.7),
                y: top - 0.02,
                z: z + this.spread(0.35),
                yaw: along + this.spread(0.24) + (this.random() < 0.5 ? Math.PI : 0),
                scale: this.container(length * 0.96, 2.4, 2.1),
                color: this.color()
            })
            if(this.random() < 0.18)
                this.topWreck(x, z, top, along)
        }
        else if(roll < 0.8)
        {
            this.topWreck(x, z, top, along)
        }
    }

    topWreck(x, z, top, along)
    {
        const wreck = WRECKS[Math.floor(this.random() * WRECKS.length)]
        this.batch.place(wreck.name, {
            x: x + this.spread(0.8),
            y: top - 0.06,
            z: z + this.spread(0.3),
            yaw: along + Math.PI / 2 + this.spread(0.5),
            pitch: this.spread(0.1),
            roll: this.spread(0.1),
            scale: this.wreckScale(wreck),
            color: this.color()
        })
    }

    // Two concrete barriers and a lit post at each side of every gate.
    setGates()
    {
        const warning = new THREE.MeshStandardMaterial({ color: '#2a0d08', emissive: '#ff2a12', emissiveIntensity: 2.5 })
        const lamp = new THREE.SphereGeometry(0.11, 10, 8)
        const pipe = surface('rusty_painted_metal', { repeat: [0.25, 1.4] })
        const pole = new THREE.CylinderGeometry(0.055, 0.075, POLE_HEIGHT, 8)
        pole.translate(0, POLE_HEIGHT / 2, 0)
        this.gateLamps = []
        this.lamps = new Map()

        for(const gate of this.grid.gates)
        {
            // Each gate gets its own copy, so one can warn while the others stay dark
            const glow = warning.clone()
            this.lamps.set(gate, glow)
            const first = this.grid.cellToWorld(gate.cells[0].i, gate.cells[0].j)
            const last = this.grid.cellToWorld(gate.cells[2].i, gate.cells[2].j)
            const across = Math.atan2(last.x - first.x, last.z - first.z)
            const dirX = Math.sign(last.x - first.x)
            const dirZ = Math.sign(last.z - first.z)
            const gap = this.grid.cell * 0.62

            for(const [end, sign] of [[first, -1], [last, 1]])
            {
                const x = end.x + dirX * gap * sign
                const z = end.z + dirZ * gap * sign

                this.batch.place('concrete_road_barrier', {
                    x: x + dirZ * 0.9,
                    z: z + dirX * 0.9,
                    yaw: across + this.spread(0.5),
                    color: this.color()
                })
                this.batch.place('concrete_road_barrier', {
                    x: x - dirZ * 0.9,
                    z: z - dirX * 0.9,
                    yaw: across + this.spread(0.5),
                    color: this.color()
                })

                const post = new THREE.Mesh(pole, pipe)
                post.position.set(x, 0, z)
                post.rotation.z = this.spread(0.05)
                post.castShadow = true
                this.group.add(post)

                this.batch.place('security_light', { x, y: POLE_HEIGHT - 0.1, z, yaw: across + this.spread(1), scale: 0.9 })

                const light = new THREE.Mesh(lamp, glow)
                light.position.set(x, POLE_HEIGHT + 0.45, z)
                this.group.add(light)
                this.gateLamps.push(light)
            }
        }
    }

    // The gates the next round comes from blink while you prepare and burn steady in the fight.
    // The rest go almost dark. elapsed is in ms.
    warn(gates, blink, elapsed)
    {
        const on = Math.sin(elapsed * 0.0063) > 0
        for(const [gate, glow] of this.lamps)
            glow.emissiveIntensity = !gates.includes(gate) ? 0.12 : blink && !on ? 0.3 : 3
    }

    // Loose heaps just past the wall, to give the mountains a foreground.
    setOutside()
    {
        const half = this.grid.half
        for(let n = 0; n < 80; n++)
        {
            const reach = half + 3 + this.random() * this.random() * 46
            const angle = this.random() * Math.PI * 2
            const x = Math.max(-reach, Math.min(reach, Math.cos(angle) * reach * 1.42))
            const z = Math.max(-reach, Math.min(reach, Math.sin(angle) * reach * 1.42))

            const roll = this.random()
            const wreck = WRECKS[Math.floor(this.random() * WRECKS.length)]
            if(roll < 0.45)
                this.carStack(x, z, this.spread(6), this.random() < 0.25 ? 2 : 1)
            else if(roll < 0.65)
                this.tyres(x, z)
            else if(roll < 0.9)
                this.outside.place(wreck.name, { x, z, yaw: this.spread(6), scale: this.wreckScale(wreck), color: this.color() })
            else
                this.outside.place('container_rusted', { x, z, yaw: this.spread(6), scale: this.container(4.4), color: this.color() })
        }
    }

    // Whole cars stacked square, the upper floor on the lower roof
    carStack(x, z, yaw, count)
    {
        let top = 0
        for(let n = 0; n < count; n++)
        {
            const wreck = WRECKS[Math.floor(this.random() * WRECKS.length)]
            top = this.outside.place(wreck.name, {
                x: x + this.spread(0.2), y: Math.max(0, top - 0.3), z: z + this.spread(0.2), yaw: yaw + this.spread(0.12) + (this.random() < 0.5 ? Math.PI : 0),
                scale: this.wreckScale(wreck), color: this.color()
            })
        }
        return top
    }

    // A scanned heap of old tyres, 4 to 7 m across
    tyres(x, z)
    {
        const across = 4 + this.random() * 3
        this.outside.place('tyre_heap', { x, z, yaw: this.random() * Math.PI * 2, scale: this.world.junkLibrary.scaleFor('tyre_heap', across), color: this.color() })
    }

    // The title looks north through the gate at the sign under the gantry. Behind it this fills the ground out
    // to the hills with what a yard keeps outside: rows of stacked cars, container stacks and tyre heaps, a
    // rail crane, a tower crane and a water tower on the skyline.
    setBackdrop()
    {
        const crane = this.crane
        const legs = [-1, 1].map((side) => crane.along(side * GANTRY.span / 2))
        const clear = (x, z) => legs.every((leg) => Math.hypot(leg.x - x, leg.z - z) > 3.5)
        // A lane straight out of the North gate, so the near rows frame the sign instead of hiding it
        const gate = this.grid.gates.find((candidate) => candidate.name === 'North').center
        for(let row = 0; row < 5; row++)
        {
            const z = - this.grid.half - 6 - row * 5.5 + this.spread(1.5)
            const lane = row < 3 ? 8 - row * 1.5 : 0
            for(let x = gate.x - 34; x < gate.x + 34; x += 5 + this.random() * 2)
            {
                if(!clear(x, z) || Math.abs(x - gate.x) < lane)
                    continue
                const roll = this.random()
                if(roll < 0.5)
                    // Mostly side on to the title camera: a car end on reads as a box
                    this.carStack(x, z, Math.PI / 2 + this.spread(0.5), this.random() < 0.5 ? 2 : 1)
                else if(roll < 0.72 && row > 1)
                {
                    // Side on to the title camera, so it reads as a container and not a pillar
                    const top = this.outside.place('container_rusted', { x, z, yaw: this.spread(0.1), scale: this.container(4.4), color: this.color() })
                    if(this.random() < 0.5)
                        this.outside.place('container_rusted', { x: x + this.spread(0.3), y: top - 0.02, z: z + this.spread(0.3), yaw: this.spread(0.1), scale: this.container(4.4), color: this.color() })
                }
                else
                    this.tyres(x, z)
            }
        }

        // On the skyline, far enough back to stand above the stacks
        const far = - this.grid.half - 40
        const library = this.world.junkLibrary
        this.outside.place('gantry_crane', { x: gate.x + 30, z: far + 6, yaw: 0.2, scale: library.scaleFor('gantry_crane', 26), color: this.color() })
        this.outside.place('tower_crane', { x: gate.x - 38, z: far - 8, yaw: 2.4, scale: library.scaleFor('tower_crane', 40), color: this.color() })
        this.outside.place('water_tower', { x: gate.x - 14, z: far - 4, yaw: 0.6, scale: library.scaleFor('water_tower', 5), color: this.color() })
    }

    // A power line along the south and west sides, a few meters out from the containers, over the top of them.
    // Not north: the title looks that way at the sign on the crane.
    setPoles()
    {
        const out = this.grid.half + 4
        for(let along = - out; along <= out; along += POLE_EVERY)
        {
            this.outside.place('modular_electricity_poles', { x: along + this.spread(1), z: out, yaw: this.spread(0.08), color: this.color() })
            this.outside.place('modular_electricity_poles', { x: - out, z: along + this.spread(1), yaw: Math.PI / 2 + this.spread(0.08), color: this.color() })
        }
    }

    // Big lumps of nothing but texture. They only ever show as a jagged skyline.
    setMountains()
    {
        const geometry = new THREE.IcosahedronGeometry(1, 9)
        const position = geometry.attributes.position
        const seen = new Map()
        for(let v = 0; v < position.count; v++)
        {
            const key = `${position.getX(v).toFixed(3)},${position.getY(v).toFixed(3)},${position.getZ(v).toFixed(3)}`
            if(!seen.has(key))
            {
                // Slow swells under fine jags, like a heap seen from far off
                const swell = Math.sin(position.getX(v) * 4.1 + position.getZ(v) * 2.3) * 0.12 + Math.sin(position.getZ(v) * 6.7 - position.getX(v) * 3.1) * 0.08
                seen.set(key, 0.9 + swell + this.random() * 0.1)
            }
            const push = seen.get(key)
            position.setXYZ(v, position.getX(v) * push, position.getY(v) * push, position.getZ(v) * push)
        }
        geometry.computeVertexNormals()

        const material = surface('rusty_metal_sheet', { color: '#3a3029', flatShading: true })

        const count = 30
        const mesh = new THREE.InstancedMesh(geometry, material, count)
        const placed = new THREE.Object3D()
        for(let n = 0; n < count; n++)
        {
            const angle = (n / count) * Math.PI * 2 + this.spread(0.2)
            const reach = 150 + this.random() * 70
            placed.position.set(Math.cos(angle) * reach, -4, Math.sin(angle) * reach)
            placed.rotation.y = this.random() * Math.PI
            placed.scale.set(26 + this.random() * 30, 16 + this.random() * 22, 26 + this.random() * 30)
            placed.updateMatrix()
            mesh.setMatrixAt(n, placed.matrix)
        }
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.computeBoundingSphere()
        this.group.add(mesh)
    }

    // crane: { x, z, yaw, top, along(meters, y) } for whatever hangs from it, see TitleSign and Floodlights.
    // speedtwo's gantry stands over the lane out of the North gate, its beam across the lane.
    setCrane()
    {
        const gate = this.grid.gates.find((candidate) => candidate.name === 'North').center
        const x = gate.x
        const z = - this.grid.half - GANTRY.behind
        const yaw = 0
        const scale = this.world.junkLibrary.scaleFor('gantry_portica', GANTRY.span)
        const top = this.batch.place('gantry_portica', { x, z, yaw, scale, color: new THREE.Color('#b9b2a4') })
        // A point along the beam, meters from its middle
        const along = (meters, y = 0) => new THREE.Vector3(x + Math.cos(yaw) * meters, y, z - Math.sin(yaw) * meters)
        this.crane = { x, z, yaw, top, along }
    }
}
