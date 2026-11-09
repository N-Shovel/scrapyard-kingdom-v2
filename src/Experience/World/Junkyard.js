import * as THREE from 'three'
import gsap from 'gsap'
import Experience from '../Experience.js'
import seededRandom from '../Game/seededRandom.js'
import { JUNK } from '../Game/Grid.js'
import JunkBatch from './JunkBatch.js'

// Scanned and game-ready wrecks, textured and rusted already, so they only get a tint. length: meters
// along the car, the downloads come in any unit and JunkLibrary.scaleFor turns that into a scale.
const WRECKS = [
    { name: 'car_crashed', length: 4.6 },
    { name: 'sedan_a', length: 4.7 },
    { name: 'sedan_b', length: 4.8 },
    { name: 'truck_rusty', length: 5.3 },
    { name: 'van_delivery', length: 4.9 },
    { name: 'car_pirozhok', length: 4.2 },
    { name: 'car_destroyed', length: 4.9 },
    { name: 'van_crushed', length: 4.6 },
    { name: 'covered_car', length: 4.5 }
]
const LOOSE = [
    { name: 'old_tyre', pitch: Math.PI / 2 },
    { name: 'old_tyre', pitch: 1.2 },
    { name: 'Barrel_01' },
    { name: 'Barrel_02' },
    { name: 'barrel_03' },
    { name: 'barrel_stove' },
    { name: 'small_lpg_tank' },
    { name: 'wooden_military_crate' },
    { name: 'old_military_crate' },
    { name: 'cement_bag' },
    { name: 'trashbag' },
    { name: 'Television_01' },
    { name: 'exterior_aircon_unit' },
    { name: 'portable_generator' },
    { name: 'cardboard_box_01' },
    { name: 'plastic_jerrycan' },
    { name: 'wooden_crate_02' },
    { name: 'rusted_wheel_rim_02', pitch: Math.PI / 2 },
    { name: 'ladder_sectioned_01', pitch: Math.PI / 2 },
    { name: 'metal_jerrycan' },
    { name: 'gas_can', scale: 0.22 },
    { name: 'water_manhole_cover' }
]
// Dumped workshop gear: big pieces stand on a cell of their own, small ones lie around them
const MACHINES = [
    'old_military_compressor', 'old_drill_press', 'worn_metal_rack', 'tool_cart', 'utility_box_02',
    'industrial_storage_cart', 'hand_truck', 'metal_trash_can', 'concrete_road_barrier_02'
]
const LITTER = ['cardboard_box_01', 'wooden_crate_02', 'plastic_jerrycan', 'metal_jerrycan', 'propane_torch', 'can_rusted', 'can_rusted']
const CRATES = [
    { name: 'wooden_crate_02', scale: 1 },
    { name: 'old_military_crate', scale: 0.8 },
    { name: 'wooden_military_crate', scale: 1 },
    { name: 'cardboard_box_01', scale: 1.2 },
    { name: 'ammo_box', scale: 2.4 }
]

// The junk inside the fence. Which cells hold junk comes from the Grid, what stands on them is decided here.
// Piles are messy on purpose: nothing is square, nothing repeats exactly.
export default class Junkyard
{
    constructor()
    {
        this.experience = new Experience()
        this.world = this.experience.world
        this.grid = this.world.grid

        this.group = new THREE.Group()
        this.experience.scene.add(this.group)
        this.batch = new JunkBatch(this.group, this.world.junkLibrary)
        this.loose = new JunkBatch(this.group, this.world.junkLibrary, { shadows: false })
        this.heights = new Float32Array(this.grid.size * this.grid.size)
    }

    isInner(i, j)
    {
        const last = this.grid.size - 1
        return i > 0 && j > 0 && i < last && j < last && this.grid.terrain[this.grid.index(i, j)] === JUNK
    }

