import config from './config.js'

const MEDKIT = config.CONSUMABLES.medkit

// Workshop levels and the medkits she carries. Plain data, no three.js, so `npm test` can run it.
// wallet is anything with spend(amount) that says whether it paid, the Game in the real thing.
export default class Upgrades
{
    constructor(wallet)
    {
        this.wallet = wallet
        this.levels = {}
        this.byId = {}
        for(const upgrade of config.UPGRADES)
        {
            this.levels[upgrade.id] = 0
            this.byId[upgrade.id] = upgrade
        }
        this.medkits = 0
    }

    // What the levels bought so far add: 0.4 for two levels of a 0.2 step. Callers turn it into a multiplier.
    bonus(id)
    {
        return this.byId[id].step * this.levels[id]
    }

    // Price of the next level or the next medkit, null when there is no more to buy
    price(id)
    {
        if(id === 'medkit')
            return this.medkits < MEDKIT.max ? MEDKIT.cost : null
        const { cost } = this.byId[id]
        const level = this.levels[id]
        return level < cost.length ? cost[level] : null
    }

    buy(id)
    {
        const price = this.price(id)
        if(price === null || !this.wallet.spend(price))
            return false
        if(id === 'medkit')
            this.medkits++
        else
            this.levels[id]++
        return true
    }

    // One less in the bag, says whether there was one
    useMedkit()
    {
        if(!this.medkits)
            return false
        this.medkits--
        return true
    }
}
