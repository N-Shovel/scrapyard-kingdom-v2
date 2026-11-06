import * as THREE from 'three'
import Debug from './Utils/Debug.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Input from './Utils/Input.js'
import Resources from './Utils/Resources.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import Game from './Game/Game.js'
import Sounds from './Audio/Sounds.js'
import Ui from './Ui/Ui.js'
import sources from './sources.js'

let instance = null

export default class Experience
{
    constructor(canvas)
    {
        // Singleton
        if(instance)
        {
            return instance
        }
        instance = this

        // Global access
        window.experience = this

        // Options
        this.canvas = canvas

        // Setup
        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()
        this.input = new Input()
        this.scene = new THREE.Scene()
        this.resources = new Resources(sources)
        this.camera = new Camera()
        this.sounds = new Sounds()
        this.renderer = new Renderer()
        this.world = new World()
        this.game = new Game()
        // After the game, so its ready handler runs after the game's
        this.ui = new Ui()

        // Resize event
        this.sizes.on('resize', () =>
        {
            this.resize()
        })

        // Time tick event
        this.time.on('tick', () =>
        {
            this.update()
        })
    }

    resize()
    {
        this.camera.resize()
        this.renderer.resize()
        this.game.effects?.resize()
    }

    // The title keeps the yard alive behind it, pause, shop and the last ticket hold everything still
    update()
    {
        const state = this.ui.state
        if(state === 'title' || state === 'play')
            this.world.update()
        if(state === 'play')
            this.game.update()
        this.ui.update()
        this.camera.update()
        this.renderer.update()
        this.input.endFrame()
    }
}
