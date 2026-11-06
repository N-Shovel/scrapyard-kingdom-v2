import Experience from '../Experience.js'
import config from '../Game/config.js'

const clock = (seconds) =>
{
    const whole = Math.max(0, Math.ceil(seconds))
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// North, West and East
const list = (names) => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]

// The prep map's title block, drawn like the corner of a site drawing: the coming round, its gates,
// the time left and the keys. In the last seconds the count is stencilled big at the top.
export default class SitePlan
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.game = this.experience.game

        this.element = document.createElement('aside')
        this.element.className = 'site-plan'
        this.element.innerHTML = `
            <table>
                <tr><th scope="row">Site plan</th><td class="site-round"></td></tr>
                <tr><th scope="row">Gates</th><td class="site-gates"></td></tr>
                <tr><th scope="row">Starts in</th><td class="site-time"></td></tr>
            </table>
            <p class="site-start">G starts the countdown, G again starts now</p>
            <p class="site-keys">WASD or right drag moves the map, the wheel zooms. R turns, right click picks up, 8 repairs, U opens the workshop.</p>`
        this.ui.root.append(this.element)
        this.round = this.element.querySelector('.site-round')
        this.gates = this.element.querySelector('.site-gates')
        this.time = this.element.querySelector('.site-time')

        this.countdown = document.createElement('p')
        this.countdown.className = 'countdown paint'
        this.countdown.setAttribute('aria-live', 'polite')
        this.ui.root.append(this.countdown)
        this.text = {}
    }

    write(element, key, text)
    {
        if(this.text[key] !== text)
            element.textContent = this.text[key] = text
    }

    update()
    {
        const rounds = this.game.rounds
        if(rounds.phase !== 'prep')
        {
            this.write(this.countdown, 'count', '')
            return
        }
        this.write(this.round, 'round', `Round ${rounds.round + 1}`)
        this.write(this.gates, 'gates', list(rounds.nextGates.map((gate) => gate.name)))
        this.write(this.time, 'time', clock(rounds.timer))
        const close = rounds.timer <= config.COUNTDOWN
        this.time.classList.toggle('close', close)
        this.write(this.countdown, 'count', close ? String(Math.max(1, Math.ceil(rounds.timer))) : '')
    }
}
