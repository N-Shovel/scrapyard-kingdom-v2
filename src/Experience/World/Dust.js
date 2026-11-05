import * as THREE from 'three'
import Experience from '../Experience.js'

const COUNT = 900
const BOX = 90
const HEIGHT = 14

const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    attribute float aSize;
    attribute float aPhase;
    varying float vFade;

    void main()
    {
        vec3 moved = position;
        moved.x += sin(uTime * 0.11 + aPhase) * 2.4 + uTime * 0.25;
        moved.z += cos(uTime * 0.09 + aPhase * 1.7) * 2.4;
        moved.y += sin(uTime * 0.2 + aPhase * 3.1) * 0.5;
        moved.x = mod(moved.x + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};

        vec4 view = viewMatrix * vec4(moved, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = aSize * uPixelRatio * (55.0 / -view.z);
        vFade = smoothstep(90.0, 20.0, -view.z);
    }
`

const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    varying float vFade;

    void main()
    {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.1, d) * 0.13 * vFade;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
    }
`

// Slow dust hanging in the low sun, as in the Points lessons but with its own small shader.
export default class Dust
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.sizes = this.experience.sizes

        const positions = new Float32Array(COUNT * 3)
        const sizes = new Float32Array(COUNT)
        const phases = new Float32Array(COUNT)
        for(let n = 0; n < COUNT; n++)
        {
            positions[n * 3] = (Math.random() - 0.5) * BOX
            positions[n * 3 + 1] = Math.random() * Math.random() * HEIGHT
            positions[n * 3 + 2] = (Math.random() - 0.5) * BOX
            sizes[n] = 0.6 + Math.random() * 2.2
            phases[n] = Math.random() * Math.PI * 2
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
        geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms:
            {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(this.sizes.pixelRatio, 2) },
                uColor: { value: new THREE.Color('#e6c9a3') }
            },
            transparent: true,
            depthWrite: false
        })

        this.points = new THREE.Points(geometry, this.material)
        this.points.frustumCulled = false
        this.scene.add(this.points)
    }

    update()
    {
        this.material.uniforms.uTime.value = this.time.elapsed * 0.001
    }
}
