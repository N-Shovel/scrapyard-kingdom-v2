import * as THREE from 'three'
import Experience from '../Experience.js'

const PARTICLES = 700
const TRACERS = 96

// What each kind of particle looks like and does. speed in m/s, life in s, size in m, gravity in m/s².
const KINDS =
{
    spark: { glow: true, colors: ['#ffd27a', '#ffb347', '#fff1c4'], speed: [3, 9], life: [0.12, 0.35], size: [0.04, 0.08], gravity: 14, drag: 2 },
    flash: { glow: true, colors: ['#ffe2a0'], speed: [0, 0.2], life: [0.05, 0.07], size: [0.5, 0.7], gravity: 0, drag: 0 },
    fire: { glow: true, colors: ['#ff9a3c', '#ffc46b', '#ff6a2a'], speed: [1, 4], life: [0.18, 0.4], size: [0.6, 1.1], gravity: -3, drag: 3, grow: 1.2 },
    flame: { glow: true, colors: ['#9fd8ff', '#e8f6ff', '#ffb347'], speed: [0.5, 1.5], life: [0.06, 0.14], size: [0.05, 0.1], gravity: -2, drag: 4 },
    dust: { glow: false, colors: ['#6e6152', '#857563', '#5a5046'], speed: [0.4, 1.6], life: [0.6, 1.3], size: [0.25, 0.55], gravity: -0.4, drag: 3, grow: 1.8 },
    smoke: { glow: false, colors: ['#4a4640', '#5c574f'], speed: [0.5, 2], life: [1, 2], size: [0.6, 1.2], gravity: -1.2, drag: 2, grow: 2.2 },
    puff: { glow: false, colors: ['#8a857c', '#a09a90'], speed: [0.3, 0.8], life: [0.3, 0.6], size: [0.08, 0.16], gravity: -0.6, drag: 3, grow: 2.5 },
    oil: { glow: false, colors: ['#1d1a16', '#2b231a'], speed: [1, 3.5], life: [0.25, 0.5], size: [0.06, 0.12], gravity: 12, drag: 1 },
    blood: { glow: false, colors: ['#4a120c', '#5e1a10'], speed: [1, 3], life: [0.2, 0.45], size: [0.05, 0.11], gravity: 12, drag: 1 }
}

const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec3 aColor;
    varying float vAlpha;
    varying vec3 vColor;
    uniform float uScale;

    void main()
    {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = min(aSize * uScale / - viewPosition.z, 220.0);
        // Anything right in front of the camera fades instead of filling the screen
        vAlpha = aAlpha * smoothstep(0.35, 1.2, - viewPosition.z);
        vColor = aColor;
    }
`

const fragmentShader = /* glsl */ `
    varying float vAlpha;
    varying vec3 vColor;

    void main()
    {
        float distanceToCenter = length(gl_PointCoord - 0.5);
        float strength = smoothstep(0.5, 0.15, distanceToCenter);
        gl_FragColor = vec4(vColor, strength * vAlpha);
        #include <colorspace_fragment>
    }
