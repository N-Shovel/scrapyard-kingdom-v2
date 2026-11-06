import * as THREE from 'three'
import Experience from '../Experience.js'
import config from '../Game/config.js'

// Where the sun sits in sky.hdr, measured from its brightest pixels. In the file it is only 2.4 degrees
// up, which would put the whole yard in shadow, so the light stays in that direction but rides higher.
const SUN_DIRECTION = new THREE.Vector3(0.811, 0, 0.586)
const SUN_ELEVATION = THREE.MathUtils.degToRad(21)
const SHADOW_REACH = 46

// How far the light has fallen: 0 is the HDRI's afternoon, 1 is night. The site plan is drawn by day,
// each fight falls toward night over config.NIGHTFALL seconds, and the day comes back with the new yard.
const DAY = { sun: 2.7, sky: 0.95, background: 0.72, sunColor: new THREE.Color('#ffb878'), fog: new THREE.Color('#8a8275') }
const NIGHT = { sun: 0.55, sky: 0.24, background: 0.08, sunColor: new THREE.Color('#7187b8'), fog: new THREE.Color('#1a1e27') }
const TITLE_DUSK = 0.45
const damp = (rate, delta) => 1 - Math.exp(-rate * delta)

export default class Environment
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.debug = this.experience.debug

        // The game opens on the title
        this.dusk = TITLE_DUSK
        this.shown = -1
        this.setSky()
        this.setSun()
        this.setFog()
        this.setDebug()
    }

    setSky()
    {
        const sky = this.resources.items.sky
        sky.mapping = THREE.EquirectangularReflectionMapping

        this.scene.background = sky
        this.scene.environment = sky
        this.scene.environmentIntensity = 0.95
        this.scene.backgroundIntensity = 0.72
    }

    setSun()
    {
        this.sun = new THREE.DirectionalLight('#ffb878', 2.7)
        this.sun.castShadow = true
        this.sun.shadow.mapSize.set(2048, 2048)
        this.sun.shadow.bias = -0.0006
        this.sun.shadow.normalBias = 0.05

        const camera = this.sun.shadow.camera
        camera.left = -SHADOW_REACH
        camera.right = SHADOW_REACH
        camera.top = SHADOW_REACH
        camera.bottom = -SHADOW_REACH
        camera.near = 1
        camera.far = 240

        this.sun.position.copy(SUN_DIRECTION).multiplyScalar(Math.cos(SUN_ELEVATION))
        this.sun.position.y = Math.sin(SUN_ELEVATION)
        this.sun.position.multiplyScalar(120)

        this.scene.add(this.sun)
        this.scene.add(this.sun.target)
    }

    setFog()
    {
        this.scene.fog = new THREE.Fog('#8a8275', 50, 300)
    }

    // Where the light should be: dusk behind the title, by day on the site plan, falling through a fight
    target()
    {
        const rounds = this.experience.game.rounds
        if(this.experience.ui.state === 'title')
            return TITLE_DUSK
        if(rounds?.phase === 'combat')
            return Math.min(1, rounds.elapsed / config.NIGHTFALL)
        return 0
    }

    setDusk(dusk)
    {
        this.dusk = dusk
        const lerp = THREE.MathUtils.lerp
        this.sun.intensity = lerp(DAY.sun, NIGHT.sun, dusk)
        this.sun.color.lerpColors(DAY.sunColor, NIGHT.sunColor, dusk)
        this.scene.environmentIntensity = lerp(DAY.sky, NIGHT.sky, dusk)
        this.scene.backgroundIntensity = lerp(DAY.background, NIGHT.background, dusk)
        // The playtest's clip sheets clear the fog
        this.scene.fog?.color.lerpColors(DAY.fog, NIGHT.fog, dusk)
    }

    // Slow both ways: night creeps in, and the morning takes a few seconds after a round
    update(delta)
    {
        const dusk = this.dusk + (this.target() - this.dusk) * damp(0.9, delta)
        if(Math.abs(dusk - this.shown) < 0.001)
            return
        this.shown = dusk
        this.setDusk(dusk)
    }

    setDebug()
    {
        if(!this.debug.active)
            return

        const folder = this.debug.ui.addFolder('environment').close()
        folder.add(this.sun, 'intensity').min(0).max(8).step(0.01).name('sun')
        folder.add(this.scene, 'environmentIntensity').min(0).max(3).step(0.01).name('sky light')
        folder.addColor(this.scene.fog, 'color').name('fog')
        folder.add(this.scene.fog, 'near').min(0).max(200).step(1).name('fog near')
        folder.add(this.scene.fog, 'far').min(50).max(500).step(1).name('fog far')
    }
}
