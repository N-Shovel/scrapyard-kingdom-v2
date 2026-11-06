import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Experience from '../Experience.js'
import surface from '../Materials/surface.js'

const MAX = 160
const FADE = 0.6          // seconds a piece takes to sink away at the end of its life

// Small things that fall and bounce, as in lesson 3.4: spent shells, bent plates, scrap to pick up.
// Only the ground collides, piles are not in the physics world.
export default class Debris
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.sounds = this.experience.sounds

        this.items = []
        this.setWorld()
        this.setLooks()
    }

    setWorld()
    {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true
        this.world.defaultContactMaterial.friction = 0.45
        this.world.defaultContactMaterial.restitution = 0.28

        const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() })
        ground.quaternion.setFromEuler(- Math.PI / 2, 0, 0)
        this.world.addBody(ground)
    }

    setLooks()
    {
        this.looks =
        {
            // A red plastic shell with a brass base, the scrap shotgun's
            shell: {
                geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.06, 8),
                material: new THREE.MeshStandardMaterial({ color: '#7a2318', roughness: 0.5 }),
                size: new CANNON.Vec3(0.011, 0.03, 0.011),
                mass: 0.02,
                sound: 'metal_clink'
            },
            plate: {
                geometry: new THREE.BoxGeometry(1, 1, 1),
                material: surface('rusty_metal_sheet', { repeat: [0.3, 0.3] }),
                size: new CANNON.Vec3(0.18, 0.02, 0.12),
                mass: 0.6,
                sound: 'metal'
            },
            scrap: {
                geometry: new THREE.BoxGeometry(1, 1, 1),
                material: surface('rusty_painted_metal', { repeat: [0.25, 0.25] }),
                size: new CANNON.Vec3(0.12, 0.05, 0.1),
                mass: 0.4,
                sound: 'metal_clink'
            }
        }
    }

    // velocity and spin in m/s and rad/s. life in seconds, 0 keeps it until remove().
    spawn(kind, position, velocity, { life = 6, scale = 1 } = {})
    {
        if(this.items.length >= MAX)
            this.remove(this.items[0])

        const look = this.looks[kind]
        const half = look.size.scale(scale)
        const body = new CANNON.Body({
            mass: look.mass * scale,
            shape: new CANNON.Box(half),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
            angularVelocity: new CANNON.Vec3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
            sleepSpeedLimit: 0.3
        })

        const mesh = new THREE.Mesh(look.geometry, look.material)
        mesh.castShadow = kind !== 'shell'
        mesh.receiveShadow = true
        // The box geometry is 1 m, the shell's cylinder is already to size
        if(kind !== 'shell')
            mesh.scale.set(half.x * 2, half.y * 2, half.z * 2)
        this.scene.add(mesh)

        const item = { kind, body, mesh, life, age: 0, lastSound: 0, scale: mesh.scale.clone() }
        // Lesson 3.4: the harder it hits, the louder it sounds
        body.addEventListener('collide', (event) =>
        {
            const strength = event.contact.getImpactVelocityAlongNormal()
            if(strength > 1.2 && item.age - item.lastSound > 0.15)
            {
                item.lastSound = item.age
                this.sounds.play(look.sound, { position: mesh.position, volume: Math.min(1, strength / 7) * (kind === 'shell' ? 0.35 : 0.6) })
            }
        })
        this.world.addBody(body)
        this.items.push(item)
        return item
    }

    // A handful of plates flying out from a point, for anything that breaks
    scatter(position, count, force = 4)
    {
        for(let n = 0; n < count; n++)
        {
            const angle = Math.random() * Math.PI * 2
            const velocity = new THREE.Vector3(Math.cos(angle) * force * Math.random(), force * (0.6 + Math.random()), Math.sin(angle) * force * Math.random())
            this.spawn('plate', position, velocity, { life: 5 + Math.random() * 3, scale: 0.6 + Math.random() * 0.9 })
        }
    }

    remove(item)
    {
        const index = this.items.indexOf(item)
        if(index < 0)
            return
        this.world.removeBody(item.body)
        item.mesh.removeFromParent()
        this.items.splice(index, 1)
    }

    update(delta)
    {
        this.world.step(1 / 60, delta, 3)

        for(const item of [...this.items])
        {
            item.age += delta
            item.mesh.position.copy(item.body.position)
            item.mesh.quaternion.copy(item.body.quaternion)

            if(!item.life)
                continue
            const left = item.life - item.age
            if(left < FADE)
                item.mesh.scale.copy(item.scale).multiplyScalar(Math.max(0.01, left / FADE))
            if(left <= 0)
                this.remove(item)
        }
    }
}