`

const random = (min, max) => min + Math.random() * (max - min)

// Particles, tracers and the flash of a shot. Bursts take a kind from KINDS, a place and a count.
export default class Effects
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.sizes = this.experience.sizes

        // Glowing things add up, dust and smoke cover what is behind them
        this.glow = this.setParticles(THREE.AdditiveBlending)
        this.haze = this.setParticles(THREE.NormalBlending)
        this.setTracers()
    }

    setParticles(blending)
    {
        const geometry = new THREE.BufferGeometry()
        const attribute = (size) => new THREE.BufferAttribute(new Float32Array(PARTICLES * size), size).setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('position', attribute(3))
        geometry.setAttribute('aColor', attribute(3))
        geometry.setAttribute('aSize', attribute(1))
        geometry.setAttribute('aAlpha', attribute(1))
        geometry.setDrawRange(0, 0)

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uScale: { value: this.sizes.height * 0.9 } },
            transparent: true,
            depthWrite: false,
            blending
        })
        const points = new THREE.Points(geometry, material)
        points.frustumCulled = false
        this.scene.add(points)

        return { points, geometry, material, list: [] }
    }

    setTracers()
    {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACERS * 6), 3).setUsage(THREE.DynamicDrawUsage))
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRACERS * 6), 3).setUsage(THREE.DynamicDrawUsage))
        geometry.setDrawRange(0, 0)
        // Additive, so fading the color to black fades the line
        const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        this.tracerLines = new THREE.LineSegments(geometry, material)
        this.tracerLines.frustumCulled = false
        this.scene.add(this.tracerLines)
        this.tracers = []
    }

    burst(kind, position, count, { direction = null, spread = 1, speed = 1 } = {})
    {
        const def = KINDS[kind]
        const system = def.glow ? this.glow : this.haze
        for(let n = 0; n < count && system.list.length < PARTICLES; n++)
        {
            const velocity = new THREE.Vector3(random(-1, 1), random(-0.2, 1), random(-1, 1)).normalize()
            if(direction)
                velocity.multiplyScalar(spread).add(direction).normalize()
            velocity.multiplyScalar(random(...def.speed) * speed)
            const life = random(...def.life)
            system.list.push({
                position: position.clone(),
                velocity,
                life,
                age: 0,
                size: random(...def.size),
                color: new THREE.Color(def.colors[Math.floor(Math.random() * def.colors.length)]),
                def
            })
        }
    }

    tracer(from, to, { color = '#ffd27a', life = 0.06 } = {})
    {
        if(this.tracers.length >= TRACERS)
            this.tracers.shift()
        this.tracers.push({ from: from.clone(), to: to.clone(), color: new THREE.Color(color), life, age: 0 })
    }

    // A muzzle flash is light-colored particles only. A real light, even at intensity 0, doubled the
    // render time on the integrated GPU: every lit pixel of the yard paid for it.
    flash(position, count = 1)
    {
        this.burst('flash', position, count)
    }

    explosion(position, size = 1)
    {
        this.flash(position, 3)
        this.burst('fire', position, Math.round(14 * size))
        this.burst('spark', position, Math.round(40 * size), { speed: 1.4 })
        this.burst('dust', position, Math.round(18 * size), { speed: 2.5 })
        this.burst('smoke', position, Math.round(10 * size))
    }

    updateParticles(system, delta)
    {
        const { geometry, list } = system
        const position = geometry.attributes.position.array
        const color = geometry.attributes.aColor.array
        const size = geometry.attributes.aSize.array
        const alpha = geometry.attributes.aAlpha.array

        let count = 0
        for(let n = 0; n < list.length; n++)
        {
            const particle = list[n]
            particle.age += delta
            if(particle.age >= particle.life)
                continue
            const def = particle.def
            particle.velocity.y -= def.gravity * delta
            particle.velocity.multiplyScalar(Math.max(0, 1 - def.drag * delta))
            particle.position.addScaledVector(particle.velocity, delta)
            if(particle.position.y < 0.02 && def.gravity > 0)
            {
                particle.position.y = 0.02
                particle.velocity.set(0, 0, 0)
            }

            const t = particle.age / particle.life
            particle.color.toArray(color, count * 3)
            particle.position.toArray(position, count * 3)
            size[count] = particle.size * (1 + (def.grow ?? 0) * t)
            alpha[count] = def.glow ? 1 - t : (1 - t) * 0.45
            list[count++] = particle
        }
        list.length = count
        geometry.setDrawRange(0, count)
        for(const name of ['position', 'aColor', 'aSize', 'aAlpha'])
            geometry.attributes[name].needsUpdate = true
    }

    updateTracers(delta)
    {
        const geometry = this.tracerLines.geometry
        const position = geometry.attributes.position.array
        const color = geometry.attributes.color.array
        let count = 0
        for(const tracer of this.tracers)
        {
            tracer.age += delta
            if(tracer.age >= tracer.life)
                continue
            const fade = 1 - tracer.age / tracer.life
            tracer.from.toArray(position, count * 6)
            tracer.to.toArray(position, count * 6 + 3)
            // The far end is dimmer: it reads as a streak flying away, not a laser
            color.set([tracer.color.r * fade, tracer.color.g * fade, tracer.color.b * fade, tracer.color.r * fade * 0.25, tracer.color.g * fade * 0.25, tracer.color.b * fade * 0.25], count * 6)
            this.tracers[count++] = tracer
        }
        this.tracers.length = count
        geometry.setDrawRange(0, count * 2)
        geometry.attributes.position.needsUpdate = true
        geometry.attributes.color.needsUpdate = true
    }

    resize()
    {
        this.glow.material.uniforms.uScale.value = this.sizes.height * 0.9
        this.haze.material.uniforms.uScale.value = this.sizes.height * 0.9
    }

    update(delta)
    {
        this.updateParticles(this.glow, delta)
        this.updateParticles(this.haze, delta)
        this.updateTracers(delta)
    }
}
