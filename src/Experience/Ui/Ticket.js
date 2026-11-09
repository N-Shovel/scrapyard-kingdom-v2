import gsap from 'gsap'
import Experience from '../Experience.js'
import config from '../Game/config.js'

const STAY = 9          // seconds a round ticket hangs before it is torn off
const FEED_STEPS = 16   // a dot matrix printer feeds in jerks
const RECORD = 'scrapyard-kingdom-record'   // the most rounds cleared in this browser

const pad = (value) => String(value).padStart(2, '0')

// The weighbridge ticket that feeds out of the top of the screen: one when a round is cleared, a last one
// when the yard is lost. Scrap is weighed like a truck: gross (now), tare (when the round began), net.
export default class Ticket
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.game = this.experience.game
        this.number = 0
        this.current = null
    }

    // Rows of [label, value], or a string for a line of its own, '-' for a rule
    print(rows, stamp, stay)
    {
        this.tearOff()
        const now = new Date()
        const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(2)}`
        const head = [
            'Scrapyard Kingdom weighbridge',
            ['Ticket', String(++this.number).padStart(4, '0')],
            [date, `${pad(now.getHours())}:${pad(now.getMinutes())}`],
            '-'
        ]
        const line = (row) =>
        {
            if(row === '-')
                return '<hr>'
            if(typeof row === 'string')
                return `<p>${row}</p>`
            return `<p class="ticket-row"><span>${row[0]}</span><span>${row[1]}</span></p>`
        }

        const element = document.createElement('div')
        element.className = 'ticket'
        element.setAttribute('role', 'status')
        element.innerHTML = `
            <div class="ticket-paper">
                ${[...head, ...rows].map(line).join('')}
                <p class="ticket-stamp paint">${stamp}</p>
            </div>`
        this.ui.root.append(element)
        this.current = element

        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        gsap.fromTo(element, { yPercent: -100 }, { yPercent: 0, duration: still ? 0 : 1.8, ease: `steps(${FEED_STEPS})` })
        if(!stay)
        {
            element.addEventListener('click', () => this.tearOff())
            this.timer = window.setTimeout(() => this.tearOff(), STAY * 1000)
        }
    }

    // Torn off and pulled away up the screen
    tearOff()
    {
        window.clearTimeout(this.timer)
        const element = this.current
        if(!element)
            return
        this.current = null
        gsap.to(element, { yPercent: -110, rotate: -4, duration: 0.45, ease: 'power2.in', onComplete: () => element.remove() })
    }

    roundCleared(round, bonus, before)
    {
        const game = this.game
        const earned = game.earned - before.earned
        const spent = before.scrap + earned - game.scrap
        const net = game.scrap - before.scrap
        this.print([
            `Round ${round} cleared`,
            ['Kills', game.kills - before.kills],
            ['Picked up', earned - bonus],
            ['Round bonus', bonus],
            ...(spent > 0 ? [['Spent', spent]] : []),
            ['Stash', `${Math.round(game.stashHp / config.STASH_HP * 100)}%`],
            '-',
            ['Gross', game.scrap],
            ['Tare', before.scrap],
            ['Net', `${net >= 0 ? '+' : ''}${net}`],
            '-',
            'Everything placed is back in stock'
        ], 'Cleared', false)
    }

    // The record before this run. Storage can be blocked (private window), then every run starts at 0.
    record(cleared)
    {
        try
        {
            const before = Number(window.localStorage.getItem(RECORD)) || 0
            if(cleared > before)
                window.localStorage.setItem(RECORD, cleared)
            return before
        }
        catch
        {
            return 0
        }
    }

    yardLost()
    {
        const game = this.game
        const rounds = game.rounds
        const cleared = Math.max(0, rounds.round - 1)
        const before = this.record(cleared)
        this.print([
            `The Stash fell in round ${rounds.round}`,
            ['Rounds cleared', cleared],
            ['Kills', game.kills],
            ['Scrap earned', game.earned],
            '-',
            cleared > before ? `New yard record, the last was ${before}` : ['Yard record', before],
            'Yard closed'
        ], 'Lost', true)
    }
}