    build(seed)
    {
        this.random = seededRandom(seed ^ 0x7a3)
        this.heights.fill(0)
        this.batch.clear()
        this.loose.clear()

        const taken = new Set()
        for(let j = 1; j < this.grid.size - 1; j++)
        {
            for(let i = 1; i < this.grid.size - 1; i++)
            {
                if(!this.isInner(i, j) || taken.has(this.grid.index(i, j)))
                    continue

                const partner = this.freeNeighbour(i, j, taken)
                if(partner && this.random() < 0.55)
                    this.wreckPile(i, j, partner, taken)
                else
                    this.junkPile(i, j)
            }
        }

        this.batch.build()
        this.loose.build()
    }

    freeNeighbour(i, j, taken)
    {
        const options = [[i + 1, j], [i, j + 1]].filter(([a, b]) => this.isInner(a, b) && !taken.has(this.grid.index(a, b)))
        return options.length ? options[Math.floor(this.random() * options.length)] : null
    }

    spread(amount)
    {
        return (this.random() - 0.5) * amount
    }

    tint()
    {
        const shade = 0.72 + this.random() * 0.4
        return new THREE.Color(shade, shade * (0.96 + this.random() * 0.06), shade * (0.9 + this.random() * 0.1))
    }

    pick(list)
    {
        return list[Math.floor(this.random() * list.length)]
    }

    // One cell of junk. Nothing here is a box: tyres, barrels, gear, crates, a heap, a skip.
    junkPile(i, j)
    {
        const { x, z } = this.grid.cellToWorld(i, j)
        const roll = this.random()
        if(roll < 0.16)
            this.tyreStack(i, j, x, z)
        else if(roll < 0.32)
            this.barrelGroup(i, j, x, z)
        else if(roll < 0.52)
            this.gearPile(i, j, x, z)
        else if(roll < 0.68)
            this.crateStack(i, j, x, z)
        else if(roll < 0.88)
            this.junkHeap(i, j, x, z)
        else
            this.skipPile(i, j, x, z)
    }

    // A whole car, lying along the pile. On its wheels, on its side or on its roof: never tilted on nothing.
    car(x, y, z, along, pose = 'wheels')
    {
        const car = this.pick(WRECKS)
        const roll = pose === 'side' ? Math.PI / 2 : pose === 'roof' ? Math.PI : this.spread(0.04)
        return this.batch.place(car.name, {
            x: x + this.spread(0.15),
            y,
            z: z + this.spread(0.15),
            yaw: along + this.spread(0.12) + (this.random() < 0.5 ? Math.PI : 0),
            pitch: this.spread(0.03),
            roll,
            scale: this.world.junkLibrary.scaleFor(car.name, car.length),
            color: this.tint()
        })
    }

    // Two cells: a car, often a second one stacked square on its roof, now and then a third.
    // Stacked cars sit 0.3 m into the one below: the floor rests on the roof, the wheels hang past it.
    wreckPile(i, j, partner, taken)
    {
        const [pi, pj] = partner
        taken.add(this.grid.index(pi, pj))

        const first = this.grid.cellToWorld(i, j)
        const second = this.grid.cellToWorld(pi, pj)
        const x = (first.x + second.x) / 2
        const z = (first.z + second.z) / 2
        const along = pi !== i ? Math.PI / 2 : 0

        const roll = this.random()
        let top = this.car(x, 0, z, along, roll < 0.12 ? 'side' : roll < 0.2 ? 'roof' : 'wheels')
        const layers = roll < 0.2 ? 0 : this.random() < 0.6 ? 1 + (this.random() < 0.3 ? 1 : 0) : 0
        for(let layer = 0; layer < layers; layer++)
            top = this.car(x, top - 0.3, z, along)

        if(this.random() < 0.4)
            this.looseBeside(x, z)

        this.heights[this.grid.index(i, j)] = top
        this.heights[this.grid.index(pi, pj)] = top
    }

