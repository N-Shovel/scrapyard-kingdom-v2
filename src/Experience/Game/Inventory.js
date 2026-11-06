import config from './config.js'

// What the player owns but has not placed. Each item keeps its own health, so damaged gear stays damaged.
export default class Inventory
{
    constructor()
    {
        this.items = {}
        for(const type of config.BUILD_ORDER)
            this.items[type] = []
        for(const [type, count] of Object.entries(config.START_INVENTORY))
            for(let n = 0; n < count; n++)
                this.items[type].push(config.STRUCTURES[type].hp)
    }

    count(type)
    {
        return this.items[type].length
    }

    // The healthiest one of this type, or null if there is none
    take(type)
    {
        const list = this.items[type]
        if(!list.length)
            return null
        let best = 0
        for(let n = 1; n < list.length; n++)
            if(list[n] > list[best])
                best = n
        return list.splice(best, 1)[0]
    }

    add(type, hp)
    {
        this.items[type].push(hp)
    }
}
