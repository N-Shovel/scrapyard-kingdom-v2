// Keyboard and mouse state, read once per frame. Pressed and released flags clear in endFrame().
export default class Input
{
    constructor()
    {
        this.keys = new Set()
        this.pressed = new Set()
        this.mouse = {
            x: 0, y: 0,
            dx: 0, dy: 0,
            ndcX: 0, ndcY: 0,
            wheel: 0,
            left: false, right: false,
            leftPressed: false, rightPressed: false,
            rightClick: false
        }
        this.locked = false
        this.lockListeners = []

        this.setKeyboard()
        this.setMouse()
    }

    setKeyboard()
    {
        window.addEventListener('keydown', (event) =>
        {
            if(!event.repeat)
                this.pressed.add(event.code)
            this.keys.add(event.code)

            // Keep the browser from scrolling or leaving the page on game keys
            if(['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(event.code))
                event.preventDefault()
        })

        window.addEventListener('keyup', (event) =>
        {
            this.keys.delete(event.code)
        })

        window.addEventListener('blur', () =>
        {
            this.keys.clear()
            this.mouse.left = false
            this.mouse.right = false
        })
    }

    setMouse()
    {
        const mouse = this.mouse
        let rightStart = 0

        window.addEventListener('mousemove', (event) =>
        {
            mouse.x = event.clientX
            mouse.y = event.clientY
            mouse.ndcX = (event.clientX / window.innerWidth) * 2 - 1
            mouse.ndcY = - (event.clientY / window.innerHeight) * 2 + 1
            mouse.dx += event.movementX
            mouse.dy += event.movementY
        })

        window.addEventListener('mousedown', (event) =>
        {
            // A press on a plate, a tag or a ticket is the page's, not the game's. With the mouse locked
            // every press lands on the canvas.
            if(event.target.tagName !== 'CANVAS')
                return
            if(event.button === 0)
            {
                mouse.left = true
                mouse.leftPressed = true
            }
            if(event.button === 2)
            {
                mouse.right = true
                mouse.rightPressed = true
                rightStart = performance.now()
            }
        })

        window.addEventListener('mouseup', (event) =>
        {
            if(event.button === 0)
                mouse.left = false
            if(event.button === 2)
            {
                mouse.right = false
                // A short press counts as a click. A long one was dragging the map.
                if(performance.now() - rightStart < 220)
                    mouse.rightClick = true
            }
        })

        window.addEventListener('wheel', (event) =>
        {
            mouse.wheel += Math.sign(event.deltaY)
        }, { passive: true })

        window.addEventListener('contextmenu', (event) =>
        {
            event.preventDefault()
        })

        document.addEventListener('pointerlockchange', () =>
        {
            this.locked = !!document.pointerLockElement
            for(const listener of this.lockListeners)
                listener(this.locked)
        })
    }

    down(code)
    {
        return this.keys.has(code)
    }

    justPressed(code)
    {
        return this.pressed.has(code)
    }

    lock(element)
    {
        const request = element.requestPointerLock()

        // Browsers reject a re-lock made too soon after Esc. The pause screen handles the retry.
        if(request && request.catch)
            request.catch(() => {})
    }

    unlock()
    {
        if(document.pointerLockElement)
            document.exitPointerLock()
    }

    endFrame()
    {
        this.pressed.clear()
        const mouse = this.mouse
        mouse.dx = 0
        mouse.dy = 0
        mouse.wheel = 0
        mouse.leftPressed = false
        mouse.rightPressed = false
        mouse.rightClick = false
    }
}
