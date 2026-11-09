// Turns tools/.cache into static/: Draco geometry, WebP textures, picked sounds and the sky.
//   npm run assets:optimize                 everything
//   npm run assets:optimize -- player swat  only these names
// Cached files are read as data, nothing from the cache is run. Never hand-edit static/.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { getBounds, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import
{
    clearNodeTransform, compactPrimitive, dedup, draco, flatten, join, joinPrimitives, palette, prune,
    resample, simplify, textureCompress, transformPrimitive, weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

const BUDGET_MB = 80
const TEXTURE_SIZE = 1024
const PLAYER_TEXTURE_SIZE = 2048
const SIMPLIFY_ERROR = 0.02

// The layers of the player. A clip only keeps tracks of its own layer: Blender bakes the other
// bones as whatever the last built clip left them at. See docs/reports/T03-player-rig.md.
const LOWER_BONES = /^(root|hips|spine|thigh\.|shin\.|foot_ik\.|foot\.)/
const UPPER_BONES = /^(chest|neck|head|upper_arm\.|forearm\.|hand\.|rifle$)/
// pony has no keys of its own: Actors/PlayerHair.js swings it
const CONTROL_BONES = /pole|ik_tgt|hand_ik|pony/

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.join(here, '.cache')
const output = path.join(here, '..', 'static')
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'assets.manifest.json'), 'utf8'))

const only = process.argv.slice(2)
const wanted = (name) => only.length === 0 || only.includes(name)

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule()
    })

const triangles = (document) =>
{
    let count = 0
    for(const mesh of document.getRoot().listMeshes())
        for(const primitive of mesh.listPrimitives())
            count += (primitive.getIndices() ?? primitive.getAttribute('POSITION')).getCount() / 3
    return Math.round(count)
}

const webp = (size, options = {}) => textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82, ...options })

const save = async (document, name, before) =>
{
    const file = path.join(output, 'models', `${name}.glb`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    await io.write(file, document)

    const root = document.getRoot()
    const [x, y, z] = getBounds(root.listScenes()[0]).max.map((max, i) => max - getBounds(root.listScenes()[0]).min[i])
    const draws = root.listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0)
    console.log(
        name.padEnd(24),
        `${before} > ${triangles(document)} tris`.padEnd(24),
        `${draws} draws`.padEnd(9),
        `${x.toFixed(2)} x ${y.toFixed(2)} x ${z.toFixed(2)} m`.padEnd(28),
        `${(fs.statSync(file).size / 1e6).toFixed(2)} MB`
    )
}

// One mesh with no transforms above it, so the game can feed the geometry straight to an InstancedMesh.
const bakeTransforms = (document) =>
{
    for(const scene of document.getRoot().listScenes())
        scene.traverse((node) => clearNodeTransform(node))
}

// Keeps the triangles whose middle lies above (or below) a share of the model's height. A turret that came
// as one mesh becomes a head that turns and a base that stays, both still in the file's own frame.
const cutAt = (document, { at, keep }) =>
{
    const bounds = getBounds(document.getRoot().listScenes()[0])
    const y = bounds.min[1] + (bounds.max[1] - bounds.min[1]) * at
    for(const mesh of document.getRoot().listMeshes())
        for(const primitive of mesh.listPrimitives())
        {
            const position = primitive.getAttribute('POSITION')
            const indices = primitive.getIndices()
            const kept = []
            for(let t = 0; t < indices.getCount(); t += 3)
            {
                const corners = [indices.getScalar(t), indices.getScalar(t + 1), indices.getScalar(t + 2)]
                const middle = corners.reduce((sum, k) => sum + position.getElement(k, [])[1], 0) / 3
                if((middle > y) === (keep === 'above'))
                    kept.push(...corners)
            }
            indices.setArray(new Uint32Array(kept))
            compactPrimitive(primitive)
        }
}

