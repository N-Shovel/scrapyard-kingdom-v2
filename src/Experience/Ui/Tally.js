const DIGITS = 4
const MAX = 10 ** DIGITS - 1

// A hand tally counter for the scrap. Each digit is a wheel of 0 to 9 that rolls to its place.
export default class Tally
{
    constructor(parent)
    {
        const wheel = '<span class="tally-window"><span class="tally-wheel">' +
            Array.from({ length: 10 }, (_, n) => `<span>${n}</span>`).join('') + '</span></span>'
        this.element = document.createElement('div')
        this.element.className = 'tally'
        this.element.innerHTML = `
            <span class="tally-plunger"></span>
            <span class="tally-body">
                <span class="tally-digits">${wheel.repeat(DIGITS)}</span>
                <span class="tally-label">Scrap</span>
            </span>`
        this.wheels = [...this.element.querySelectorAll('.tally-wheel')]
        this.label = this.element.querySelector('.tally-label')
        parent.append(this.element)
        this.value = null
    }

    set(value)
    {
        value = Math.min(MAX, Math.max(0, Math.floor(value)))
        if(value === this.value)
            return
        this.value = value
        const text = String(value).padStart(DIGITS, '0')
        this.wheels.forEach((wheel, n) =>
        {
            wheel.style.transform = `translateY(${- Number(text[n]) * 10}%)`
        })
        this.element.setAttribute('aria-label', `${value} scrap`)
    }
}
