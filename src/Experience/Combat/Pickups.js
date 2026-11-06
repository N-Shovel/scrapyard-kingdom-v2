import * as THREE from 'three'
import Experience from '../Experience.js'

const MAGNET = 3.5    // meters: closer than this, scrap slides toward her
const GRAB = 0.9      // meters: this close it is collected
const PULL = 9        // m/s the magnet pulls at

// Scrap a kill drops. It bounces as debris, then she walks near it to collect.
// Whatever is left lying around at the end of a round is collected for her.
export default class Pickups
{
    constructor()
    {
        this.experience = new Experience()
        this.game = this.experience.game
        this.player = this.experience.world.player
        this.list = []
        this.toPlayer = new THREE.Vector3()
    }

    // value is split over a few chunks, so a big kill spills more
    drop(position, value)
    {
        const chunks = Math.min(4, 1 + Math.floor(value / 5))
        for(let n = 0; n < chunks; n++)
        {
            const share = n < chunks - 1 ? Math.floor(value / chunks) : value - Math.floor(value / chunks) * (chunks - 1)
            const angle = Math.random() * Math.PI * 2
            const velocity = new THREE.Vector3(Math.cos(angle) * 2, 3 + Math.random() * 2, Math.sin(angle) * 2)
            const start = position.clone().setY(Math.max(position.y, 0.6))
            this.list.push({ item: this.game.debris.spawn('scrap', start, velocity, { life: 0 }), value: share })
        }
    }

    collect(pickup)
    {
        this.game.addScrap(pickup.value)
        this.game.debris.remove(pickup.item)
        this.list.splice(this.list.indexOf(pickup), 1)
    }

    collectAll()
    {
        for(const pickup of [...this.list])
            this.collect(pickup)
    }

    update()
    {
        if(!this.player.alive)
            return
        for(const pickup of [...this.list])
        {
            const body = pickup.item.body
            this.toPlayer.set(this.player.position.x - body.position.x, this.player.position.y + 0.8 - body.position.y, this.player.position.z - body.position.z)
            const distance = this.toPlayer.length()
            if(distance < GRAB)
            {
                this.experience.sounds.play('metal_clink', { volume: 0.45 })
                this.collect(pickup)
            }
            else if(distance < MAGNET)
            {
                body.wakeUp()
                this.toPlayer.multiplyScalar(PULL / distance)
                body.velocity.set(this.toPlayer.x, this.toPlayer.y, this.toPlayer.z)
            }
        }
    }
}
