import Experience from '../Experience.js'
import config from '../Game/config.js'

// Fixed, so the row looks hung by hand and stays the same every time
const TILTS = [-3, 2.2, -1.2, 3.4, -2.4, 1, -0.6, 2.6]
const NOTE_GAP = 18

// The build row: parts tags hung from a wire, one per thing to place, plus the repair tool on the site plan.
// A note in grease pencil follows the cursor (the crosshair in the fight) and says what a click would do.
export default class Tags
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.game = this.experience.game
        this.input = this.experience.input

        this.element = document.createElement('div')
        this.element.className = 'tags'
        const types = [...config.BUILD_ORDER, 'repair']
        this.element.innerHTML = types.map((type, n) => `
            <button class="tag${type === 'repair' ? ' tag-repair' : ''}" type="button" data-type="${type}" style="--tilt: ${TILTS[n]}deg">
                <span class="tag-key">${n + 1}</span>
                <span class="tag-name">${type === 'repair' ? 'Repair' : config.STRUCTURES[type].name}</span>
                <span class="tag-stock"></span>
            </button>`).join('')
        this.ui.root.append(this.element)

        this.tags = [...this.element.children].map((element) => ({
            element,
            type: element.dataset.type,
            stock: element.querySelector('.tag-stock'),
            text: null,
            state: null
        }))
        this.selected = null
        this.setClicks()

        this.note = document.createElement('p')
        this.note.className = 'cursor-note'
        this.ui.root.append(this.note)
        this.noteText = null
        this.noteTone = null
        this.notePlace = null
    }

    // On the site plan a tag can be clicked. Input ignores presses off the canvas, so nothing is built under it.
    setClicks()
    {
        for(const tag of this.tags)
        {
            tag.element.addEventListener('click', () =>
            {
                this.game.build.selected = tag.type
                tag.element.blur()
            })
        }
    }

    // A tag swings on its string when picked
    swing(element)
    {
        element.animate(
            [{ rotate: '7deg' }, { rotate: '-4deg' }, { rotate: '2deg' }, { rotate: '0deg' }],
            { duration: 650, easing: 'ease-out' }
        )
    }

    updateTags()
    {
        const { build, inventory, scrap } = this.game
        if(build.selected !== this.selected)
        {
            this.selected = build.selected
            for(const tag of this.tags)
            {
                const on = tag.type === this.selected
                tag.element.classList.toggle('on', on)
                if(on && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                    this.swing(tag.element)
            }
        }

        for(const tag of this.tags)
        {
            if(tag.type === 'repair')
                continue
            const count = inventory.count(tag.type)
            const cost = config.STRUCTURES[tag.type].cost
            const text = count ? `${count} in stock` : `${cost} scrap`
            const state = count || scrap >= cost ? '' : 'short'
            if(text !== tag.text)
                tag.stock.textContent = tag.text = text
            if(state !== tag.state)
                tag.element.classList.toggle('short', !!(tag.state = state))
        }
    }

    // What a click would do here, or why it cannot
    noteFor(target)
    {
        const build = this.game.build
        if(!target)
            return ['', '']
        if(build.selected === 'repair')
        {
            if(!target.structure)
                return ['', '']
            return target.problem ? [target.problem, 'warn'] : [`Repair for ${target.cost} scrap`, '']
        }
        if(target.structure)
        {
            const { def, hp, maxHp } = target.structure
            return [`${def.name}, ${Math.ceil(hp)} of ${maxHp}. ${build.prep ? 'Right click' : 'X'} picks it up`, 'pick']
        }
        if(target.problem)
            return [target.problem, 'warn']
        if(!this.game.inventory.count(build.selected))
            return [`Buys one for ${config.STRUCTURES[build.selected].cost} scrap`, '']
        return ['', '']
    }

    updateNote()
    {
        const build = this.game.build
        const [text, tone] = this.ui.state === 'play' && build.on ? this.noteFor(build.target) : ['', '']
        if(text !== this.noteText)
        {
            this.note.textContent = this.noteText = text
            this.note.classList.toggle('shown', !!text)
        }
        if(tone !== this.noteTone)
            this.note.dataset.tone = this.noteTone = tone
        if(!text)
            return

        // Beside the cursor on the map, under the crosshair in the fight
        const { mouse } = this.input
        const x = build.prep ? mouse.x + NOTE_GAP : window.innerWidth / 2
        const y = build.prep ? mouse.y + NOTE_GAP : window.innerHeight / 2 + NOTE_GAP * 2
        const place = `translate(${x}px, ${y}px)${build.prep ? '' : ' translateX(-50%)'}`
        if(place !== this.notePlace)
            this.note.style.transform = this.notePlace = place
    }

    update()
    {
        const build = this.game.build
        this.element.classList.toggle('shown', build.on)
        this.element.classList.toggle('prep', build.prep)
        if(build.on)
            this.updateTags()
        this.updateNote()
    }
}