// A Poly Haven model, or a Sketchfab one unpacked by hand (file).
// part: keep only the meshes whose node name matches it, a regular expression. Kits ship many pieces in one file.
// drop: remove the meshes whose node name matches it.
// turn: degrees about +Y, so a model saved at an angle lines up with the axes before anything measures it.
// cut: see cutAt. error: how far the simplifier may move a surface, for models that stay heavy at the default.
// plain: Sketchfab exports mark every material two-sided and add a specular or unlit extension, so three.js
//   builds a MeshPhysicalMaterial or an unlit one. Closed models need none of it, and it costs: twice the
//   pixels and a heavier shader. twoSided keeps both faces, for thin panels. Transmission is the worst:
//   one glass part on screen makes three.js draw the whole scene a second time (T21).
const gltfModel = async ({ id, keep = 1, size = 512, part, drop, turn, cut, plain, twoSided, error = SIMPLIFY_ERROR, file = path.join(cache, 'models', id, `${id}.gltf`) }) =>
{
    const document = await io.read(file)
    const before = triangles(document)
    const root = document.getRoot()

    if(plain)
    {
        for(const extension of root.listExtensionsUsed())
            if(['KHR_materials_specular', 'KHR_materials_unlit', 'KHR_materials_transmission', 'KHR_materials_ior'].includes(extension.extensionName))
                extension.dispose()
        if(!twoSided)
            for(const material of root.listMaterials())
                material.setDoubleSided(false)
    }

    for(const node of root.listNodes())
    {
        const name = node.getName()
        if(node.getMesh() && ((part && !new RegExp(part).test(name)) || (drop && new RegExp(drop).test(name))))
            node.setMesh(null)
    }

    if(turn)
    {
        const scene = root.listScenes()[0]
        const half = THREE.MathUtils.degToRad(turn) / 2
        const pivot = document.createNode('turn').setRotation([0, Math.sin(half), 0, Math.cos(half)])
        for(const child of scene.listChildren())
        {
            scene.removeChild(child)
            pivot.addChild(child)
        }
        scene.addChild(pivot)
    }

    // Some Poly Haven props ship a morph target, which an InstancedMesh cannot draw
    for(const mesh of document.getRoot().listMeshes())
        for(const primitive of mesh.listPrimitives())
            primitive.listTargets().forEach((target) => primitive.removeTarget(target))

    // A rigged mob keeps its node tree, bind poses and clips: nothing is flattened, joined or baked
    if(root.listSkins().length)
    {
        await document.transform(dedup())
        // One draw per material: every enemy on screen is its own copy, so 45 meshes would be 45 draws each
        rigidToSkinned(document)
        joinSkinned(document)
        await document.transform(weld())
        if(keep < 1)
            await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: keep, error }))
        await document.transform(resample(), webp(size), prune({ keepLeaves: true }), draco())
        await save(document, id, before)
        return
    }

    await document.transform(dedup(), flatten(), join(), weld())
    if(cut)
    {
        bakeTransforms(document)
        cutAt(document, cut)
    }
    if(keep < 1)
        await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: keep, error }))
    bakeTransforms(document)
    await document.transform(webp(size), prune(), draco())

    await save(document, id, before)
}

