import Experience from '../Experience.js'
import config from '../Game/config.js'
import Menu from './Menu.js'
import Hud from './Hud.js'
import Tags from './Tags.js'
import SitePlan from './SitePlan.js'
import Ticket from './Ticket.js'
import Shop from './Shop.js'

// Grace after asking for the mouse, before a missing lock counts as a pause
const LOCK_GRACE = 400
// A lock lost this soon after the workshop closes was never the player's Esc. It waits for a click, not the menu.
const SHOP_RELOCK = 1500
// Chrome drops a lock taken while Esc is still held, so leaving the workshop with Esc asks once the key is up.
// After this long held, it asks anyway: a key-up lost to another window must not leave her without the mouse.
const ESC_HOLD = 1000

// Everything drawn over the canvas, and which state the game is in:
//   loading, title, play, pause (Esc, or a round that started without the mouse), shop,
//   aim (the workshop closed but the mouse did not come back, one click takes it), over.
// Experience.update reads state: the world moves in title and play, the game only in play.
// #ui carries data-state and data-view (map or fight), so CSS decides what shows.
export default class Ui
{
    constructor()
    {
        this.experience = new Experience()
        this.input = this.experience.input
        this.canvas = this.experience.canvas
        this.root = document.querySelector('#ui')
        this.state = 'loading'
        this.view = ''
        this.aimed = false          // the mouse was taken since the round started
        this.requested = - LOCK_GRACE
        this.shopClosed = - SHOP_RELOCK
        this.aimOnRelease = false
        this.pauseOnUnlock = true   // the playtest turns this off: headless Chrome never locks the mouse

        this.setLoading()
        this.experience.resources.on('ready', () =>
        {
            this.game = this.experience.game
            this.world = this.experience.world
            this.loading.remove()
            this.menu = new Menu()
            this.hud = new Hud()
            this.tags = new Tags()
            this.sitePlan = new SitePlan()
            this.ticket = new Ticket()
            this.shop = new Shop()
            this.setRoundEvents()
            this.setState('title')
        })
    }

    setLoading()
    {
        this.loading = document.createElement('p')
        this.loading.className = 'loading'
        this.loading.textContent = 'Loading the yard'
        this.root.append(this.loading)
        this.experience.resources.on('progress', (share) =>
        {
            this.loading.textContent = `Loading the yard, ${Math.round(share * 100)}%`
        })
    }

    // Before and after each round, for the ticket
    setRoundEvents()
    {
        const game = this.game
        game.rounds.on('start', () =>
        {
            this.aimed = false
            this.before = { kills: game.kills, scrap: game.scrap, earned: game.earned }
        })
        // Game hears 'end' first, so the bonus is already paid and the Stash patched
        game.rounds.on('end', (round, bonus) =>
        {
            this.ticket.roundCleared(round, bonus, this.before)
        })
    }

    setState(state)
    {
        this.state = state
        this.root.dataset.state = state
        // A focused plate would take the next Enter or Space meant for the game
        if(state === 'play')
            document.activeElement?.blur()
    }

    get fightView()
    {
        const mode = this.experience.camera.mode
        return mode === 'first' || mode === 'third'
    }

    get nearStash()
    {
        const { player, grid } = this.world
        return grid.distanceToCells(player.position.x, player.position.z, grid.stashCells) < config.WORKSHOP_REACH
    }

    clockIn()
    {
        this.experience.camera.setMode('top')
        this.setState('play')
    }

    // The fight needs the mouse back, which only a click can ask for. The lock event turns play on.
    takeAim()
    {
        this.requested = performance.now()
        this.input.lock(this.canvas)
    }

    resume()
    {
        if(this.fightView)
            this.takeAim()
        else
            this.setState('play')
    }

    // The fight holds still behind a Take aim plate, a click anywhere takes the mouse
    waitForAim()
    {
        this.setState('aim')
        this.menu.showAim()
    }

    pause()
    {
        // A browser drops the lock on Esc itself, but an Esc that reaches the page with the lock held would resume at once
        this.input.unlock()
        this.setState('pause')
        this.menu.showPause(this.fightView && !this.aimed ? this.game.rounds.round : 0)
    }

    openShop()
    {
        this.input.unlock()
        this.setState('shop')
        this.shop.open()
    }

    closeShop()
    {
        this.shop.close()
        this.setState('play')
        if(!this.fightView)
            return
        this.shopClosed = performance.now()
        if(this.input.down('Escape'))
        {
            this.aimOnRelease = true
            this.requested = performance.now()
        }
        else
            this.takeAim()
    }

    gameOver()
    {
        this.input.unlock()
        this.setState('over')
        this.ticket.yardLost()
    }

    // Only Esc, U and E are read here, the game itself never uses them
    updateState()
    {
        const input = this.input
        const fight = this.fightView
        if(this.input.locked)
            this.aimed = true

        if(this.state === 'play')
        {
            if(this.aimOnRelease && (!input.down('Escape') || performance.now() - this.shopClosed > ESC_HOLD))
            {
                this.aimOnRelease = false
                this.shopClosed = performance.now()
                this.takeAim()
            }
            const unlocked = fight && !input.locked && !this.aimOnRelease && this.pauseOnUnlock && performance.now() - this.requested > LOCK_GRACE
            if(this.game.over)
                this.gameOver()
            else if(unlocked && performance.now() - this.shopClosed < SHOP_RELOCK)
                this.waitForAim()
            else if(input.justPressed('Escape') || unlocked)
                this.pause()
            else if(input.justPressed('KeyU') && !fight)
                this.openShop()
            else if(input.justPressed('KeyE') && fight && this.nearStash && this.world.player.alive)
                this.openShop()
        }
        else if(this.state === 'pause')
        {
            if(fight ? input.locked : input.justPressed('Escape'))
                this.setState('play')
        }
        else if(this.state === 'aim')
        {
            if(input.locked)
                this.setState('play')
            else if(input.justPressed('Escape'))
                this.pause()
        }
        else if(this.state === 'shop')
        {
            if(input.justPressed('Escape') || input.justPressed('KeyU') || input.justPressed('KeyE'))
                this.closeShop()
        }
    }

    update()
    {
        if(!this.game?.ready)
            return

        this.updateState()
        const view = this.fightView ? 'fight' : 'map'
        if(view !== this.view)
            this.view = this.root.dataset.view = view

        const delta = this.experience.time.seconds
        this.menu.update(delta)
        this.hud.update(delta)
        this.tags.update()
        this.sitePlan.update()
        this.shop.update()
    }
}
