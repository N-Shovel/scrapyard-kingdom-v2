// Downloads every third-party asset listed in assets.manifest.json into tools/.cache/.
// Nothing here is shipped directly: optimize-assets.mjs turns the cache into static/.
// Safe to re-run, files already in the cache are skipped.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.join(here, '.cache')
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'assets.manifest.json'), 'utf8'))

const save = async (url, file) =>
{
    if(fs.existsSync(file) && fs.statSync(file).size > 0)
        return false

    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`${response.status} for ${url}`)

    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    return true
}

const json = async (url) =>
{
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`${response.status} for ${url}`)
    return response.json()
}

const polyhavenHdri = async (id) =>
{
    const files = await json(`https://api.polyhaven.com/files/${id}`)
    await save(files.hdri['2k'].hdr.url, path.join(cache, 'hdri', `${id}.hdr`))
}

const polyhavenTexture = async (id) =>
{
    const files = await json(`https://api.polyhaven.com/files/${id}`)
    const maps = { color: 'Diffuse', normal: 'nor_gl', arm: 'arm' }

    for(const [name, key] of Object.entries(maps))
    {
        const entry = files[key]?.['2k']?.jpg
        if(entry)
            await save(entry.url, path.join(cache, 'textures', id, `${name}.jpg`))
    }
}

const polyhavenModel = async ({ id }) =>
{
    const files = await json(`https://api.polyhaven.com/files/${id}`)
    const gltf = files.gltf['1k'].gltf
    const dir = path.join(cache, 'models', id)

    await save(gltf.url, path.join(dir, `${id}.gltf`))
    for(const [relative, entry] of Object.entries(gltf.include))
        await save(entry.url, path.join(dir, relative))
}

// The card on a search page is the only place that maps a model id to its file name.
const polypizza = async ({ id, name, title }) =>
{
    const file = path.join(cache, 'polypizza', `${name}.glb`)
    if(fs.existsSync(file))
        return

    const page = await (await fetch(`https://poly.pizza/m/${id}`)).text()
    const match = page.match(/static\.poly\.pizza\/([a-f0-9-]{36})\.glb/) ?? page.match(/static\.poly\.pizza\/([a-f0-9-]{36})\.webp/)
    if(!match)
        throw new Error(`No file found on the page of ${title} (${id})`)

    await save(`https://static.poly.pizza/${match[1]}.glb`, file)
    const license = page.match(/creativecommons\.org\/[a-z]+\/[a-z0-9./-]+/i)?.[0] ?? 'unknown'
    fs.writeFileSync(`${file}.license.txt`, `${title} ${id} ${license}\n`)
}

// Saved as downloaded. Unpack each zip into its own folder, and never run anything from it.
const opengameart = async ({ file }) =>
{
    await save(`https://opengameart.org/sites/default/files/${file}`, path.join(cache, 'oga', file))
}

const run = async (label, items, job) =>
{
    for(const item of items)
    {
        try
        {
            await job(item)
            console.log('ok  ', label, item.id ?? item.file ?? item)
        }
        catch(error)
        {
            console.log('FAIL', label, item.id ?? item.file ?? item, error.message)
        }
    }
}

await run('hdri', manifest.polyhaven.hdri, polyhavenHdri)
await run('texture', manifest.polyhaven.textures, polyhavenTexture)
await run('model', manifest.polyhaven.models, polyhavenModel)
await run('polypizza', manifest.polypizza, polypizza)
await run('opengameart', manifest.opengameart, opengameart)
