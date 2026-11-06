import * as THREE from 'three'
import Experience from '../Experience.js'

const POSITIONAL = 24
const FLAT = 6

// Names that stand for several takes, one is picked at random each time
const TAKES =
{
    metal: ['metal_1', 'metal_2', 'metal_3', 'metal_4', 'metal_5', 'metal_6'],
    flesh: ['flesh_1', 'flesh_2', 'flesh_3', 'flesh_4'],
    step: ['step_1', 'step_2']
}

// Recorded sounds through one listener on the camera. Pools of players are reused round robin, so a burst
// of shots never builds up hundreds of audio nodes.
//   play('shot_1'), play('metal', { position, volume: 0.4 }), play('reload_shell', { offset: 0.65, duration: 1 })
export default class Sounds
{
    constructor()
    {
        this.experience = new Experience()
        this.resources = this.experience.resources

        this.listener = new THREE.AudioListener()
        this.listener.setMasterVolume(0.8)
        this.experience.camera.instance.add(this.listener)

        this.group = new THREE.Group()
        this.experience.scene.add(this.group)
        this.positional = Array.from({ length: POSITIONAL }, () =>
        {
            const audio = new THREE.PositionalAudio(this.listener)
            audio.setRefDistance(4)
            audio.setRolloffFactor(1.4)
            this.group.add(audio)
            return audio
        })
        this.flat = Array.from({ length: FLAT }, () => new THREE.Audio(this.listener))
        this.next = { positional: 0, flat: 0 }

        this.setUnlock()
    }

    // Browsers keep audio off until the page gets a click or a key
    setUnlock()
    {
        const resume = () =>
        {
            if(this.listener.context.state !== 'running')
                this.listener.context.resume()
        }
        window.addEventListener('pointerdown', resume)
        window.addEventListener('keydown', resume)
    }

    play(name, { position = null, volume = 1, rate = 1, offset = 0, duration } = {})
    {
        const takes = TAKES[name]
        const buffer = this.resources.items[takes ? takes[Math.floor(Math.random() * takes.length)] : name]
        // A sound that failed to load is null, the game goes on without it
        if(!buffer)
            return null

        const pool = position ? 'positional' : 'flat'
        const list = this[pool]
        const audio = list[this.next[pool]++ % list.length]
        if(audio.isPlaying)
            audio.stop()

        audio.setBuffer(buffer)
        audio.offset = offset
        audio.duration = duration
        audio.setVolume(volume)
        // A little pitch spread, so repeats do not sound like a loop
        audio.setPlaybackRate(rate * (0.94 + Math.random() * 0.12))
        if(position)
        {
            audio.position.copy(position)
            audio.updateMatrixWorld()
        }
        audio.play()
        return audio
    }
}