    // A rack or a steel shelf at the back, crates stacked up to two high in front of it
    crateStack(i, j, x, z)
    {
        const back = this.random() * Math.PI * 2
        const shelf = this.random() < 0.5
        let top = this.batch.place(shelf ? 'steel_frame_shelves_01' : 'worn_metal_rack', {
            x: x + Math.cos(back) * 0.65,
            z: z + Math.sin(back) * 0.65,
            yaw: Math.PI / 2 - back + this.spread(0.2),
            // The shelf's file comes ten times too big
            scale: shelf ? 0.1 : 1.15,
            color: this.tint()
        })
        for(let n = 0; n < 4; n++)
        {
            const angle = back + Math.PI + (n - 1.5) * 0.55
            const px = x + Math.cos(angle) * 0.45
            const pz = z + Math.sin(angle) * 0.45
            let height = 0
            const layers = this.random() < 0.5 ? 2 : 1
            for(let layer = 0; layer < layers; layer++)
            {
                const crate = this.pick(CRATES)
                height = this.batch.place(crate.name, {
                    x: px,
                    y: height,
                    z: pz,
                    yaw: back + this.spread(layer ? 0.1 : 0.4),
                    scale: crate.scale,
                    color: this.tint()
                })
            }
            top = Math.max(top, height)
        }
        this.heights[this.grid.index(i, j)] = top
    }

    // Scrap thrown together: a smashed barrier, a run of chain-link flat on the ground, pipes, tyres and whatever else fell off
    junkHeap(i, j, x, z)
    {
        const top = this.batch.place('barrier_trash', {
            x: x + this.spread(0.3),
            z: z + this.spread(0.3),
            yaw: this.random() * Math.PI * 2,
            scale: 0.5,
            color: this.tint()
        })
        this.loose.place('modular_chainlink_fence', {
            x: x + this.spread(0.6),
            z: z + this.spread(0.6),
            yaw: this.random() * Math.PI * 2,
            pitch: Math.PI / 2,
            color: this.tint()
        })
        if(this.random() < 0.5)
            this.batch.place('modular_industrial_pipes_01', {
                x: x + this.spread(0.9),
                z: z + this.spread(0.9),
                yaw: this.random() * Math.PI * 2,
                pitch: Math.PI / 2,
                color: this.tint()
            })
        for(let n = 0; n < 2; n++)
            this.looseBeside(x, z)
        this.heights[this.grid.index(i, j)] = top
    }

    // A skip or a dumpster, bags and bins around it
    skipPile(i, j, x, z)
    {
        const skip = this.random() < 0.5
        const yaw = this.random() * Math.PI * 2
        const top = this.batch.place(skip ? 'trash_container' : 'dumpster', { x, z, yaw, scale: skip ? 0.62 : 0.85, color: this.tint() })
        const around = ['trashbag', 'trashbag', 'metal_trash_can', 'can_rusted']
        for(let n = 0; n < 3; n++)
        {
            const angle = yaw + Math.PI / 2 + this.spread(1.2) + (n % 2) * Math.PI
            this.loose.place(this.pick(around), {
                x: x + Math.cos(angle),
                z: z + Math.sin(angle),
                yaw: this.random() * Math.PI * 2,
                color: this.tint()
            })
        }
        this.heights[this.grid.index(i, j)] = top
    }

    tyreStack(i, j, x, z)
    {
        // Tyres alone do not fill a cell, so three stacks stand together
        let top = 0
        for(let stack = 0; stack < 3; stack++)
        {
            const angle = stack * 2.1 + this.random()
            const baseX = x + Math.cos(angle) * 0.6
            const baseZ = z + Math.sin(angle) * 0.6
            const count = 2 + Math.floor(this.random() * 4)
            let height = 0
            for(let n = 0; n < count; n++)
            {
                height = this.batch.place('old_tyre', {
                    x: baseX + this.spread(0.12),
                    y: height - 0.02,
                    z: baseZ + this.spread(0.12),
                    yaw: this.random() * Math.PI * 2,
                    pitch: Math.PI / 2 + this.spread(0.1),
                    scale: 1.6,
                    color: this.tint()
                })
            }
            top = Math.max(top, height)
        }

        // One that rolled away and fell over
        const angle = this.random() * Math.PI * 2
        this.loose.place('old_tyre', {
            x: x + Math.cos(angle) * 1.15,
            z: z + Math.sin(angle) * 1.15,
            yaw: angle,
            pitch: 1.1,
            scale: 1.5,
            color: this.tint()
        })

        this.heights[this.grid.index(i, j)] = top
    }