// Some rigs move rigid parts, each a mesh hung under a bone (mob_hope has 45 of them, 45 draws per copy).
// Each becomes skinned to its bone with weight 1, so joinSkinned can make one mesh of them. A skinned vertex
// lands at joint * inverseBind * p, a rigid one at node * p: p becomes inverse(inverseBind) * inverse(joint) * node * p.
const rigidToSkinned = (document) =>
{
    const root = document.getRoot()
    const skin = root.listSkins()[0]
    const joints = skin.listJoints()
    const parentOf = new Map()
    for(const node of root.listNodes())
        for(const child of node.listChildren())
            parentOf.set(child, node)
    const bind = (k) => new THREE.Matrix4().fromArray(skin.getInverseBindMatrices().getArray(), k * 16)
    let target = null

    for(const node of root.listNodes())
    {
        if(!node.getMesh() || node.getSkin())
            continue
        let joint = parentOf.get(node)
        while(joint && !joints.includes(joint))
            joint = parentOf.get(joint)
        if(!joint)
            continue

        const k = joints.indexOf(joint)
        const matrix = bind(k).invert()
            .multiply(new THREE.Matrix4().fromArray(joint.getWorldMatrix()).invert())
            .multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()))
        if(!target)
        {
            target = document.createMesh('rigged')
            root.listScenes()[0].addChild(document.createNode('rigged').setMesh(target).setSkin(skin))
        }
        for(const primitive of node.getMesh().listPrimitives())
        {
            const count = primitive.getAttribute('POSITION').getCount()
            const indices = new Uint16Array(count * 4)
            const weights = new Float32Array(count * 4)
            for(let v = 0; v < count; v++)
            {
                indices[v * 4] = k
                weights[v * 4] = 1
            }
            const buffer = root.listBuffers()[0]
            primitive.setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(indices).setBuffer(buffer))
            primitive.setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(weights).setBuffer(buffer))
            transformPrimitive(primitive, matrix.elements)
            target.addPrimitive(primitive)
        }
        node.getMesh().dispose()
    }
}

// join() skips skinned meshes. These models split one skeleton over several meshes, so merge them
// by hand. A vertex is placed by joint * inverseBind * vertex, so a mesh bound differently moves by
// inverse(bindA) * bindB, and that has to be the same for every joint.
const joinSkinned = (document) =>
{
    const nodes = document.getRoot().listNodes().filter((node) => node.getSkin() && node.getMesh())
    if(nodes.length < 2 && (nodes[0]?.getMesh().listPrimitives().length ?? 0) < 2)
        return

    const [keep, ...others] = nodes
    const bind = (skin, joint) => new THREE.Matrix4().fromArray(skin.getInverseBindMatrices().getArray(), joint * 16)
    const skin = keep.getSkin()
    const mesh = keep.getMesh()

    for(const node of others)
    {
        const joints = node.getSkin().listJoints()
        if(joints.some((joint, i) => joint !== skin.listJoints()[i]))
            throw new Error(`${node.getName()} uses another joint list`)

        const offset = bind(skin, 0).invert().multiply(bind(node.getSkin(), 0))
        joints.forEach((joint, i) =>
        {
            const expected = bind(skin, i).multiply(offset).elements
            const actual = bind(node.getSkin(), i).elements
            if(expected.some((value, e) => Math.abs(value - actual[e]) > 0.01))
                throw new Error(`${node.getName()} is bound differently at ${joint.getName()}`)
        })

        for(const primitive of node.getMesh().listPrimitives())
        {
            compactPrimitive(primitive)
            transformPrimitive(primitive, offset.elements)
            mesh.addPrimitive(primitive)
        }
        node.getMesh().dispose()
        node.dispose()
    }

    const byMaterial = new Map()
    for(const primitive of mesh.listPrimitives())
    {
        const material = primitive.getMaterial()
        byMaterial.set(material, [...(byMaterial.get(material) ?? []), primitive])
    }
    for(const primitives of byMaterial.values())
    {
        if(primitives.length < 2)
            continue
        primitives.forEach((primitive) => compactPrimitive(primitive))
        const joined = joinPrimitives(primitives)
        primitives.forEach((primitive) => primitive.dispose())
        mesh.addPrimitive(joined)
    }
}

const quaterniusModel = async ({ name, keep = 1 }) =>
{
    const document = await io.read(path.join(cache, 'polypizza', `${name}.glb`))
    const before = triangles(document)

    await document.transform(dedup(), palette({ min: 1 }), flatten(), join(), weld())
    if(keep < 1)
        await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: keep, error: SIMPLIFY_ERROR }))
    bakeTransforms(document)
    await document.transform(webp(TEXTURE_SIZE, { lossless: true }), prune(), draco())

    await save(document, name, before)
}

const sameAsRest = (channel) =>
{
    const node = channel.getTargetNode()
    const rest = { translation: node.getTranslation(), rotation: node.getRotation(), scale: node.getScale() }[channel.getTargetPath()]
    const values = channel.getSampler().getOutput().getArray()
    return values.every((value, i) => Math.abs(value - rest[i % rest.length]) < 1e-4)
}

