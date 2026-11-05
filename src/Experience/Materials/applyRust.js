import * as THREE from 'three'
import Experience from '../Experience.js'

const declarations = /* glsl */ `
    uniform sampler2D uRustMap;
    uniform float uRustAmount;
    uniform float uRustScale;
    varying vec3 vRustPosition;
    varying vec3 vRustNormal;
    float rustMask;

    float rustHash(vec3 p)
    {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float rustNoise(vec3 p)
    {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(rustHash(i), rustHash(i + vec3(1, 0, 0)), f.x), mix(rustHash(i + vec3(0, 1, 0)), rustHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(rustHash(i + vec3(0, 0, 1)), rustHash(i + vec3(1, 0, 1)), f.x), mix(rustHash(i + vec3(0, 1, 1)), rustHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z
        );
    }
`

// Flat-colored low poly models sit badly next to scanned props, so this paints rust over them in the
// fragment shader. Triplanar, because those models have no useful UVs, and in object space, so it stays
// on the surface of an animated robot. Each instance is offset to get its own pattern.
export default function applyRust(material, { amount = 0.6, scale = 0.7, texture = 'rust_coarse_01' } = {})
{
    const { resources } = new Experience()

    const map = resources.items[`${texture}_color`]
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping

    material.onBeforeCompile = (shader) =>
    {
        shader.uniforms.uRustMap = { value: map }
        shader.uniforms.uRustAmount = { value: amount }
        shader.uniforms.uRustScale = { value: scale }

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                varying vec3 vRustPosition;
                varying vec3 vRustNormal;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vRustPosition = position;
                vRustNormal = normal;
                #ifdef USE_INSTANCING
                    vRustPosition += instanceMatrix[3].xyz * 1.7;
                #endif`)

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                ${declarations}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 rustBlend = pow(abs(normalize(vRustNormal)), vec3(4.0));
                rustBlend /= rustBlend.x + rustBlend.y + rustBlend.z;
                vec3 rustUv = vRustPosition * uRustScale;
                vec3 rustColor = texture2D(uRustMap, rustUv.zy).rgb * rustBlend.x
                    + texture2D(uRustMap, rustUv.xz).rgb * rustBlend.y
                    + texture2D(uRustMap, rustUv.xy).rgb * rustBlend.z;
                float rustBlotch = rustNoise(rustUv * 1.3) * 0.5 + rustNoise(rustUv * 4.7) * 0.32 + rustNoise(rustUv * 15.0) * 0.18;
                rustMask = smoothstep(1.0 - uRustAmount, 1.3 - uRustAmount, rustBlotch + (rustColor.r - 0.3) * 0.4);
                // Grime sits on everything, rust eats through it in patches
                diffuseColor.rgb *= 0.55 + 0.45 * rustNoise(rustUv * 2.3);
                diffuseColor.rgb = mix(diffuseColor.rgb, rustColor * vec3(0.78, 0.74, 0.7), rustMask);`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = mix(roughnessFactor, 0.92, rustMask);`)
            .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
                metalnessFactor = mix(metalnessFactor, 0.15, rustMask);`)
    }

    material.customProgramCacheKey = () => 'rust'
    material.needsUpdate = true

    return material
}
