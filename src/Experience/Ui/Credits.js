import readCredits from './readCredits.js'
import credits from '../../../CREDITS.md?raw'

// Who made what: CREDITS.md typed on a sheet clipped to a board, opened from the title. The CC-BY models
// ask for credit where people see it, so it is in the game and not only in the repository.
export default class Credits
{
    constructor(root)
    {
        this.element = document.createElement('section')
        this.element.className = 'credits'
        this.element.setAttribute('aria-label', 'Credits')

        const sheet = document.createElement('div')
        sheet.className = 'credits-sheet'
        const title = document.createElement('h2')
        title.className = 'credits-title'
        title.textContent = 'Credits'
        sheet.append(title)

        for(const { heading, rows } of readCredits(credits))
        {
            if(heading)
            {
                const name = document.createElement('h3')
                name.textContent = heading
                sheet.append(name)
            }
            for(const cells of rows)
            {
                const row = document.createElement('p')
                row.className = 'credits-row'
                for(const { text, url } of cells)
                {
                    const cell = document.createElement(url ? 'a' : 'span')
                    cell.textContent = text
                    if(url)
                    {
                        cell.href = url
                        cell.target = '_blank'
                        cell.rel = 'noopener'
                    }
                    row.append(cell)
                }
                sheet.append(row)
            }
        }

        this.back = document.createElement('button')
        this.back.className = 'plate credits-back'
        this.back.type = 'button'
        this.back.textContent = 'Back'
        this.back.addEventListener('click', () => this.close())
        sheet.append(this.back)

        this.element.append(sheet)
        root.append(this.element)

        window.addEventListener('keydown', (event) =>
        {
            if(event.code === 'Escape' && this.element.classList.contains('open'))
                this.close()
        })
    }

    open(from)
    {
        this.from = from
        this.element.classList.add('open')
        this.element.scrollTop = 0
        this.back.focus({ preventScroll: true })
    }

    close()
    {
        this.element.classList.remove('open')
        this.from?.focus({ preventScroll: true })
    }
}
