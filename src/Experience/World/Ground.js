import * as THREE from 'three'
import Experience from '../Experience.js'
import surface from '../Materials/surface.js'
import seededRandom from '../Game/seededRandom.js'
import { STASH } from '../Game/Grid.js'

const MASK_SIZE = 2048     // 6 cm a pixel. At 1024 the small oil stains showed their pixels from above.
const MASK_METERS = 130
const PLANE_SIZE = 700

// The yard floor: gravelly sand, with gravel and red ground splatted in by a hand-drawn mask.
// mask.r = tarred gravel, mask.g = red ground, mask.b = oil and tire marks, drawn with Poly Haven's bitumen.
export default class Ground
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.grid = this.experience.world.grid

        this.setMask()
        this.setMaterial()
        this.setMesh()
        this.paint(1)
    }

    setMask()
    {
        this.canvas = document.createElement('canvas')
        this.canvas.width = MASK_SIZE
        this.canvas.height = MASK_SIZE
        this.context = this.canvas.getContext('2d')

        this.mask = new THREE.CanvasTexture(this.canvas)
        this.mask.wrapS = THREE.ClampToEdgeWrapping
        this.mask.wrapT = THREE.ClampToEdgeWrapping
    }

    setMaterial()
    {
        this.material = surface('gravelly_sand', { roughness: 1, metalness: 0 })
        this.material.metalnessMap = null
        this.material.aoMap = null

        const repeatable = (name) =>
        {
            const texture = this.resources.items[name]
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            return texture
        }

        this.material.onBeforeCompile = (shader) =>
        {
            shader.uniforms.uMask = { value: this.mask }
            shader.uniforms.uMaskMeters = { value: MASK_METERS }
            shader.uniforms.uGravel = { value: repeatable('tarred_gravel_color') }
            shader.uniforms.uGravelNormal = { value: repeatable('tarred_gravel_normal') }
            shader.uniforms.uRed = { value: repeatable('cracked_red_ground_color') }
            shader.uniforms.uRedNormal = { value: repeatable('cracked_red_ground_normal') }
            shader.uniforms.uOil = { value: repeatable('bitumen_color') }
            shader.uniforms.uOilNormal = { value: repeatable('bitumen_normal') }

            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
                    varying vec2 vGround;`)
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    vGround = (modelMatrix * vec4(position, 1.0)).xz;`)

            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `#include <common>
                    uniform sampler2D uMask;
                    uniform float uMaskMeters;
                    uniform sampler2D uGravel;
                    uniform sampler2D uGravelNormal;
                    uniform sampler2D uRed;
                    uniform sampler2D uRedNormal;
                    uniform sampler2D uOil;
                    uniform sampler2D uOilNormal;
                    varying vec2 vGround;
                    vec3 groundMask;
                    float groundFar;
                    vec2 uvDirt;
                    vec2 uvGravel;
                    vec2 uvRed;
                    vec2 uvOil;

                    float groundNoise(vec2 p)
                    {
                        vec2 i = floor(p);
                        vec2 f = fract(p);
                        f = f * f * (3.0 - 2.0 * f);
                        vec2 h = vec2(127.1, 311.7);
                        float a = fract(sin(dot(i, h)) * 43758.5453);
                        float b = fract(sin(dot(i + vec2(1, 0), h)) * 43758.5453);
                        float c = fract(sin(dot(i + vec2(0, 1), h)) * 43758.5453);
                        float d = fract(sin(dot(i + vec2(1, 1), h)) * 43758.5453);
                        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                    }`)
                .replace('#include <map_fragment>', `
                    uvDirt = vGround / 3.1;
                    uvGravel = vGround / 2.3 + 0.37;
                    uvRed = vGround / 4.7 + 0.71;
                    uvOil = vGround / 1.9 + 0.23;

                    // Noise, not another texture lookup: anything tiled shows up as a grid from above
                    float grit = groundNoise(vGround * 1.3) * 0.5 + groundNoise(vGround * 0.37) * 0.5 - 0.5;
                    groundMask = texture2D(uMask, vGround / uMaskMeters + 0.5).rgb;
                    groundMask.rg = smoothstep(vec2(0.3), vec2(0.6), groundMask.rg + grit * 0.5);
                    // Fine noise frays the stain's edge, so its outline is ragged, not the mask's pixels
                    float fray = groundNoise(vGround * 5.0) - 0.5;
                    groundMask.b = smoothstep(0.2, 0.65, groundMask.b + grit * 0.2 + fray * 0.22);

                    // Two lookups turned against each other, swapped in patches, to hide the tiling up close
                    vec2 turned = vec2(uvDirt.x * 0.8 - uvDirt.y * 0.6, uvDirt.x * 0.6 + uvDirt.y * 0.8) * 0.53 + 0.13;
                    float patches = smoothstep(0.4, 0.6, groundNoise(vGround * 0.11));
                    vec3 dirt = mix(texture2D(map, uvDirt).rgb, texture2D(map, turned).rgb, patches);

                    // From far above any tile repeats, so it fades to each texture's average color
                    groundFar = smoothstep(26.0, 70.0, length(vViewPosition));
                    dirt = mix(dirt, textureLod(map, uvDirt, 9.0).rgb, groundFar);
                    dirt *= 0.8 + 0.6 * groundNoise(vGround * 0.045 + 9.0);

                    vec3 gravel = mix(texture2D(uGravel, uvGravel).rgb, textureLod(uGravel, uvGravel, 9.0).rgb, groundFar);
                    vec3 red = mix(texture2D(uRed, uvRed).rgb, textureLod(uRed, uvRed, 9.0).rgb, groundFar);
                    vec3 oil = mix(texture2D(uOil, uvOil).rgb, textureLod(uOil, uvOil, 9.0).rgb, groundFar);

                    vec3 floorColor = mix(dirt, gravel * vec3(0.92, 0.82, 0.72), groundMask.r);
                    floorColor = mix(floorColor, red, groundMask.g);
                    // Soaked in, not painted on: the sand still shows at the thin edge
                    floorColor = mix(floorColor, oil * 0.9, groundMask.b * 0.7);
                    diffuseColor.rgb = floorColor;`)
                .replace('#include <roughnessmap_fragment>', `
                    float roughnessFactor = mix(texture2D(roughnessMap, uvDirt).g, 0.42, groundMask.b);`)
                .replace('#include <normal_fragment_maps>', `
                    vec3 mapN = texture2D(normalMap, uvDirt).xyz;
                    mapN = mix(mapN, texture2D(uGravelNormal, uvGravel).xyz, groundMask.r);
                    mapN = mix(mapN, texture2D(uRedNormal, uvRed).xyz, groundMask.g);
                    mapN = mix(mapN, texture2D(uOilNormal, uvOil).xyz, groundMask.b);
                    mapN = mapN * 2.0 - 1.0;
                    mapN.xy *= normalScale * (1.0 - groundFar);
                    normal = normalize(tbn * mapN);`)
        }
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE), this.material)
        this.mesh.rotation.x = -Math.PI / 2
        this.mesh.receiveShadow = true
        this.scene.add(this.mesh)
    }

    // World meters to mask pixels.
    toPixels(x, z)
    {
        return [(x / MASK_METERS + 0.5) * MASK_SIZE, (z / MASK_METERS + 0.5) * MASK_SIZE]
    }

    blob(x, z, meters, red, green, blue, alpha)
    {
        const [px, py] = this.toPixels(x, z)
        const radius = (meters / MASK_METERS) * MASK_SIZE
        const gradient = this.context.createRadialGradient(px, py, 0, px, py, radius)
        gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`)
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`)
        this.context.fillStyle = gradient
        this.context.fillRect(px - radius, py - radius, radius * 2, radius * 2)
    }

    // Paints this yard's mask: patches first, then what trucks and enemies wore into it.
    paint(seed)
    {
        const random = seededRandom(seed ^ 0x51ab)
        const grid = this.grid
        const context = this.context

        context.globalCompositeOperation = 'source-over'
        context.fillStyle = 'black'
        context.fillRect(0, 0, MASK_SIZE, MASK_SIZE)
        context.globalCompositeOperation = 'lighter'

        for(let n = 0; n < 16; n++)
            this.blob((random() - 0.5) * MASK_METERS, (random() - 0.5) * MASK_METERS, 3 + random() * 7, 255, 0, 0, 0.5)
        for(let n = 0; n < 30; n++)
            this.blob((random() - 0.5) * MASK_METERS, (random() - 0.5) * MASK_METERS, 3 + random() * 9, 0, 255, 0, 0.5)

        // Packed gravel along the routes the gates use, a bit off the middle of each cell
        grid.updateRoutes()
        for(const gate of grid.gates)
        {
            for(const { i, j } of gate.route)
            {
                if(grid.terrain[grid.index(i, j)] === STASH)
                    continue
                const { x, z } = grid.cellToWorld(i, j)
                this.blob(x + (random() - 0.5) * 1.2, z + (random() - 0.5) * 1.2, 2.4, 255, 0, 0, 0.14)
            }
            this.tireTracks(gate.route, random)
        }

        // Oil, where cars stood leaking: three or four blobs make one ragged stain
        for(let n = 0; n < 24; n++)
        {
            const x = (random() - 0.5) * 80
            const z = (random() - 0.5) * 80
            const size = 0.8 + random() * random() * 1.8
            for(let part = 0; part < 3 + Math.floor(random() * 2); part++)
                this.blob(x + (random() - 0.5) * size, z + (random() - 0.5) * size, size * (0.5 + random() * 0.6), 0, 0, 255, 0.6)
        }

        this.mask.needsUpdate = true
    }

    tireTracks(route, random)
    {
        const context = this.context
        const wobble = () => (random() - 0.5) * 0.7
        context.lineWidth = (0.22 / MASK_METERS) * MASK_SIZE
        context.lineCap = 'round'
        context.strokeStyle = 'rgba(0, 0, 255, 0.28)'

        for(const side of [-0.8, 0.8])
        {
            context.beginPath()
            route.forEach(({ i, j }, index) =>
            {
                const { x, z } = this.grid.cellToWorld(i, j)
                const [px, py] = this.toPixels(x + side + wobble(), z + side + wobble())
                if(index === 0)
                    context.moveTo(px, py)
                else
                    context.lineTo(px, py)
            })
            context.stroke()
        }
    }
}
