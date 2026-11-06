import Experience from '../Experience.js'
import config from '../Game/config.js'
import Gauge from './Gauge.js'
import Tally from './Tally.js'
import Shells from './Shells.js'
import Notes from './Notes.js'

// What is pinned to the screen's edges during play: the round painted top left with notes taped under it,
// the scrap counter top right, two gauges bottom left, the shells bottom right, the crosshair.
// CSS shows the fight-only parts from #ui's data-view.
export default class Hud
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.game = this.experience.game
        this.player = this.experience.world.player

        this.element = document.createElement('div')
        this.element.className = 'hud'
        this.element.innerHTML = `
            <div class="hud-round">
                <p class="hud-round-number paint"></p>
                <p class="hud-left"></p>
            </div>
            <div class="hud-gauges"><p class="hud-medkits"></p></div>
            <div class="crosshair" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <div class="hit-frame" aria-hidden="true"></div>`
        this.ui.root.append(this.element)

        this.roundNumber = this.element.querySelector('.hud-round-number')
        this.left = this.element.querySelector('.hud-left')
        this.medkits = this.element.querySelector('.hud-medkits')
        this.hitFrame = this.element.querySelector('.hit-frame')
        const gauges = this.element.querySelector('.hud-gauges')
        this.her = new Gauge(gauges, 'You', 'her')
        this.stash = new Gauge(gauges, 'Stash', 'stash')
        gauges.append(this.medkits)
        this.notes = new Notes(this.element.querySelector('.hud-round'))
        this.tally = new Tally(this.element)
        this.shells = new Shells(this.element)

        this.text = {}
        this.flags = {}
        this.lastHp = this.player.hp
        this.lastStash = this.game.stashHp
    }

    // Writes only what changed, the DOM is slower than the numbers
    write(element, key, text)
    {
        if(this.text[key] !== text)
            element.textContent = this.text[key] = text
    }

    flag(name, on)
    {
        if(this.flags[name] !== on)
            this.element.classList.toggle(name, this.flags[name] = on)
    }

    // Things worth a strip of tape
    watch()
    {
        const { game, player, notes } = this
        if(game.stashHp < this.lastStash)
            notes.say('The Stash is under attack', 'stash', 'warn')
        this.lastStash = game.stashHp

        if(player.hp < this.lastHp - 0.5)
            this.hitFrame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' })
        this.lastHp = player.hp

        if(player.patching > 0)
            notes.say(`Medkit going on, ${Math.ceil(player.patching)} s`, 'medkit')

        if(!player.alive)
            notes.say(`You are down. Back in ${Math.ceil(player.respawnTimer)}`, 'down', 'warn')
        if(player.alive && this.ui.view === 'fight' && this.ui.nearStash)
            notes.say('E opens the workshop', 'workshop')
        else
            notes.forget('workshop')
    }

    update(delta)
    {
        const { game, player } = this
        const rounds = game.rounds
        const weapons = game.weapons

        this.tally.set(game.scrap)
        this.her.set(player.hp / player.maxHp, player.hp, delta)
        this.stash.set(game.stashHp / config.STASH_HP, game.stashHp, delta)
        this.shells.set(weapons.ammo, weapons.mag, player.reloadProgress)

        this.write(this.roundNumber, 'round', `Round ${rounds.round}`)
        this.write(this.left, 'left', `${rounds.schedule.length + game.enemies.alive} left`)
        const medkits = game.upgrades.medkits
        this.write(this.medkits, 'medkits', medkits ? `${medkits} medkit${medkits > 1 ? 's' : ''}, press H` : '')

        this.flag('building', game.build.active)
        this.flag('down', !player.alive)
        if(this.ui.state === 'play')
            this.watch()
        this.notes.update(delta)
    }
}
