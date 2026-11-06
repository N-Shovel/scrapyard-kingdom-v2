// The shells in the tube, standing in a row. Spent ones are empty outlines, a reload fills them one by one.
export default class Shells
{
    constructor(parent)
    {
        this.element = document.createElement('div')
        this.element.className = 'shells'
        parent.append(this.element)
        this.mag = 0
        this.full = -1
    }

    set(ammo, mag, reloadProgress)
    {
        if(mag !== this.mag)
        {
            this.mag = mag
            this.element.innerHTML = '<span class="shell"></span>'.repeat(mag)
            this.shells = [...this.element.children]
            this.full = -1
        }
        const full = reloadProgress > 0 ? Math.floor(reloadProgress * mag) : ammo
        if(full === this.full)
            return
        this.full = full
        this.shells.forEach((shell, n) => shell.classList.toggle('spent', n >= full))
    }
}
