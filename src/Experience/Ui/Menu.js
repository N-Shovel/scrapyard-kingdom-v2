import Experience from '../Experience.js'
import Credits from './Credits.js'

// Title: just inside the North gate, looking up through it at the sign on the crane, the mountains behind.
// The drift stays between the gate's posts, so a post never passes across the sign.
const VIEW = { back: 17, height: 3.2, sway: 2, speed: 0.05, below: 1.4, fov: 46 }

const KEYS =
{
    fight:
    [
        ['WASD', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['C', 'Slide while running'],
        ['Left button', 'Fire'], ['Right button', 'Aim'], ['R', 'Reload'], ['V', 'First or third person'],
        ['B or Tab', 'Build where you look'], ['H', 'Medkit'], ['E', 'Workshop, at the Stash'], ['Esc', 'Pause']
    ],
    plan:
    [
        ['WASD, right drag', 'Move the map'], ['Wheel', 'Zoom'], ['1 to 7', 'Pick what to place'],
        ['R', 'Turn it'], ['Left button', 'Place, hold to drag a row'], ['Right button', 'Pick up'],
        ['8', 'Repair tool'], ['U', 'Workshop'], ['G', 'Start the round']
    ]
}

// Title, pause and the end of the game. The buttons are plates of painted steel.
export default class Menu
{
    constructor()
    {
        this.experience = new Experience()
        this.ui = this.experience.ui
        this.angle = 0

        this.setTitle()
        this.setPause()
        this.setAim()
        this.setOver()
        // Nothing but the title moves the camera now
        this.experience.camera.setMode('free')
    }

    setTitle()
    {
        this.title = document.createElement('section')
        this.title.className = 'title'
        this.title.innerHTML = `
            <h1 class="title-name">Scrapyard Kingdom</h1>
            <p class="tape title-pitch">Plan the maze from above, then fight in it</p>
            <div class="title-plates">
                <button class="plate plate-go" type="button" data-do="in">Clock in</button>
                <button class="plate title-credits" type="button" data-do="credits">Credits</button>
            </div>`
        const button = this.title.querySelector('[data-do="in"]')
        button.addEventListener('click', () => this.ui.clockIn())
        this.ui.root.append(this.title)
        this.credits = new Credits(this.ui.root)
        const credits = this.title.querySelector('[data-do="credits"]')
        credits.addEventListener('click', () => this.credits.open(credits))
        button.focus({ preventScroll: true })
    }

    setPause()
    {
        const rows = (list) => list.map(([key, action]) => `<dt>${key}</dt><dd>${action}</dd>`).join('')
        this.pause = document.createElement('section')
        this.pause.className = 'pause'
        this.pause.innerHTML = `
            <div class="pause-plates">
                <h2 class="pause-title paint"></h2>
                <button class="plate plate-go" type="button" data-do="resume"></button>
                <button class="plate" type="button" data-do="out">Clock out</button>
            </div>
            <div class="keysheet">
                <div>
                    <h3>In the fight</h3>
                    <dl>${rows(KEYS.fight)}</dl>
                </div>
                <div>
                    <h3>On the site plan</h3>
                    <dl>${rows(KEYS.plan)}</dl>
                </div>
            </div>`
        this.pauseTitle = this.pause.querySelector('.pause-title')
        this.resume = this.pause.querySelector('[data-do="resume"]')
        this.resume.addEventListener('click', () => this.ui.resume())
        // A fresh page is a fresh yard: nothing else holds state worth keeping
        this.pause.querySelector('[data-do="out"]').addEventListener('click', () => window.location.reload())
        this.ui.root.append(this.pause)
    }

    // After the workshop: the whole screen is the button, so the click that takes the mouse lands on no target
    setAim()
    {
        this.aim = document.createElement('button')
        this.aim.className = 'aim'
        this.aim.type = 'button'
        this.aim.innerHTML = '<span class="plate plate-go">Take aim</span><span class="tape aim-note">Click anywhere, Esc for the menu</span>'
        this.aim.addEventListener('click', () => this.ui.takeAim())
        this.ui.root.append(this.aim)
    }

    showAim()
    {
        this.aim.focus({ preventScroll: true })
    }

    setOver()
    {
        this.over = document.createElement('section')
        this.over.className = 'over'
        this.over.innerHTML = '<button class="plate plate-go" type="button">Clock in again</button>'
        this.over.querySelector('button').addEventListener('click', () => window.location.reload())
        this.ui.root.append(this.over)
    }

    // round > 0: a round began and the game is waiting for the mouse
    showPause(round)
    {
        this.pauseTitle.textContent = round ? `Round ${round}` : 'Paused'
        this.resume.textContent = round ? 'Take aim' : 'Back to work'
        this.resume.focus({ preventScroll: true })
    }

    // The name is the sign on the crane while the title is up. Clocking in flies the camera down to the map from here.
    update(delta)
    {
        if(this.ui.state !== 'title')
            return
        const camera = this.experience.camera
        this.angle += delta * VIEW.speed
        const world = this.experience.world
        const sign = world.titleSign.middle
        const gate = world.grid.gates.find((candidate) => candidate.name === 'North').center
        camera.instance.position.set(gate.x + Math.sin(this.angle) * VIEW.sway, VIEW.height, sign.z + VIEW.back)
        camera.instance.lookAt(sign.x, sign.y - VIEW.below, sign.z)
        camera.setFov(VIEW.fov)
    }
}
