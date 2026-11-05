import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import EventEmitter from './EventEmitter.js'

// Same idea as the lesson: a list of sources goes in, 'ready' comes out.
// Added: Draco, HDR, sound files, a 'progress' event for the loading screen.
export default class Resources extends EventEmitter
{
    constructor(sources)
    {
        super()

        // Options
        this.sources = sources

        // Setup
        this.items = {}
        this.toLoad = this.sources.length
        this.loaded = 0

        this.setLoaders()
        this.startLoading()
    }

    setLoaders()
    {
        this.loaders = {}
        this.loaders.textureLoader = new THREE.TextureLoader()
        this.loaders.hdrLoader = new HDRLoader()
        this.loaders.audioLoader = new THREE.AudioLoader()
        this.loaders.gltfLoader = new GLTFLoader()

        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        this.loaders.gltfLoader.setDRACOLoader(dracoLoader)
    }

    startLoading()
    {
        // Nothing to load: still fire 'ready', but after the World had a chance to subscribe
        if(this.toLoad === 0)
        {
            window.setTimeout(() => this.trigger('ready'), 0)
            return
        }

        for(const source of this.sources)
        {
            const done = (file) => this.sourceLoaded(source, file)
            const failed = (error) => this.sourceFailed(source, error)

            if(source.type === 'gltfModel')
                this.loaders.gltfLoader.load(source.path, done, undefined, failed)

            else if(source.type === 'texture')
                this.loaders.textureLoader.load(source.path, done, undefined, failed)

            else if(source.type === 'hdr')
                this.loaders.hdrLoader.load(source.path, done, undefined, failed)

            else if(source.type === 'audio')
                this.loaders.audioLoader.load(source.path, done, undefined, failed)
        }
    }

    sourceLoaded(source, file)
    {
        if(source.srgb)
            file.colorSpace = THREE.SRGBColorSpace

        this.items[source.name] = file
        this.loaded++

        this.trigger('progress', [this.loaded / this.toLoad, source.name])

        if(this.loaded === this.toLoad)
        {
            this.trigger('ready')
        }
    }

    // A missing sound should not stop the game. Anything else should say so loudly.
    sourceFailed(source, error)
    {
        console.error(`Could not load ${source.name} from ${source.path}`, error)
        this.trigger('error', [source])

        if(source.type === 'audio')
            this.sourceLoaded(source, null)
    }
}
