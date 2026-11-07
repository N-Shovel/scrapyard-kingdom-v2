import * as THREE from 'three'
import Experience from '../Experience.js'
import surface from '../Materials/surface.js'
import JunkBatch from '../World/JunkBatch.js'
import { WRECKS } from '../World/Junkyard.js'

// The same cars the yard's piles are made of, the ones short enough for two cells
const CARS = WRECKS.filter(({ length }) => length <= 4.9)
const TURRET_BASE = 1.8    // meters across the turret's feet
const FLAK_BASE = 2.1      // meters along the flak's chassis

// Traps are welded from scrap: textured plates and pipes, made once and shared
let shared = null
const getShared = () => shared ??= {
    pipe: surface('rusty_metal_02', { repeat: [0.4, 1.5] }),
    grate: surface('metal_grate_rusty', { repeat: [2, 2] }),
    tar: surface('tarred_gravel', { repeat: [1.5, 1.5], color: '#4a423c', roughness: 0.2 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#2a0d08', emissive: '#ff2a12', emissiveIntensity: 2 }),
    box: new THREE.BoxGeometry(1, 1, 1),
    spike: new THREE.ConeGeometry(0.07, 0.38, 5),
    disc: new THREE.CylinderGeometry(0.98, 1.04, 0.05, 20),
    bulb: new THREE.SphereGeometry(0.07, 8, 6)
}

// One structure's look, centered on its footprint, long side along +Z. Returns the parts that move:
// head and barrels (turret, flak), pitch (flak), muzzle, spikes, lamp. batch holds the library models, gun the head's.
export default function createStructureModel(type)
{
    const { world } = new Experience()
    const yard = world.junkyard
    const parts = getShared()
    const group = new THREE.Group()
    const batch = new JunkBatch(group, world.junkLibrary)
    const model = { group, batch }
    const spread = (amount) => (Math.random() - 0.5) * amount
    const turn = () => Math.random() * Math.PI * 2

    const mesh = (geometry, material, parent, x, y, z, scale) =>
    {
        const part = new THREE.Mesh(geometry, material)
        part.position.set(x, y, z)
        if(scale)
            part.scale.set(...scale)
        part.castShadow = true
        part.receiveShadow = true
        parent.add(part)
        return part
    }

    // A head that turns, with a gun that kicks back when it fires. The gun is its own batch, inside
    // the barrels group, so it moves with them.
    const head = (y, muzzleY, muzzleZ) =>
    {
        model.head = new THREE.Group()
        model.head.position.y = y
        group.add(model.head)
        model.barrels = new THREE.Group()
        model.gun = new JunkBatch(model.barrels, world.junkLibrary)
        model.muzzle = new THREE.Object3D()
        model.muzzle.position.set(0, muzzleY, muzzleZ)
        model.barrels.add(model.muzzle)
        return model.head
    }

    // The turret and the flak are cut from one download each, so base, head and gun share the file's frame,
    // whose origin is where the head turns. The base goes where that origin lands on the structure's middle.
    const mount = (name, size) =>
    {
        const base = world.junkLibrary.get(name)
        const scale = size / Math.max(base.size.x, base.size.z)
        batch.place(name, { x: base.center.x * scale, z: base.center.z * scale, scale, color: yard.tint() })
        return { scale, floor: base.center.y - base.size.y / 2 }
    }
    // Where another piece of the same file sits, scaled: its middle and its size, its feet over the base's
    const piece = (name, { scale, floor }) =>
    {
        const { center, size } = world.junkLibrary.get(name)
        return {
            x: center.x * scale,
            y: (center.y - floor) * scale,
            z: center.z * scale,
            width: size.x * scale,
            height: size.y * scale,
            length: size.z * scale
        }
    }

    if(type === 'wreck')
    {
        const car = CARS[Math.floor(Math.random() * CARS.length)]
        batch.place(car.name, { yaw: (Math.random() < 0.5 ? 0 : Math.PI) + spread(0.12), scale: world.junkLibrary.scaleFor(car.name, 4.3), color: yard.tint() })
    }

    if(type === 'container')
    {
        // Three cells long, a cell wide: narrower than the model, which is a short, wide container
        const { size } = world.junkLibrary.get('container_rusted')
        batch.place('container_rusted', { yaw: Math.PI / 2 + spread(0.03), scale: [6.4 / size.x, 2.6 / size.y, 2.15 / size.z], color: yard.tint() })
    }

    if(type === 'turret')
    {
        // seangorman's Darwin auto cannon, cut at its neck: the housing and the twin barrels turn on the column
        const frame = mount('turret_base', TURRET_BASE)
        const gun = piece('turret_head', frame)
        const turning = head(gun.y - gun.height / 2, gun.height * 0.6, gun.z + gun.length / 2)
        turning.add(model.barrels)
        model.gun.place('turret_head', { x: gun.x, z: gun.z, scale: frame.scale, color: yard.tint() })
    }

    if(type === 'flak')
    {
        // CG Lads' air defence unit: the chassis stays, the yoke and sensor turn, the cannon tilts in the yoke
        const frame = mount('flak_base', FLAK_BASE)
        const yoke = piece('flak_head', frame)
        const cannon = piece('flak_gun', frame)
        const floor = yoke.y - yoke.height / 2
        const turning = head(floor, 0, cannon.length / 2)
        model.yoke = new JunkBatch(turning, world.junkLibrary)
        model.yoke.place('flak_head', { x: yoke.x, z: yoke.z, scale: frame.scale, color: yard.tint() })
        model.yoke.build()
        // It tilts about the cannon's middle, so the barrels rise out of the yoke and its breech sinks into it
        model.pitch = new THREE.Group()
        model.pitch.position.set(cannon.x, cannon.y - floor, cannon.z)
        turning.add(model.pitch)
        model.pitch.add(model.barrels)
        model.gun.place('flak_gun', { y: - cannon.height / 2, scale: frame.scale, color: yard.tint() })
    }

    if(type === 'spikes')
    {
        mesh(parts.box, parts.grate, group, 0, 0.03, 0, [2, 0.06, 2])
        model.spikes = new THREE.Group()
        group.add(model.spikes)
        for(let a = -0.75; a < 0.8; a += 0.5)
            for(let b = -0.75; b < 0.8; b += 0.5)
            {
                const spike = mesh(parts.spike, parts.pipe, model.spikes, a + spread(0.15), 0.25, b + spread(0.15))
                spike.rotation.set(spread(0.35), 0, spread(0.35))
                spike.castShadow = false
            }
    }

    if(type === 'tar')
    {
        const pool = mesh(parts.disc, parts.tar, group, 0, 0.025, 0)
        pool.castShadow = false
        batch.place('barrel_03', { x: 0.75, z: 0.7, roll: Math.PI / 2, yaw: turn(), scale: 0.85, color: yard.tint() })
    }

    if(type === 'mine')
    {
        // Half buried, a gas bottle with a blinking trigger on top
        batch.place('small_lpg_tank', { y: -0.18, pitch: Math.PI / 2, yaw: turn(), color: yard.tint() })
        model.lamp = mesh(parts.bulb, parts.lamp, group, 0, 0.3, 0)
    }

    batch.build()
    model.gun?.build()
    return model
}
