const LIFE = 3.2
const MOST = 3
const TILTS = [-2.4, 1.6, -0.8, 2.2, -1.5, 0.6]

// Strips of masking tape with grease pencil on them, under the round number. say() with the same key
// rewrites that strip and keeps it up, so a running message (the Stash being hit) never stacks.
export default class Notes
{
    constructor(parent)
    {
        this.element = document.createElement('div')
        this.element.className = 'notes'
        this.element.setAttribute('role', 'status')
        parent.append(this.element)
        this.list = []
        this.count = 0
    }

    say(text, key = text, tone = '')
    {
        let note = this.list.find((candidate) => candidate.key === key)
        if(!note)
        {
            const element = document.createElement('p')
            element.className = `tape note ${tone}`
            element.style.setProperty('--tilt', `${TILTS[this.count++ % TILTS.length]}deg`)
            this.element.append(element)
            note = { key, element, text: '' }
            this.list.push(note)
            if(this.list.length > MOST)
                this.drop(this.list[0])
        }
        if(note.text !== text)
            note.element.textContent = note.text = text
        note.life = LIFE
    }

    // Takes a strip down at once, when what it says stopped being true
    forget(key)
    {
        const note = this.list.find((candidate) => candidate.key === key)
        if(note)
            this.drop(note)
    }

    drop(note)
    {
        note.element.remove()
        this.list.splice(this.list.indexOf(note), 1)
    }

    update(delta)
    {
        for(const note of [...this.list])
        {
            note.life -= delta
            note.element.classList.toggle('fading', note.life < 0.5)
            if(note.life <= 0)
                this.drop(note)
        }
    }
}