    barrelGroup(i, j, x, z)
    {
        const barrels = ['Barrel_01', 'Barrel_02', 'barrel_03', 'barrel_stove', 'wooden_barrels_01']
        let top = 0

        for(let n = 0; n < 5; n++)
        {
            const fallen = this.random() < 0.3
            const angle = n * 1.3 + this.random()
            const reach = n === 0 ? 0 : 0.72
            top = Math.max(top, this.batch.place(barrels[Math.floor(this.random() * barrels.length)], {
                x: x + Math.cos(angle) * reach,
                z: z + Math.sin(angle) * reach,
                yaw: this.random() * Math.PI * 2,
                pitch: fallen ? Math.PI / 2 : this.spread(0.1),
                roll: fallen ? 0 : this.spread(0.1),
                scale: 1.15,
                color: this.tint()
            }))
        }
        this.heights[this.grid.index(i, j)] = top
    }

    // Three machines back to back in the middle of the cell, one of them sometimes knocked over.
    // A bit over life size, or a cell that blocks the way reads as open ground.
    gearPile(i, j, x, z)
    {
        let top = 0
        const start = this.random() * Math.PI * 2
        for(let n = 0; n < 3; n++)
        {
            const angle = start + n * Math.PI * 2 / 3
            const fallen = this.random() < 0.15
            top = Math.max(top, this.batch.place(this.pick(MACHINES), {
                x: x + Math.cos(angle) * 0.55,
                z: z + Math.sin(angle) * 0.55,
                yaw: - angle + this.spread(0.5),
                roll: fallen ? Math.PI / 2 : this.spread(0.05),
                scale: 1.25,
                color: this.tint()
            }))
        }
        for(let n = 0; n < 4; n++)
        {
            const angle = this.random() * Math.PI * 2
            this.loose.place(this.pick(LITTER), {
                x: x + Math.cos(angle) * 0.95,
                z: z + Math.sin(angle) * 0.95,
                yaw: this.random() * Math.PI * 2,
                roll: this.spread(0.3),
                color: this.tint()
            })
        }
        this.heights[this.grid.index(i, j)] = top
    }

    randomLoose()
    {
        return LOOSE[Math.floor(this.random() * LOOSE.length)]
    }

    looseOn(x, z, top)
    {
        const item = this.randomLoose()
        this.loose.place(item.name, {
            x: x + this.spread(0.4),
            y: top - 0.03,
            z: z + this.spread(0.4),
            yaw: this.random() * Math.PI * 2,
            pitch: item.pitch ?? this.spread(0.08),
            roll: this.spread(0.08),
            scale: item.scale ?? 1,
            color: this.tint()
        })
    }

    looseBeside(x, z)
    {
        const item = this.randomLoose()
        const angle = this.random() * Math.PI * 2
        const reach = this.grid.cell * 0.46
        this.loose.place(item.name, {
            x: x + Math.cos(angle) * reach,
            z: z + Math.sin(angle) * reach,
            yaw: this.random() * Math.PI * 2,
            pitch: item.pitch ?? this.spread(0.06),
            roll: this.spread(0.06),
            scale: item.scale ?? 1,
            color: this.tint()
        })
    }

    // Round change: the old layout sinks, the new one comes up. The Grid must already hold the new map.
    swap(seed, onSwapped)
    {
        gsap.killTweensOf(this.group.position)
        gsap.to(this.group.position, {
            y: -7,
            duration: 0.9,
            ease: 'power2.in',
            onComplete: () =>
            {
                this.build(seed)
                onSwapped?.()
                gsap.to(this.group.position, { y: 0, duration: 1.2, ease: 'power2.out' })
            }
        })
    }
}

export { WRECKS }
