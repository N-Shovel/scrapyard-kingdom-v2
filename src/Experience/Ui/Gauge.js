// A pressure gauge for a share of something: her health, the Stash's. Built once as SVG, after that only
// the needle's angle, the readout and the low class change. The needle is a spring, so it overshoots a little
// and shakes when the value drops.
const SWEEP = 270
const TICKS = 27
const LOW = 0.25

const angle = (share) => - SWEEP / 2 + SWEEP * share

// Point on a circle of radius r at a dial angle, 0 straight up, clockwise
const at = (degrees, r) =>
{
    const radians = degrees * Math.PI / 180
    return [Math.sin(radians) * r, - Math.cos(radians) * r].map((value) => value.toFixed(2))
}

const dial = () =>
{
    let ticks = ''
    for(let n = 0; n <= TICKS; n++)
    {
        const degrees = angle(n / TICKS)
        const [x1, y1] = at(degrees, 40)
        const [x2, y2] = at(degrees, n % 9 === 0 ? 33 : 36.5)
        ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
    }
    const [lowX, lowY] = at(angle(0), 37)
    const [endX, endY] = at(angle(LOW), 37)
    const [screwA, screwB] = [at(-45, 45.5), at(135, 45.5)]
    return `
        <svg viewBox="-50 -50 100 100" aria-hidden="true">
            <circle class="gauge-bezel" r="49"/>
            <circle class="gauge-screw" cx="${screwA[0]}" cy="${screwA[1]}" r="1.6"/>
            <circle class="gauge-screw" cx="${screwB[0]}" cy="${screwB[1]}" r="1.6"/>
            <circle class="gauge-face" r="43"/>
            <path class="gauge-low" d="M ${lowX} ${lowY} A 37 37 0 0 1 ${endX} ${endY}"/>
            <g class="gauge-ticks">${ticks}</g>
            <rect class="gauge-window" x="-11" y="15" width="22" height="11"/>
            <text class="gauge-readout" x="0" y="23.6">0</text>
            <text class="gauge-label" y="-13"></text>
            <g class="gauge-needle">
                <path d="M -1.6 6 L 0 -38 L 1.6 6 Z"/>
                <circle r="4.5"/>
            </g>
        </svg>`
}

export default class Gauge
{
    constructor(parent, label, modifier)
    {
        this.element = document.createElement('div')
        this.element.className = `gauge gauge-${modifier}`
        this.element.innerHTML = dial()
        this.element.querySelector('.gauge-label').textContent = label
        this.needle = this.element.querySelector('.gauge-needle')
        this.readout = this.element.querySelector('.gauge-readout')
        parent.append(this.element)

        this.shown = 1
        this.velocity = 0
        this.last = 1
        this.number = null
        this.low = false
    }

    set(share, number, delta)
    {
        share = Math.min(1, Math.max(0, share))
        // A knock on the way down
        if(share < this.last - 0.005)
            this.velocity -= 0.6
        this.last = share

        this.velocity += (share - this.shown) * 140 * delta
        this.velocity *= Math.exp(- 11 * delta)
        this.shown += this.velocity * delta
        this.needle.setAttribute('transform', `rotate(${angle(Math.min(1.02, Math.max(-0.02, this.shown))).toFixed(1)})`)

        const rounded = Math.ceil(number)
        if(rounded !== this.number)
            this.readout.textContent = this.number = rounded
        const low = share < LOW
        if(low !== this.low)
            this.element.classList.toggle('low', this.low = low)
    }
}
