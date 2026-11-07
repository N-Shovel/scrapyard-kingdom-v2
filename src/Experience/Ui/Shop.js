import Experience from '../Experience.js'
import config from '../Game/config.js'

const TILTS = [-2, 1.4, -0.6, 2.4, -1.6, 0.8, -2.8, 1.8, -1]
const { heal, medkit } = config.CONSUMABLES

// The workshop: a pegboard of parts tags. An upgrade's levels are holes punched in its tag.
// A click buys. Ui opens and closes it, the game waits meanwhile.
export default class Shop
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.game = this.experience.game
        this.player = this.experience.world.player

        const items = [
            ...config.UPGRADES.map(({ id, name, desc, cost }) => ({ id, name, desc, levels: cost.length })),
            { id: 'heal', name: heal.name, desc: heal.desc, levels: 0 },
            { id: 'medkit', name: medkit.name, desc: medkit.desc, levels: medkit.max }
        ]
        this.element = document.createElement('section')
        this.element.className = 'shop'
        this.element.setAttribute('aria-label', 'Workshop')
        this.element.innerHTML = `
            <div class="pegboard">
                <h2 class="pegboard-name paint">Workshop</h2>
                <button class="plate pegboard-back" type="button">Back to work</button>
                <div class="pegboard-tags">
                    ${items.map(({ id, name, desc, levels }, n) => `
                        <button class="part" type="button" data-id="${id}" style="--tilt: ${TILTS[n]}deg">
                            <span class="part-name">${name}</span>
                            <span class="part-desc">${desc}</span>
                            <span class="part-holes">${'<i></i>'.repeat(levels)}</span>
                            <span class="part-price"></span>
                        </button>`).join('')}
                </div>
                <p class="pegboard-note"></p>
            </div>`
        this.ui.root.append(this.element)

        this.parts = [...this.element.querySelectorAll('.part')].map((element) => ({
            element,
            id: element.dataset.id,
            holes: [...element.querySelectorAll('.part-holes i')],
            price: element.querySelector('.part-price')
        }))
        this.note = this.element.querySelector('.pegboard-note')
        this.element.querySelector('.pegboard-back').addEventListener('click', () => this.ui.closeShop())
        for(const part of this.parts)
            part.element.addEventListener('click', () => this.buy(part))
    }

    // Price of the next one and why it cannot be had, for Patch up from her health
    offer(id)
    {
        if(id === 'heal')
        {
            const missing = this.player.maxHp - this.player.hp
            return { price: missing > 0 ? Math.ceil(missing * heal.costPerHp) : null, done: 'Full health' }
        }
        return { price: this.game.upgrades.price(id), done: id === 'medkit' ? 'Bag full' : 'Top level' }
    }

    buy(part)
    {
        const { id } = part
        const upgrades = this.game.upgrades
        let bought = false
        if(id === 'heal')
        {
            const { price } = this.offer(id)
            bought = price !== null && this.game.spend(price)
            if(bought)
                this.player.hp = this.player.maxHp
        }
        else
        {
            bought = upgrades.buy(id)
            // The new plating comes with its share of health
            if(bought && id === 'hp')
                this.player.heal(config.UPGRADES.find((upgrade) => upgrade.id === 'hp').step)
        }

        if(!bought)
            return
        this.experience.sounds.play('metal_clink', { volume: 0.6 })
        part.element.animate([{ rotate: '5deg' }, { rotate: '-3deg' }, { rotate: '0deg' }], { duration: 500, easing: 'ease-out' })
        this.update()
    }

    open()
    {
        this.update()
        this.element.querySelector('.part').focus({ preventScroll: true })
    }

    close()
    {
        document.activeElement?.blur()
    }

    update()
    {
        if(this.ui.state !== 'shop')
            return
        const { scrap, upgrades } = this.game
        for(const part of this.parts)
        {
            const { price, done } = this.offer(part.id)
            const punched = part.id === 'medkit' ? upgrades.medkits : upgrades.levels[part.id] ?? 0
            part.holes.forEach((hole, n) => hole.classList.toggle('punched', n < punched))
            const text = price === null ? done : `${price} scrap`
            if(part.price.textContent !== text)
                part.price.textContent = text
            part.element.classList.toggle('maxed', price === null)
            part.element.classList.toggle('short', price !== null && scrap < price)
            part.element.disabled = price === null
        }
        const text = `You have ${scrap} scrap. Health ${Math.ceil(this.player.hp)} of ${this.player.maxHp}.`
        if(this.note.textContent !== text)
            this.note.textContent = text
    }
}
