import EventEmitter from '../Utils/EventEmitter.js'
import config from './config.js'

const TYPES = ['raider', 'scuttler', 'brute', 'drone']

// The round director. Plain data and events, no three.js, so `npm test` can run it.
//   prep:   a timer runs down. ready() (the G key) cuts it to the countdown, a second press starts at once.
//   combat: packs of enemies arrive over the first minute. The round ends once every one of them is dead.
// Events: 'start' (round), 'spawn' ({ type, gate, t }), 'end' (round, bonus).
export default class Rounds extends EventEmitter
{
    constructor(grid, random = Math.random)
    {
        super()
        this.grid = grid
        this.random = random

        this.round = 0
        this.phase = 'prep'
        this.timer = config.PREP_TIME
        this.elapsed = 0
        this.schedule = []
        this.activeGates = []
        this.pickNextGates()
    }

    shuffle(list)
    {
        for(let i = list.length - 1; i > 0; i--)
        {
            const j = Math.floor(this.random() * (i + 1))
            const swap = list[i]
            list[i] = list[j]
            list[j] = swap
        }
        return list
    }

    // The coming round opens one more gate every second round
    pickNextGates()
    {
        const count = Math.min(this.grid.gates.length, 1 + Math.ceil((this.round + 1) / 2))
        this.nextGates = this.shuffle([...this.grid.gates]).slice(0, count)
    }

    // The gates that matter now: the next round's while preparing, this round's in the fight
    get hotGates()
    {
        return this.phase === 'prep' ? this.nextGates : this.activeGates
    }

    composition(round)
    {
        const list = []
        for(const type of TYPES)
        {
            const spawn = config.SPAWN[type]
            if(round < (spawn.from ?? 1))
                continue
            const count = Math.max(0, spawn.base + spawn.perRound * round)
            for(let k = 0; k < count; k++)
                list.push(type)
        }
        return this.shuffle(list)
    }

    // Packs of packMin to packMax from one gate, spread evenly over the spawn window
    buildSchedule(types)
    {
        const { packMin, packMax, firstSpawn, window } = config.SPAWN
        const packs = []
        for(let k = 0; k < types.length;)
        {
            const size = packMin + Math.floor(this.random() * (packMax - packMin + 1))
            packs.push(types.slice(k, k + size))
            k += size
        }

        const schedule = []
        packs.forEach((pack, n) =>
        {
            const start = firstSpawn + (n / packs.length) * window
            const gate = this.activeGates[Math.floor(this.random() * this.activeGates.length)]
            pack.forEach((type, m) => schedule.push({ type, gate, t: start + m * 0.5 }))
        })
        return schedule.sort((a, b) => a.t - b.t)
    }

    // How much tougher enemies are in a round, see config.SCALING
    scaling(round = this.round)
    {
        const { hp, damage, speed, speedMax } = config.SCALING
        const steps = Math.max(1, round) - 1
        return { hp: 1 + hp * steps, damage: 1 + damage * steps, speed: Math.min(speedMax, 1 + speed * steps) }
    }

    ready()
    {
        if(this.phase !== 'prep')
            return
        if(this.timer > config.COUNTDOWN)
            this.timer = config.COUNTDOWN
        else
            this.start()
    }

    start()
    {
        this.round++
        this.phase = 'combat'
        this.elapsed = 0
        this.activeGates = this.nextGates
        for(const gate of this.grid.gates)
            gate.lock = gate.bruteLock = null
        this.schedule = this.buildSchedule(this.composition(this.round))
        this.trigger('start', [this.round])
    }

    end()
    {
        const { base, perRound } = config.ROUND_BONUS
        this.phase = 'prep'
        this.timer = config.PREP_TIME
        this.pickNextGates()
        this.trigger('end', [this.round, base + perRound * this.round])
    }

    // Once a gate's cheapest route has to smash a wall, that gate stays locked on the wall until it falls,
    // even if the maze changes after
    updateLocks()
    {
        this.grid.updateRoutes()
        for(const gate of this.activeGates)
        {
            if(!gate.lock || gate.lock.dead)
                gate.lock = gate.breach || null
            if(!gate.bruteLock || gate.bruteLock.dead)
                gate.bruteLock = gate.bruteBreach || null
        }
    }

    // alive: enemies still standing. Checked before spawning, so a pack that spawns this frame counts.
    update(delta, alive)
    {
        if(this.phase === 'prep')
        {
            this.timer -= delta
            if(this.timer <= 0)
                this.start()
            return
        }

        if(!this.schedule.length && alive === 0)
        {
            this.end()
            return
        }

        this.elapsed += delta
        this.updateLocks()
        while(this.schedule.length && this.schedule[0].t <= this.elapsed)
            this.trigger('spawn', [this.schedule.shift()])
    }
}