const cleanPlayerClips = (document) =>
{
    for(const animation of document.getRoot().listAnimations())
    {
        const name = animation.getName()
        const layer = name === 'death' ? /./ : /^(up_|hurt)/.test(name) ? UPPER_BONES : LOWER_BONES

        for(const channel of animation.listChannels())
        {
            const bone = channel.getTargetNode().getName()
            if(CONTROL_BONES.test(bone) || !layer.test(bone) || sameAsRest(channel))
                channel.dispose()
        }
    }
}

const player = async () =>
{
    const document = await io.read(path.join(cache, 'built', 'player.glb'))
    const before = triangles(document)

    cleanPlayerClips(document)
    await document.transform(resample(), webp(PLAYER_TEXTURE_SIZE), prune({ keepLeaves: true }), draco())

    await save(document, 'player', before)
}

// Built in Blender by a script of its own, like tools/blender/build_sign.py. Geometry only, no materials.
const built = async (name) =>
{
    const document = await io.read(path.join(cache, 'built', `${name}.glb`))
    const before = triangles(document)
    await document.transform(weld(), prune(), webp(TEXTURE_SIZE), draco())
    await save(document, name, before)
}

const texture = async (id) =>
{
    const folder = path.join(output, 'textures', id)
    fs.mkdirSync(folder, { recursive: true })

    for(const map of ['color', 'normal', 'arm'])
        await sharp(path.join(cache, 'textures', id, `${map}.jpg`))
            .resize(TEXTURE_SIZE)
            .webp({ quality: map === 'normal' ? 90 : 80 })
            .toFile(path.join(folder, `${map}.webp`))
}

const sound = (name, relative) =>
{
    const source = path.join(cache, 'oga', relative)
    if(!fs.existsSync(source))
        throw new Error(`Missing ${relative}. fetch-assets does not unpack zips, unpack each one into oga/x_<zip name>/`)

    const target = path.join(output, 'sounds', `${name}${path.extname(relative).toLowerCase()}`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
}

const folderSize = (folder) => fs.readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((sum, entry) => sum + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0)

if(wanted('player'))
    await player()

if(wanted('title_sign'))
    await built('title_sign')

for(const model of manifest.polyhaven.models.filter(({ id }) => wanted(id)))
    await gltfModel(model)

// Sketchfab needs a login to download, so these come in by hand: each glTF zip unpacked into tools/.cache/sketchfab/<id>/
// into: only a source for a model built in Blender, which reads it from the cache itself
for(const model of manifest.sketchfab.filter(({ id, into }) => wanted(id) && !into))
{
    // from: another entry's download, when one file gives two models (a turret's head and its base)
    const folder = model.from ?? model.id
    const file = path.join(cache, 'sketchfab', folder, 'scene.gltf')
    if(fs.existsSync(file))
        await gltfModel({ ...model, file, plain: true })
    else
        console.log(`${model.id.padEnd(24)} missing: download ${model.url} as glTF and unzip it into tools/.cache/sketchfab/${folder}/`)
}

for(const model of manifest.polypizza.filter(({ name }) => wanted(name)))
    await quaterniusModel(model)

for(const id of manifest.polyhaven.textures.filter(wanted))
    await texture(id)

for(const [name, relative] of Object.entries(manifest.sounds).filter(([name]) => wanted(name)))
    sound(name, relative)

if(wanted('sky'))
    fs.copyFileSync(path.join(cache, 'hdri', `${manifest.polyhaven.hdri[0]}.hdr`), path.join(output, 'textures', 'sky.hdr'))

const total = folderSize(output) / 1e6
console.log(`\nstatic/ is ${total.toFixed(1)} MB, budget ${BUDGET_MB} MB`)
if(total > BUDGET_MB)
{
    console.error('Over budget. Lower "keep" or "size" in the manifest.')
    process.exit(1)
}
