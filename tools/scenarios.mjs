// One function per thing worth checking in the running game. See playtest.mjs for the tools.

// A row of copies of the player, one clip pair at evenly spaced moments, seen from the side.
const clipSheet = (page, { lower, upper, angle = Math.PI / 2, copies = 8 }) => page.evaluate(async ({ lower, upper, angle, copies }) =>
{
    const THREE = await import('/@id/three')
    const { clone } = await import('/@id/three/examples/jsm/utils/SkeletonUtils.js')
    const { scene, resources, camera } = window.experience

    if(!window.sheet)
    {
        window.experience.camera.setMode('free')
        scene.clear()
        scene.fog = null
        window.sheet = new THREE.Group()
        scene.add(window.sheet)
        scene.background = new THREE.Color('#596058')
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), new THREE.MeshStandardMaterial({ color: '#2f2e2a' }))
        ground.rotation.x = -Math.PI / 2
        scene.add(ground)
    }
    window.sheet.clear()

    const source = resources.items.player
    const clips = source.animations
    const pick = (name) => clips.find((clip) => clip.name === name)
    const duration = pick(lower ?? upper).duration
    const spacing = 1.15
    const lowest = []

    for(let i = 0; i < copies; i++)
    {
        const copy = clone(source.scene)
        const mixer = new THREE.AnimationMixer(copy)
        for(const name of [lower, upper])
            if(name)
                mixer.clipAction(pick(name)).play()
        mixer.update(duration * i / copies)

        copy.position.set((i - (copies - 1) / 2) * spacing, 0, 0)
        copy.rotation.y = angle
        copy.updateMatrixWorld(true)
        window.sheet.add(copy)

        lowest.push(+new THREE.Box3().setFromObject(copy, true).min.y.toFixed(3))
    }

    camera.instance.fov = 14
    camera.instance.near = 1
    camera.instance.position.set(0, 1.6, 18 * copies * spacing / 9.2)
    camera.instance.lookAt(0, 0.85, 0)
    camera.instance.updateProjectionMatrix()
    return lowest
}, { lower, upper, angle, copies })

const clipPairs = [
    ['idle', 'up_ready'], ['walk_f', 'up_aim'], ['walk_b', 'up_aim'], ['walk_l', 'up_aim'], ['walk_r', 'up_aim'],
    ['run_f', 'up_ready'], ['run_b', 'up_ready'], ['run_l', 'up_ready'], ['run_r', 'up_ready'], ['sprint', 'up_carry'],
    ['jump', 'up_ready'], ['fall', 'up_ready'], ['land', 'up_ready'], ['slide', 'up_ready'],
    ['idle', 'up_reload'], ['idle', 'up_torch'], ['death', null]
]

// Holds keys for a while at fixed 33 ms steps, with collisions off so nothing stops the run.
// Records each foot while it is planted: a planted foot that moves over the ground is foot slide.
// Leaves the player frozen in its last pose so a screenshot can follow. thaw() undoes that.
const hold = (page, { keys = [], aim = false, press = [], seconds = 2, warmup = 1 }) => page.evaluate(({ keys, aim, press, seconds, warmup }) =>
{
    const { world, input, camera } = window.experience
    const player = world.player
    player.grid = { resolveCircle() {} }
    input.keys.clear()
    for(const key of keys)
        input.keys.add(key)
    input.mouse.right = aim

    const feet = ['footL', 'footR'].map((name) => player.model.getObjectByName(name))
    const track = feet.map(() => [])
    const warm = Math.round(warmup / 0.033)
    const frames = warm + Math.round(seconds / 0.033)

    for(let frame = 0; frame < frames; frame++)
    {
        if(frame === warm)
            for(const key of press)
                input.pressed.add(key)
        window.experience.time.delta = 33
        world.update()
        camera.update()
        input.endFrame()

        if(frame >= warm)
        {
            player.model.updateMatrixWorld(true)
            feet.forEach((foot, index) => track[index].push(foot.getWorldPosition(player.position.clone())))
        }
    }

    // Planted: within 4 mm of that foot's lowest point in this run
    const slides = []
    const swings = []
    for(const points of track)
    {
        const lowest = Math.min(...points.map((point) => point.y))
        for(let i = 1; i < points.length; i++)
        {
            const speed = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) / 0.033
            if(points[i].y < lowest + 0.004 && points[i - 1].y < lowest + 0.004)
                slides.push(speed)
            else
                swings.push(speed)
        }
    }
    slides.sort((a, b) => a - b)

    player.update = () => {}
    return {
        speed: +player.speed.toFixed(2),
        planted: slides.length,
        slide: slides.length ? +(slides.reduce((a, b) => a + b, 0) / slides.length).toFixed(3) : null,
        worst: slides.length ? +slides[slides.length - 1].toFixed(3) : null,
        swing: swings.length ? +(swings.reduce((a, b) => a + b, 0) / swings.length).toFixed(2) : null,
        height: +player.position.y.toFixed(2),
        sliding: player.sliding
    }
}, { keys, aim, press, seconds, warmup })

const thaw = (page) => page.evaluate(() =>
{
    const { world, input } = window.experience
    const player = world.player
    delete player.update
    player.grid = world.grid
    input.keys.clear()
    input.mouse.right = false
    player.spawn()
})

// Frame stepping and mouse helpers inside the page, for the build and weapons scenarios.
//   tick(): one 33 ms frame.  pointAt(i, j): the mouse over a cell.  reachable(i, j): the cursor really reaches it.
//   click(i, j, 'left' | 'right'): press and release there.  aimAt(point): turn her so the view centers on point.
const helpers = (page) => page.evaluate(async () =>
{
    const THREE = await import('/@id/three')
    const { world, camera, input } = window.experience
    window.pointAt = (i, j) =>
    {
        const { x, z } = world.grid.cellToWorld(i, j)
        camera.instance.updateMatrixWorld()
        const ndc = new THREE.Vector3(x, 0, z).project(camera.instance)
        input.mouse.ndcX = ndc.x
        input.mouse.ndcY = ndc.y
    }
    window.tick = () =>
    {
        window.experience.time.delta = 33
        world.update()
        window.experience.game.update()
        camera.update()
        input.endFrame()
    }
    window.reachable = (i, j) =>
    {
        window.pointAt(i, j)
        const cell = window.experience.game.build.aim()
        return !!cell && cell.i === i && cell.j === j
    }
    window.click = (i, j, button = 'left') =>
    {
        window.pointAt(i, j)
        if(button === 'left')
        {
            input.mouse.left = true
            input.mouse.leftPressed = true
        }
        if(button === 'right')
            input.mouse.rightClick = true
        window.tick()
        input.mouse.left = false
        window.tick()
        const structure = world.grid.structures[world.grid.index(i, j)]
        return structure ? structure.type : null
    }
    // Over the shoulder the view is not where she faces, so this settles in a few rounds
    window.aimAt = (point) =>
    {
        const player = world.player
        const position = new THREE.Vector3()
        for(let round = 0; round < 6; round++)
        {
            camera.update()
            camera.instance.getWorldPosition(position)
            const direction = point.clone().sub(position).normalize()
            player.yaw = player.bodyYaw = Math.atan2(direction.x, direction.z)
            player.pitch = Math.asin(direction.y)
        }
        camera.update()
    }
})

export default
{
    boot: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        const info = await page.evaluate(() =>
        {
            const renderer = window.experience.renderer.instance
            const gl = renderer.getContext()
            const debug = gl.getExtension('WEBGL_debug_renderer_info')
            return {
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown',
                webgl2: renderer.capabilities.isWebGL2 !== false
            }
        })
        console.log('  gpu:', info.gpu)
        assert(info.webgl2, 'WebGL 2 is running')
        await shot('boot')
    },

    // T04: the yard from above, from the ground, at the Stash and at a gate.
    world: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        // Stand in the West gate looking in, so no random pile ends up on top of the camera
        const lane = await page.evaluate(() =>
        {
            const { grid } = window.experience.world
            const { i, j } = grid.gates[2].cells[1]
            return grid.cellToWorld(i + 1, j)
        })
        const views = {
            top: [[0, 95, 40], [0, 0, 0]],
            lane: [[lane.x, 1.7, lane.z], [0, 1.2, 0]],
            high: [[lane.x + 2, 11, lane.z + 1], [8, 0, 0]],
            stash: [[5.5, 2, -10], [0, 1.6, 0]],
            gate: [[1.1, 1.7, -24], [1.1, 2.5, -40]]
        }

        for(const [name, [position, target]] of Object.entries(views))
        {
            await page.evaluate(({ position, target }) =>
            {
                const { camera } = window.experience
                camera.setMode('free')
                camera.instance.position.set(...position)
                camera.instance.lookAt(...target)
            }, { position, target })
            await page.waitForTimeout(700)
            await shot(`world_${name}`)
        }

        const info = await page.evaluate(() =>
        {
            const { renderer, world } = window.experience
            const { triangles, calls } = renderer.instance.info.render
            return { triangles, calls, seed: world.seed }
        })
        console.log('  render:', JSON.stringify(info))
        assert(info.calls > 0, 'something was drawn')

        const frame = await page.evaluate(() => new Promise((resolve) =>
        {
            const times = []
            let last = performance.now()
            const tick = (now) =>
            {
                times.push(now - last)
                last = now
                if(times.length < 90)
                    requestAnimationFrame(tick)
                else
                    resolve(times.slice(10).sort((a, b) => a - b))
            }
            requestAnimationFrame(tick)
        }))
        console.log(`  frame time: median ${frame[40].toFixed(1)} ms, worst ${frame[frame.length - 1].toFixed(1)} ms`)
    },

    // T02: every source loaded, and each model laid out on a grid so a broken one shows.
    assets: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        const info = await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { scene, resources, camera, world } = window.experience
            // The real yard would be in the way
            camera.setMode('free')
            scene.clear()

            const missing = resources.sources.filter(({ name, type }) => type !== 'audio' && !resources.items[name]).map(({ name }) => name)
            const silent = resources.sources.filter(({ name, type }) => type === 'audio' && !resources.items[name]).map(({ name }) => name)

            resources.items.sky.mapping = THREE.EquirectangularReflectionMapping
            scene.environment = resources.items.sky
            scene.background = resources.items.sky

            const models = resources.sources.filter(({ type }) => type === 'gltfModel')
            const report = {}
            const columns = 8
            const cell = 7
            models.forEach(({ name }, index) =>
            {
                const gltf = resources.items[name]
                const skinned = []
                gltf.scene.traverse((child) =>
                {
                    if(child.isSkinnedMesh)
                        skinned.push(child.name)
                })

                // Biggest side scaled to fit, sizes in the cell are not comparable on purpose
                const box = new THREE.Box3().setFromObject(gltf.scene, true)
                const size = box.getSize(new THREE.Vector3())
                gltf.scene.scale.setScalar(5 / Math.max(size.x, size.y, size.z))
                gltf.scene.position.set((index % columns) * cell - cell * columns / 2, 0, Math.floor(index / columns) * cell)
                gltf.scene.position.y -= box.min.y * gltf.scene.scale.y
                scene.add(gltf.scene)

                report[name] = { size: size.toArray().map((value) => +value.toFixed(2)), clips: gltf.animations.length, skinned: skinned.length }
            })

            camera.instance.position.set(0, 26, -14)
            camera.instance.lookAt(0, 0, 14)

            return { missing, silent, report, playerClips: resources.items.player.animations.map(({ name }) => name) }
        })

        assert(info.missing.length === 0, `every model and texture loaded, missing: ${info.missing.join(', ') || 'none'}`)
        assert(info.silent.length === 0, `every sound decoded, failed: ${info.silent.join(', ') || 'none'}`)
        assert(info.playerClips.length === 22, `player has 22 clips: ${info.playerClips.join(' ')}`)
        for(const [name, row] of Object.entries(info.report))
            console.log('  ', name.padEnd(24), row.size.join(' x ').padEnd(24), `${row.clips} clips, ${row.skinned} skinned`)

        await page.waitForTimeout(4000)
        await shot('assets')
    },

    // T02: joined robot meshes still deform with their own clips.
    robots: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        const heights = await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { scene, resources, camera } = window.experience

            camera.setMode('free')
            scene.clear()
            scene.fog = null
            scene.background = new THREE.Color('#3a3f3a')

            const heights = {}
            const names = { mob_humanoid: 'RUN', mob_hope: 'Robot_marchM', mob_chicken: 'walk', mob_drone: 'Idle' }
            Object.entries(names).forEach(([name, clip], index) =>
            {
                const gltf = resources.items[name]
                const mixer = new THREE.AnimationMixer(gltf.scene)
                mixer.clipAction(gltf.animations.find((animation) => animation.name === clip)).play()
                mixer.update(0.2)
                gltf.scene.updateMatrixWorld(true)

                const box = new THREE.Box3().setFromObject(gltf.scene, true)
                const size = box.getSize(new THREE.Vector3())
                heights[name] = size.toArray().map((value) => +value.toFixed(2))

                gltf.scene.scale.setScalar(2.4 / size.y)
                gltf.scene.position.set(4.5 - index * 3, -box.min.y * 2.4 / size.y, 0)
                scene.add(gltf.scene)
            })

            camera.instance.position.set(0, 2.2, 7)
            camera.instance.lookAt(0, 1.2, 0)
            return heights
        })

        console.log('  posed sizes:', JSON.stringify(heights))
        assert(heights.mob_humanoid[1] > 0.5, 'the raider has height')
        await page.waitForTimeout(1500)
        await shot('robots')
    },

    // T03: every clip with both layers playing. Soles should stay near the ground line.
    clips: async ({ page, ready, shot, assert }) =>
    {
        await ready()

        // Knees bend forward. Where a leg is bent, the knee sticks out from the hip-to-shin-end line within
        // 60 degrees of forward-and-up, at 16 moments of every leg clip. 1 is straight forward, below 0.5 fails.
        // A wrong IK pole angle in rig.py once bent every knee backwards, a pole too close turned them sideways.
        const knees = await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { clone } = await import('/@id/three/examples/jsm/utils/SkeletonUtils.js')
            const source = window.experience.resources.items.player
            const copy = clone(source.scene)
            copy.position.set(0, 0, 0)
            copy.rotation.set(0, 0, 0)
            const at = (name) => copy.getObjectByName(name).getWorldPosition(new THREE.Vector3())
            const worst = {}
            for(const name of ['idle', 'walk_f', 'walk_b', 'walk_l', 'walk_r', 'run_f', 'run_b', 'run_l', 'run_r', 'sprint', 'jump', 'fall', 'land', 'slide'])
            {
                const mixer = new THREE.AnimationMixer(copy)
                const action = mixer.clipAction(source.animations.find((clip) => clip.name === name)).play()
                worst[name] = 1
                for(let i = 0; i < 16; i++)
                {
                    action.time = action.getClip().duration * i / 16
                    mixer.update(0)
                    copy.updateMatrixWorld(true)
                    for(const side of ['L', 'R'])
                    {
                        const hip = at('thigh' + side)
                        const line = at('ik_tgt' + side).sub(hip)   // where the IK chain ends, past the ankle on the left
                        const knee = at('shin' + side).sub(hip)
                        const out = knee.clone().sub(line.clone().multiplyScalar(knee.dot(line) / line.lengthSq()))
                        if(out.length() < 0.04)
                            continue
                        // Forward while the leg hangs, up while it reaches ahead: the line turned 90 degrees in the side view
                        const forward = new THREE.Vector3(0, line.z, - line.y).normalize()
                        worst[name] = Math.min(worst[name], +out.normalize().dot(forward).toFixed(2))
                    }
                }
                mixer.stopAllAction()
                mixer.uncacheRoot(copy)
            }
            return worst
        })
        console.log('  knee direction, worst per clip:', JSON.stringify(knees))
        assert(Math.min(...Object.values(knees)) > 0.5, 'every bent knee points forward')

        for(const [lower, upper] of clipPairs)
        {
            // Strafes read best from the front, everything else from the side
            const angle = /_[lr]$/.test(lower) ? 0 : Math.PI / 2
            const lowest = await clipSheet(page, { lower, upper, angle })
            console.log('  ', `${lower}+${upper}`.padEnd(20), 'lowest point', lowest.join(' '))
            await page.waitForTimeout(250)
            await shot(`clip_${lower}_${upper}`)
        }
    },

    // T03: sleeves at the shoulder and elbow, from the front, the back and both sides.
    sleeves: async ({ page, ready, shot }) =>
    {
        await ready()
        for(const upper of ['up_aim', 'up_ready'])
        {
            await clipSheet(page, { lower: 'idle', upper, copies: 4 })
            await page.evaluate(() =>
            {
                const { camera } = window.experience
                window.sheet.children.forEach((copy, index) =>
                {
                    copy.rotation.y = [0.5, -0.9, 2.6, 3.9][index]
                    copy.position.x = (index - 1.5) * 0.85
                })
                camera.instance.position.set(0, 1.5, 7.5)
                camera.instance.lookAt(0, 1.2, 0)
            })
            await page.waitForTimeout(250)
            await shot(`sleeves_${upper}`)
        }
    },

    // T06: every direction at every gait with foot slide measured, collisions, the views, look pitch
    player: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        // The game opens on the prep map, where the keys pan the map instead of moving her
        await page.evaluate(() => window.experience.camera.setMode('third'))
        const runs = [
            ['jog forward', ['KeyW']], ['jog back', ['KeyS']], ['jog left', ['KeyA']], ['jog right', ['KeyD']],
            ['jog forward left', ['KeyW', 'KeyA']], ['jog forward right', ['KeyW', 'KeyD']],
            ['jog back left', ['KeyS', 'KeyA']], ['jog back right', ['KeyS', 'KeyD']],
            ['walk forward', ['KeyW'], true], ['walk back', ['KeyS'], true],
            ['walk left', ['KeyA'], true], ['walk right', ['KeyD'], true],
            ['walk forward right', ['KeyW', 'KeyD'], true],
            ['sprint', ['KeyW', 'ShiftLeft']], ['sprint left', ['KeyW', 'KeyA', 'ShiftLeft']]
        ]
        for(const [name, keys, aim] of runs)
        {
            const result = await hold(page, { keys, aim })
            console.log('  ', name.padEnd(20), `body ${result.speed} m/s, planted foot ${result.slide} m/s, worst ${result.worst}, ${result.planted} frames, lifted foot ${result.swing} m/s`)
            assert(result.slide !== null && result.slide < 0.35, `${name}: planted foot moves under 0.35 m/s`)
            await thaw(page)
        }

        // Run into the yard for three seconds with collisions on: she must end up on an open cell
        const blocked = await page.evaluate(() =>
        {
            const { world, input } = window.experience
            const player = world.player
            const grid = world.grid
            input.keys.add('KeyW')
            for(let frame = 0; frame < 90; frame++)
            {
                window.experience.time.delta = 33
                world.update()
                input.endFrame()
            }
            input.keys.clear()
            const { i, j } = grid.worldToCell(player.position.x, player.position.z)
            return { walkable: grid.walkable(i, j), z: +player.position.z.toFixed(2), speed: +player.speed.toFixed(2) }
        })
        assert(blocked.walkable, `running into the yard ends on an open cell, z ${blocked.z}, speed ${blocked.speed}`)
        await thaw(page)

        // A dot marks the screen center, to see where the rifle points
        await page.evaluate(() =>
        {
            const dot = document.createElement('div')
            dot.style.cssText = 'position:fixed;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:#e2b100;z-index:9'
            document.body.appendChild(dot)
        })
        const views = [
            ['third_idle', 'third', { seconds: 0.5 }],
            ['third_jog', 'third', { keys: ['KeyW'], seconds: 0.4 }],
            ['third_strafe', 'third', { keys: ['KeyD'], seconds: 0.4 }],
            ['third_aim', 'third', { aim: true, seconds: 0.5 }],
            ['third_sprint', 'third', { keys: ['KeyW', 'ShiftLeft'], seconds: 0.4 }],
            ['third_jump', 'third', { keys: ['KeyW'], press: ['Space'], seconds: 0.25 }],
            ['third_slide', 'third', { keys: ['KeyW', 'ShiftLeft'], press: ['KeyC'], seconds: 0.35 }],
            ['first_idle', 'first', { seconds: 0.5 }],
            ['first_jog', 'first', { keys: ['KeyW'], seconds: 0.4 }],
            ['first_aim', 'first', { aim: true, seconds: 0.5 }],
            ['first_sprint', 'first', { keys: ['KeyW', 'ShiftLeft'], seconds: 0.4 }]
        ]
        for(const [name, mode, options] of views)
        {
            await page.evaluate((mode) => window.experience.camera.setMode(mode), mode)
            const result = await hold(page, options)
            if(name === 'third_jump')
                assert(result.height > 0.8, `jump is in the air, ${result.height} m`)
            if(name === 'third_slide')
                assert(result.sliding, 'slide is on')
            await page.waitForTimeout(300)
            await shot(`player_${name}`)
            // Fully in the sights, the middle of the optic's window lands on the screen center
            if(name === 'first_aim')
            {
                const off = await page.evaluate(() =>
                {
                    const { world, camera, sizes } = window.experience
                    const { arms, animation } = world.player
                    world.player.zoom = 1
                    arms.update(animation, 0)
                    camera.instance.updateMatrixWorld(true)
                    const point = arms.model.getObjectByName('Rifle').localToWorld(arms.optic.clone()).project(camera.instance)
                    return [point.x * sizes.width / 2, point.y * sizes.height / 2].map((value) => +value.toFixed(1))
                })
                assert(Math.hypot(...off) < 2, `the optic window sits on the screen center, off by ${off.join(', ')} px`)
            }
            await thaw(page)
        }

        // A sprint slide sinks once and stays down. The slide clip used to loop back to its entry frame,
        // popping the hips 15 cm up mid slide.
        const pop = await page.evaluate(() =>
        {
            const { world, input, camera } = window.experience
            const player = world.player
            player.grid = { resolveCircle() {} }
            const hips = player.model.getObjectByName('hips')
            input.keys.add('KeyW')
            input.keys.add('ShiftLeft')
            let last = null
            let worst = 0
            for(let frame = 0; frame < 80; frame++)
            {
                if(frame === 30)
                    input.pressed.add('KeyC')
                window.experience.time.delta = 33
                world.update()
                camera.update()
                input.endFrame()
                player.model.updateMatrixWorld(true)
                const height = hips.getWorldPosition(player.position.clone()).y
                if(player.sliding && last !== null && frame > 36)
                    worst = Math.max(worst, height - last)
                last = height
            }
            return +worst.toFixed(3)
        })
        assert(pop < 0.02, `hips never rise mid slide, worst ${pop} m in one frame`)
        await thaw(page)

        // Looking up and down bends the body. The rifle has to turn exactly with the look.
        const aimError = await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { world, camera, input } = window.experience
            const player = world.player
            camera.setMode('third')
            input.mouse.right = true
            const rifle = player.model.getObjectByName('rifle')
            const turnTo = (pitch) =>
            {
                player.pitch = pitch
                for(let frame = 0; frame < 30; frame++)
                {
                    window.experience.time.delta = 33
                    world.update()
                    input.endFrame()
                }
                const model = player.model.getWorldQuaternion(new THREE.Quaternion()).invert()
                return rifle.getWorldQuaternion(new THREE.Quaternion()).premultiply(model)
            }
            const level = turnTo(0)
            const errors = [-0.6, 0.5, 1].map((pitch) =>
            {
                const turned = turnTo(pitch)
                const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), - pitch).multiply(level)
                return +THREE.MathUtils.radToDeg(turned.angleTo(expected)).toFixed(2)
            })
            input.mouse.right = false
            return errors
        })
        console.log('  rifle off the look at pitch -0.6, 0.5, 1, in degrees:', aimError.join(' '))
        assert(Math.max(...aimError) < 3, 'rifle turns with the look')
    },

    // T07: a round from ready to its end. The first packs reach the Stash, then a stand-in for the player
    // kills whatever is alive every 5 s. Also a lineup of all four types, and their feet measured.
    rounds: async ({ page, ready, step, shot, assert }) =>
    {
        await ready()
        const start = await page.evaluate(() =>
        {
            const { rounds } = window.experience.game
            rounds.ready()
            rounds.ready()
            return { phase: rounds.phase, round: rounds.round, planned: rounds.schedule.length, gates: rounds.activeGates.map((gate) => gate.name) }
        })
        assert(start.phase === 'combat' && start.round === 1, `round 1 started from ${start.gates.join(' and ')}, ${start.planned} enemies planned`)

        await step(20)
        const early = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const grid = world.grid
            const enemies = game.enemies.list
            const closer = enemies.filter((enemy) =>
                grid.distanceToCells(enemy.position.x, enemy.position.z, grid.stashCells) < grid.distanceToCells(enemy.gate.center.x, enemy.gate.center.z, grid.stashCells) - 3)
            const stuck = enemies.filter((enemy) =>
            {
                const { i, j } = grid.worldToCell(enemy.position.x, enemy.position.z)
                return !enemy.def.flying && !grid.walkable(i, j)
            })
            return { count: enemies.length, closer: closer.length, stuck: stuck.length, stash: Math.round(game.stashHp), player: Math.round(world.player.hp) }
        })
        console.log('  after 20 s:', JSON.stringify(early))
        assert(early.closer >= early.count / 2, `most enemies walked toward the Stash: ${early.closer} of ${early.count}`)
        assert(early.stuck === 0, 'no ground enemy stands inside a pile')
        assert(early.stash < 1500, `the first packs hit the Stash, ${early.stash} hp left`)

        // Look at the front pack from behind
        await page.evaluate(() =>
        {
            const { game, camera } = window.experience
            const enemy = game.enemies.list.find((candidate) => !candidate.dying && !candidate.def.flying)
            camera.setMode('free')
            const back = new (enemy.position.constructor)(Math.sin(enemy.yaw), 0, Math.cos(enemy.yaw))
            camera.instance.position.copy(enemy.position).addScaledVector(back, -4.5).setY(2.2)
            camera.instance.lookAt(enemy.position.x, 1.1, enemy.position.z)
        })
        await page.waitForTimeout(400)
        await shot('rounds_pack')

        // A competent player: everything alive dies every 5 s until the round is over
        let killed = 0
        for(let n = 0; n < 9; n++)
        {
            await step(5)
            killed += await page.evaluate(() =>
            {
                const list = window.experience.game.enemies.list.filter((enemy) => !enemy.dying)
                for(const enemy of list)
                    enemy.hit(1e9)
                return list.length
            })
        }
        await step(1)
        const end = await page.evaluate(() =>
        {
            const { game } = window.experience
            return { phase: game.rounds.phase, round: game.rounds.round, left: game.enemies.list.length, kills: game.kills, scrap: game.scrap, over: game.over }
        })
        console.log('  round end:', JSON.stringify(end))
        assert(end.phase === 'prep' && end.round === 1 && end.left === 0, 'round 1 ended once all were dead, prep for round 2')
        assert(end.kills === start.planned && killed === start.planned, `every planned enemy spawned and died: ${end.kills} of ${start.planned}`)
        assert(!end.over, 'the Stash held')

        // Lineup: one of each walking on the spot, to see size, rust and clips
        await page.evaluate(() =>
        {
            const { game, world, camera } = window.experience
            const gate = world.grid.gates[0]
            const scaling = game.rounds.scaling(1)
            const spot = world.player.position
            const types = ['raider', 'scuttler', 'brute', 'drone']
            types.forEach((type, index) =>
            {
                const enemy = game.enemies.spawn(type, gate, scaling)
                enemy.position.set(spot.x - 4.5 + index * 3, enemy.def.flying ? 2.2 : 0, spot.z + 4)
                enemy.yaw = enemy.targetYaw = -0.5
                enemy.think = enemy.thinkAir = () =>
                {
                    enemy.moving = true
                    enemy.setState('walk')
                }
            })
            camera.setMode('free')
            camera.instance.position.set(spot.x + 0.5, 1.9, spot.z + 10)
            camera.instance.lookAt(spot.x, 1.5, spot.z + 4)
        })
        await page.waitForTimeout(600)
        await shot('rounds_lineup')

        // Feet of walking ground enemies: a planted foot that moves over the ground is skating
        const feet = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const list = game.enemies.list
            for(const enemy of list)
                enemy.destroy()
            game.enemies.list = []
            const scaling = game.rounds.scaling(1)
            const gate = world.grid.gates[0]
            const result = {}
            const FEET = { raider: /^FEET(001)?_ROBOT/, scuttler: /^pe[LR]_\d+$/, brute: /^Leg_[A-D]\d+_end/ }
            for(const type of ['raider', 'scuttler', 'brute'])
            {
                const enemy = game.enemies.spawn(type, gate, scaling)
                const start = world.player.position.clone()
                enemy.position.set(start.x, 0, start.z + 2)
                enemy.yaw = enemy.targetYaw = 0
                // Straight ahead at full speed, no pathfinding turns
                enemy.think = (delta) => enemy.act(delta, { x: enemy.position.x, z: enemy.position.z + 10 }, null)
                // Bone names as three.js reads them: dots and spaces in the download's names are dropped
                const bones = []
                enemy.model.traverse((bone) =>
                {
                    if(bone.isBone && FEET[type].test(bone.name))
                        bones.push(bone)
                })
                const tracks = bones.map(() => [])
                for(let frame = 0; frame < 75; frame++)
                {
                    enemy.update(0.033)
                    enemy.model.updateMatrixWorld(true)
                    if(frame > 15)
                        bones.forEach((bone, index) => tracks[index].push(bone.getWorldPosition(start.clone())))
                }
                // drift: average speed along the walk, the part a wrong clip speed causes. wobble: the clip's own.
                const planted = []
                const along = []
                for(const points of tracks)
                {
                    const lowest = Math.min(...points.map((point) => point.y))
                    const tolerance = enemy.def.height * 0.012
                    for(let i = 1; i < points.length; i++)
                        if(points[i].y < lowest + tolerance && points[i - 1].y < lowest + tolerance)
                        {
                            planted.push(Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) / 0.033)
                            along.push((points[i].z - points[i - 1].z) / 0.033)
                        }
                }
                const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length
                result[type] = { body: +enemy.speed.toFixed(2), drift: +mean(along).toFixed(2), wobble: +mean(planted).toFixed(2), frames: planted.length }
                enemy.destroy()
                game.enemies.list = []
            }
            return result
        })
        for(const [type, row] of Object.entries(feet))
        {
            console.log('  ', type.padEnd(9), `body ${row.body} m/s, planted foot drifts ${row.drift} m/s, moves ${row.wobble} m/s over ${row.frames} frames`)
            // The raider's run is a short jog: matched to 3.4 m/s its legs would cycle 8 times a second,
            // so config lets its feet slide about half the speed instead (clipSpeed 13, the clip covers 5.8)
            const slide = type === 'raider' ? 0.6 : 0.1
            assert(Math.abs(row.drift) < row.body * slide, `${type} feet do not skate`)
        }

        // A scuttler catching up while she backs off sat right at its reach and flipped between chasing and
        // swinging every frame, which shook it. A started swing now plays out first.
        const flips = await page.evaluate(() =>
        {
            const { world, game, input, time } = window.experience
            const player = world.player
            player.grid = { resolveCircle() {} }
            player.takeDamage = () => {}
            const enemy = game.enemies.spawn('scuttler', world.grid.gates[0], game.rounds.scaling(1))
            enemy.position.set(player.position.x, 0, player.position.z + 6)
            let current = enemy.current
            let flips = 0
            for(let frame = 0; frame < 150; frame++)
            {
                if(frame === 75)
                    input.keys.add('KeyS')
                time.delta = 16
                world.update()
                game.update()
                input.endFrame()
                if(enemy.current !== current)
                    flips++
                current = enemy.current
            }
            input.keys.clear()
            delete player.takeDamage
            player.grid = world.grid
            enemy.destroy()
            game.enemies.list = game.enemies.list.filter((other) => other !== enemy)
            player.spawn()
            return flips
        })
        assert(flips <= 6, `scuttler changes clip ${flips} times in 150 frames of chasing`)

        // She goes down, loses a fifth of the scrap, gets up again at the spawn
        const before = await page.evaluate(() =>
        {
            const { game, world, camera } = window.experience
            camera.setMode('third')
            const scrap = game.scrap
            world.player.takeDamage(1000)
            return { scrap, alive: world.player.alive, left: game.scrap }
        })
        assert(!before.alive && before.left === before.scrap - Math.floor(before.scrap * 0.2), `down after a big hit, scrap ${before.scrap} to ${before.left}`)
        await step(1.2)
        await page.waitForTimeout(300)
        await shot('rounds_down')
        await step(5.5)
        const after = await page.evaluate(() => ({ alive: window.experience.world.player.alive, hp: window.experience.world.player.hp }))
        assert(after.alive && after.hp === 100, 'back up with full health after the respawn time')

        // Frame time with a full round alive, in third person
        await page.evaluate(() =>
        {
            const { game, camera } = window.experience
            camera.setMode('third')
            game.rounds.ready()
            game.rounds.ready()
        })
        await step(62)
        const frame = await page.evaluate(() => new Promise((resolve) =>
        {
            const times = []
            let last = performance.now()
            const tick = (now) =>
            {
                times.push(now - last)
                last = now
                if(times.length < 90)
                    requestAnimationFrame(tick)
                else
                    resolve({ alive: window.experience.game.enemies.alive, times: times.slice(10).sort((a, b) => a - b) })
            }
            requestAnimationFrame(tick)
        }))
        console.log(`  frame time with ${frame.alive} enemies: median ${frame.times[40].toFixed(1)} ms, worst ${frame.times[frame.times.length - 1].toFixed(1)} ms`)
        await shot('rounds_full')
    },

    // T08: build on the prep map through the real mouse path, pick up, turn, buy, then a fight where
    // the turret and traps do the killing, build mode in third person, and everything coming back.
    build: async ({ page, ready, step, shot, assert }) =>
    {
        await ready()
        const map = await page.evaluate(() => ({ mode: window.experience.camera.mode, phase: window.experience.game.rounds.phase }))
        assert(map.mode === 'top' && map.phase === 'prep', 'the game opens on the prep map')
        await step(1.5)

        await helpers(page)

        // Open cells along the first hot gate's route, away from its gate and the Stash
        const spots = await page.evaluate(() =>
        {
            const { world, game } = window.experience
            const grid = world.grid
            grid.updateRoutes()
            const route = game.rounds.hotGates[0].route
            const open = (i, j) => grid.canPlace([{ i, j }]) && window.reachable(i, j)
            const onRoute = route.slice(4, -4).filter(({ i, j }) => open(i, j))
            // Beside the route: a free neighbour of a route cell that is not on the route itself
            const taken = new Set(route.map(({ i, j }) => grid.index(i, j)))
            const beside = []
            for(const { i, j } of route.slice(3, -3))
                for(const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                    if(open(i + di, j + dj) && !taken.has(grid.index(i + di, j + dj)))
                        beside.push({ i: i + di, j: j + dj })
            return { onRoute, beside, gate: game.rounds.hotGates[0].name }
        })
        assert(spots.onRoute.length >= 5 && spots.beside.length >= 4, `room to build along the ${spots.gate} route`)

        // Place and pick up one turret
        const [free] = spots.beside
        const placed = await page.evaluate(({ i, j }) =>
        {
            const { game } = window.experience
            game.build.selected = 'turret'
            const before = game.inventory.count('turret')
            const type = window.click(i, j)
            const after = game.inventory.count('turret')
            const removed = window.click(i, j, 'right')
            return { type, before, after, removed, back: game.inventory.count('turret') }
        }, free)
        assert(placed.type === 'turret' && placed.after === placed.before - 1, 'a click places a turret from the inventory')
        assert(placed.removed === null && placed.back === placed.before, 'a right click picks it back up')

        // R turns a container across, so it covers i - 1, i, i + 1
        const turned = await page.evaluate(() =>
        {
            const { game, world, input } = window.experience
            const grid = world.grid
            game.build.selected = 'container'
            input.pressed.add('KeyR')
            window.tick()
            // From the middle of the map outward
            const middle = grid.size / 2
            const order = []
            for(let j = 3; j < grid.size - 3; j++)
                for(let i = 3; i < grid.size - 3; i++)
                    order.push({ i, j, far: Math.hypot(i - middle, j - middle) })
            order.sort((a, b) => a.far - b.far)
            for(const { i, j } of order)
                {
                    const cells = grid.footprint('container', i, j, 1)
                    if(!grid.canPlace(cells) || !window.reachable(i, j))
                        continue
                    window.click(i, j)
                    const structure = grid.structures[grid.index(i, j)]
                    const along = cells.every((cell) => grid.structures[grid.index(cell.i, cell.j)] === structure)
                    return { type: structure?.type, along, rows: new Set(structure?.cells.map((cell) => cell.j)).size }
                }
            return null
        })
        assert(turned && turned.type === 'container' && turned.along && turned.rows === 1, 'a turned container lies across three cells of one row')

        // R turns a car a quarter clockwise each press, seen on the map with north up: +j, -i, -j, +i
        const turns = await page.evaluate(() =>
        {
            const { game, world, input } = window.experience
            const grid = world.grid
            const build = game.build
            build.selected = 'wreck'
            build.rotation = 0
            const middle = grid.size / 2
            const room = (i, j) => [0, 1, 2, 3].every((rotation) => grid.canPlace(grid.footprint('wreck', i, j, rotation))) && window.reachable(i, j)
            let anchor = null
            for(let ring = 2; ring < 14 && !anchor; ring++)
                for(let dj = -ring; dj <= ring && !anchor; dj++)
                    for(let di = -ring; di <= ring && !anchor; di++)
                        if(Math.max(Math.abs(di), Math.abs(dj)) === ring && room(middle + di, middle + dj))
                            anchor = { i: middle + di, j: middle + dj }

            const steps = []
            for(let press = 0; press < 4; press++)
            {
                window.pointAt(anchor.i, anchor.j)
                window.tick()
                const [first, second] = build.target.cells
                steps.push([second.i - first.i, second.j - first.j])
                input.pressed.add('KeyR')
                window.tick()
            }
            const back = build.rotation
            return { steps, back, anchor }
        })
        assert(JSON.stringify(turns.steps) === '[[0,1],[-1,0],[0,-1],[1,0]]' && turns.back === 0, `R turns the car clockwise: ${JSON.stringify(turns.steps)}`)

        // The car's model follows its footprint: long along z at 0 and 2 quarter turns, along x at 1 and 3,
        // and centered on its two cells
        const models = await page.evaluate(async ({ anchor }) =>
        {
            const THREE = await import('/@id/three')
            const { game } = window.experience
            const rows = []
            for(let rotation = 0; rotation < 4; rotation++)
            {
                const car = game.structures.place('wreck', anchor.i, anchor.j, rotation, 400)
                car.model.group.scale.y = 1
                car.model.group.updateMatrixWorld(true)
                const box = new THREE.Box3().setFromObject(car.model.group)
                const size = box.getSize(new THREE.Vector3())
                const middle = box.getCenter(new THREE.Vector3())
                rows.push({ rotation, along: size.z > size.x ? 'z' : 'x', off: +Math.hypot(middle.x - car.position.x, middle.z - car.position.z).toFixed(2) })
                game.structures.destroy(car)
            }
            return rows
        }, turns)
        console.log('  car models:', JSON.stringify(models))
        assert(models.map(({ along }) => along).join('') === 'zxzx' && models.every(({ off }) => off < 0.6), 'each turned car lies along its own cells')

        // The fight setup: turrets beside the route, traps and a mine on it, and spikes bought with scrap
        const layout = await page.evaluate(({ onRoute, beside }) =>
        {
            const { game } = window.experience
            const build = game.build
            const grid = window.experience.world.grid
            // The next cell of a list that is still free: lists can repeat a cell, the container may cover one
            const put = (type, list) =>
            {
                const cell = list.find(({ i, j }) => grid.canPlace([{ i, j }]))
                if(!cell)
                    return false
                build.selected = type
                build.rotation = 0
                if(window.click(cell.i, cell.j) === type)
                    return true
                window.pointAt(cell.i, cell.j)
                const aimed = build.aim()
                why.push(`${type} at ${cell.i},${cell.j}: aimed ${aimed?.i},${aimed?.j}, ${build.findTarget()?.problem || 'no problem'}, owned ${game.inventory.count(type)}, scrap ${game.scrap}`)
                return false
            }
            const why = []
            const version = grid.version
            const results = [
                put('turret', beside), put('turret', beside), put('flak', beside),
                put('spikes', onRoute), put('tar', onRoute), put('mine', onRoute), put('spikes', onRoute)
            ]
            const scrap = game.scrap
            const bought = put('spikes', onRoute)
            return { results, bought, why, paid: scrap - game.scrap, changed: window.experience.world.grid.version !== version, count: game.structures.list.length }
        }, spots)
        assert(layout.results.every(Boolean), `turrets, flak and traps placed: ${layout.results.join(' ')} ${layout.why.join('; ')}`)
        assert(layout.paid === 20 || !layout.bought, `out of spikes, the next one costs scrap: paid ${layout.paid}`)
        assert(layout.changed, 'placing changed the flow field')

        // The map with a ghost over the route
        await page.evaluate(({ beside }) =>
        {
            const { game } = window.experience
            game.build.selected = 'wreck'
            window.pointAt(beside[3]?.i ?? beside[0].i, beside[3]?.j ?? beside[0].j)
        }, spots)
        await step(0.2)
        await page.waitForTimeout(400)
        await shot('build_map')

        // Close up of what was built
        await page.evaluate(() =>
        {
            const { game, camera } = window.experience
            const turret = game.structures.list.find((structure) => structure.type === 'turret')
            camera.setMode('free')
            camera.instance.position.set(turret.position.x + 5, 3.2, turret.position.z + 6)
            camera.instance.lookAt(turret.position.x, 0.8, turret.position.z)
        })
        await page.waitForTimeout(500)
        await shot('build_close')

        // The flak's head, close
        await page.evaluate(() =>
        {
            const { game, camera } = window.experience
            const flak = game.structures.list.find((structure) => structure.type === 'flak')
            camera.instance.position.set(flak.position.x + 3, 2.6, flak.position.z + 3.5)
            camera.instance.lookAt(flak.position.x, 1.5, flak.position.z)
        })
        await page.waitForTimeout(500)
        await shot('build_flak')

        // The fight: nobody kills by hand, only what was built
        await page.evaluate(() =>
        {
            const { game, camera } = window.experience
            camera.mode = 'top'
            // Nobody defends the Stash in this test, the other gate's packs would end the game
            game.stashHp = 1e9
            game.rounds.ready()
            game.rounds.ready()
        })
        const fight = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const mode = window.experience.camera.mode
            let slowed = 0
            for(let frame = 0; frame < 1200; frame++)
            {
                window.tick()
                slowed = Math.max(slowed, game.enemies.list.filter((enemy) => enemy.slow > 0 && !enemy.dying).length)
            }
            return {
                mode,
                kills: game.kills,
                mines: game.structures.list.filter((structure) => structure.type === 'mine').length,
                worn: game.structures.list.filter((structure) => structure.hp < structure.maxHp).map((structure) => structure.type),
                slowed,
                player: world.player.alive
            }
        })
        console.log('  after 40 s of fighting:', JSON.stringify(fight))
        assert(fight.mode === 'third', 'the round starts back in third person')
        assert(fight.kills > 0, `the turrets and traps killed ${fight.kills}`)

        // Each trap with a raider held standing on it, so it does not depend on who walks where
        const traps = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const grid = world.grid
            const result = {}
            for(const type of ['spikes', 'tar', 'mine'])
            {
                let cell = null
                for(let j = 4; j < grid.size - 4 && !cell; j++)
                    for(let i = 4; i < grid.size - 4 && !cell; i++)
                        if(grid.canPlace([{ i, j }]))
                            cell = { i, j }
                const trap = game.structures.place(type, cell.i, cell.j, false, 9999)
                const raider = game.enemies.spawn('raider', grid.gates[0], game.rounds.scaling(1))
                const { x, z } = grid.cellToWorld(cell.i, cell.j)
                raider.position.set(x, 0, z)
                raider.think = () => {}
                raider.hp = raider.maxHp = 1e6
                let slowed = false
                for(let frame = 0; frame < 30; frame++)
                {
                    raider.position.set(x, 0, z)
                    window.tick()
                    slowed = slowed || raider.slow > 0
                }
                result[type] = { hurt: raider.hp < raider.maxHp, slowed, worn: trap.hp < 9999, gone: trap.dead }
                raider.destroy()
                game.enemies.list = game.enemies.list.filter((enemy) => enemy !== raider)
                game.structures.destroy(trap)
            }
            return result
        })
        console.log('  traps:', JSON.stringify(traps))
        assert(traps.spikes.hurt && traps.spikes.worn, 'spikes stab and wear out')
        assert(traps.tar.slowed && traps.tar.worn, 'tar slows and wears out')
        assert(traps.mine.hurt && traps.mine.gone, 'a mine goes off once')

        // Build mode in the fight: B, aim at the ground ahead, click
        const fieldBuild = await page.evaluate(() =>
        {
            const { game, world, input } = window.experience
            const player = world.player
            // Build mode stays off while she is down, and 40 s alone in a fight can do that
            if(!player.alive)
                player.respawn()
            player.takeDamage = () => {}
            player.pitch = -0.5
            input.pressed.add('KeyB')
            window.tick()
            const active = game.build.active
            game.build.selected = 'wreck'
            game.build.rotation = 0
            window.tick()
            const target = game.build.target
            input.mouse.left = true
            input.mouse.leftPressed = true
            window.tick()
            input.mouse.left = false
            const placed = target && game.structures.list.some((structure) => structure.type === 'wreck' && structure.cells.some((cell) => cell.i === target.i && cell.j === target.j))
            input.pressed.add('KeyB')
            window.tick()
            delete player.takeDamage
            return { active, problem: target?.problem, placed, off: !game.build.active }
        })
        assert(fieldBuild.active && fieldBuild.off, 'B turns build mode on and off in the fight')
        assert(fieldBuild.placed || fieldBuild.problem, `a wreck placed at the crosshair, or a reason it could not: ${fieldBuild.problem || 'placed'}`)

        // End of the round: everything standing goes back into the inventory
        const back = await page.evaluate(() =>
        {
            const { game } = window.experience
            const standing = game.structures.list.length
            const owned = Object.keys(game.inventory.items).reduce((sum, type) => sum + game.inventory.count(type), 0)
            for(let n = 0; n < 40 && game.rounds.phase === 'combat'; n++)
            {
                for(const enemy of game.enemies.list)
                    enemy.hit(1e9)
                for(let frame = 0; frame < 60; frame++)
                    window.tick()
            }
            return {
                phase: game.rounds.phase,
                left: game.structures.list.length,
                gained: Object.keys(game.inventory.items).reduce((sum, type) => sum + game.inventory.count(type), 0) - owned,
                standing,
                mode: window.experience.camera.mode,
                over: game.over,
                stash: Math.round(game.stashHp)
            }
        })
        console.log('  round end:', JSON.stringify(back))
        // Some may break or wear out in the last waves, the rest must all come back
        assert(back.phase === 'prep' && back.left === 0 && back.gained > 0 && back.gained <= back.standing, `round over, ${back.gained} of ${back.standing} structures back in the inventory`)
        assert(back.mode === 'top', 'back on the prep map')
    },

    // T09: shoot a raider and a scuttler dead, scrap drops and gets collected, reload, build mode holds fire,
    // a held trigger at round end places nothing, repairs cost scrap. Every sound that plays is counted.
    weapons: async ({ page, ready, step, shot, assert }) =>
    {
        await ready()
        await helpers(page)
        await page.evaluate(() =>
        {
            const { game, sounds, world } = window.experience
            // Count sounds by name, they cannot be heard here
            window.played = {}
            const play = sounds.play.bind(sounds)
            sounds.play = (name, options) =>
            {
                window.played[name] = (window.played[name] ?? 0) + 1
                return play(name, options)
            }
            game.rounds.ready()
            game.rounds.ready()
            // Nobody else in the yard: the scheduled packs wait far off. Emptying the schedule would end the round.
            for(const entry of game.rounds.schedule)
                entry.t += 1e6
            world.player.takeDamage = () => {}
            // An enemy that stands still in front of her, think() does nothing
            window.target = (type, distance, side = 0) =>
            {
                const player = world.player
                const forward = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) }
                const enemy = game.enemies.spawn(type, world.grid.gates[0], game.rounds.scaling(1))
                enemy.position.set(player.position.x + forward.x * distance - forward.z * side, enemy.def.flying ? 2 : 0, player.position.z + forward.z * distance + forward.x * side)
                enemy.think = enemy.thinkAir = () => {}
                enemy.yaw = enemy.targetYaw = player.yaw + Math.PI
                return enemy
            }
            // Turns her toward clear ground: no pile within 12 m in front, a little to either side either.
            // If nowhere is clear from here, she moves back to the spawn and looks again.
            window.faceClear = () =>
            {
                const player = world.player
                for(let attempt = 0; attempt < 2; attempt++)
                {
                    for(let turn = 0; turn < 32; turn++)
                    {
                        const yaw = turn * Math.PI / 16
                        let clear = true
                        for(let d = 1; d < 12 && clear; d += 0.5)
                            for(const side of [-0.8, 0, 0.8])
                                clear = clear && world.heightAt(player.position.x + Math.sin(yaw) * d - Math.cos(yaw) * side, player.position.z + Math.cos(yaw) * d + Math.sin(yaw) * side) === 0
                        if(clear)
                        {
                            player.yaw = player.bodyYaw = yaw
                            return true
                        }
                    }
                    player.spawn()
                }
                return false
            }
            window.faceClear()
        })
        await step(0.5)

        // First person, a raider 8 m out: hold the trigger until it drops
        const raider = await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { game, camera, input } = window.experience
            camera.setMode('first')
            const enemy = window.target('raider', 8)
            const ammo = game.weapons.ammo
            let frames = 0
            input.mouse.left = true
            while(!enemy.dying && frames < 150)
            {
                window.aimAt(new THREE.Vector3(enemy.position.x, 1.2, enemy.position.z))
                window.tick()
                frames++
            }
            input.mouse.left = false
            return { dead: enemy.dying, shots: ammo - game.weapons.ammo, frames, drops: game.pickups.list.length }
        })
        assert(raider.dead, `a raider 8 m away dies to ${raider.shots} shots`)

        // First person, one more raider, frozen on the shot's frame
        await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { game, input } = window.experience
            const enemy = window.target('raider', 9, 0.4)
            window.aimAt(new THREE.Vector3(enemy.position.x, 1.3, enemy.position.z))
            game.weapons.cooldown = 0
            input.mouse.left = true
            window.tick()
            input.mouse.left = false
            window.experience.game.update = () => {}
            window.experience.world.update = () => {}
        })
        await page.waitForTimeout(150)
        await shot('weapons_first')
        await page.evaluate(() =>
        {
            delete window.experience.game.update
            delete window.experience.world.update
            for(const enemy of window.experience.game.enemies.list)
                enemy.hit(1e9)
        })
        assert(raider.drops > 0, `it dropped ${raider.drops} pieces of scrap`)

        // Walk over the scrap: it is collected
        const collected = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const scrap = game.scrap
            for(let frame = 0; frame < 60; frame++)
                window.tick()
            // To each piece in turn, the magnet does the last few meters
            for(let trip = 0; trip < 8 && game.pickups.list.length; trip++)
            {
                const piece = game.pickups.list[0]
                world.player.position.set(piece.item.body.position.x, 0, piece.item.body.position.z)
                for(let frame = 0; frame < 30; frame++)
                    window.tick()
            }
            return { gained: game.scrap - scrap, left: game.pickups.list.length }
        })
        assert(collected.gained > 0 && collected.left === 0, `scrap collected: +${collected.gained}`)

        // Third person, a scuttler: shoot it mid shot for the picture
        await page.evaluate(async () =>
        {
            const THREE = await import('/@id/three')
            const { game, camera, input } = window.experience
            camera.setMode('third')
            game.weapons.ammo = 6
            game.weapons.reloading = 0
            window.faceClear()
            const enemy = window.target('scuttler', 7)
            window.aimAt(new THREE.Vector3(enemy.position.x, 0.6, enemy.position.z))
            game.weapons.cooldown = 0
            input.mouse.left = true
            window.tick()
            input.mouse.left = false
            window.shotEnemy = enemy
            // Freeze the frame: the tracers and flash stay where they are
            window.experience.game.update = () => {}
            window.experience.world.update = () => {}
        })
        await page.waitForTimeout(150)
        await shot('weapons_third')
        const scuttler = await page.evaluate(() =>
        {
            delete window.experience.game.update
            delete window.experience.world.update
            return { hurt: window.shotEnemy.hp < window.shotEnemy.maxHp || window.shotEnemy.dying }
        })
        assert(scuttler.hurt, 'the over the shoulder shot hits what the view is centered on')

        // Empty the tube: it reloads by itself, the clip plays, six shells come back
        const reload = await page.evaluate(() =>
        {
            const { game, input } = window.experience
            const weapons = game.weapons
            weapons.ammo = 1
            weapons.cooldown = 0
            input.mouse.left = true
            let frames = 0
            let sawReload = false
            while(frames < 120 && !(sawReload && weapons.reloading === 0))
            {
                window.tick()
                sawReload = sawReload || weapons.reloading > 0
                frames++
            }
            input.mouse.left = false
            return { sawReload, ammo: weapons.ammo, seconds: frames * 0.033 }
        })
        assert(reload.sawReload && reload.ammo >= 5, `empty tube reloads by itself in ${reload.seconds.toFixed(1)} s, ${reload.ammo} shells`)

        // Build mode holds fire
        const held = await page.evaluate(() =>
        {
            const { game, input } = window.experience
            const weapons = game.weapons
            input.pressed.add('KeyB')
            window.tick()
            const ammo = weapons.ammo
            weapons.cooldown = 0
            input.mouse.left = true
            input.mouse.leftPressed = true
            window.tick()
            input.mouse.left = false
            input.pressed.add('KeyB')
            window.tick()
            // The wreck build mode placed, if any, goes again
            for(const structure of [...game.structures.list])
                game.structures.destroy(structure, true)
            return { same: weapons.ammo === ammo }
        })
        assert(held.same, 'no shot while build mode is on')

        // The round ends with the trigger still held: the map flies in and nothing gets placed
        const heldOver = await page.evaluate(() =>
        {
            const { game, input } = window.experience
            const before = game.structures.list.length
            input.mouse.left = true
            game.rounds.schedule = []
            for(const enemy of game.enemies.list)
                enemy.hit(1e9)
            for(let frame = 0; frame < 60; frame++)
                window.tick()
            input.mouse.left = false
            window.tick()
            return { phase: game.rounds.phase, placed: game.structures.list.length - before }
        })
        assert(heldOver.phase === 'prep' && heldOver.placed === 0, `round over with the trigger held, ${heldOver.placed} placed by accident`)

        // Repairs are bought on the map: a wreck at a quarter of its health costs 80% of 15 scrap, times 0.75
        const repaired = await page.evaluate(() =>
        {
            const { game, world } = window.experience
            const grid = world.grid
            const middle = grid.size / 2
            let cell = null
            for(let ring = 2; ring < 14 && !cell; ring++)
                for(let dj = -ring; dj <= ring && !cell; dj++)
                    for(let di = -ring; di <= ring && !cell; di++)
                        if(grid.canPlace(grid.footprint('wreck', middle + di, middle + dj, 0)) && window.reachable(middle + di, middle + dj))
                            cell = { i: middle + di, j: middle + dj }
            const wreck = game.structures.place('wreck', cell.i, cell.j, 0, 100)
            game.build.selected = 'repair'
            game.scrap = 100
            window.click(cell.i, cell.j)
            return { hp: wreck.hp, paid: 100 - game.scrap }
        })
        assert(repaired.hp === 400 && repaired.paid === Math.ceil(15 * 0.8 * 0.75), `repair tool fixed a wreck to ${repaired.hp} hp for ${repaired.paid} scrap`)

        // A mine under a scuttler, for the explosion and the debris
        await page.evaluate(() =>
        {
            const { game, world, camera } = window.experience
            const grid = world.grid
            const player = world.player
            camera.setMode('free')
            // Open ground all around, and toward the camera
            const open = (i, j) =>
            {
                const { x, z } = grid.cellToWorld(i, j)
                return grid.canPlace([{ i, j }]) && world.heightAt(x, z) === 0
            }
            let cell = null
            for(let j = 4; j < grid.size - 8 && !cell; j++)
                for(let i = 4; i < grid.size - 8 && !cell; i++)
                {
                    let clear = true
                    for(let dj = -2; dj <= 4 && clear; dj++)
                        for(let di = -2; di <= 4 && clear; di++)
                            clear = open(i + di, j + dj)
                    if(clear)
                        cell = { i, j }
                }
            game.structures.place('mine', cell.i, cell.j, 0, 1)
            const { x, z } = grid.cellToWorld(cell.i, cell.j)
            const enemy = game.enemies.spawn('scuttler', grid.gates[0], game.rounds.scaling(1))
            enemy.position.set(x, 0, z)
            enemy.think = () => {}
            camera.instance.position.set(x + 6, 3, z + 7)
            camera.instance.lookAt(x, 0.8, z)
            window.blast = { x, z }
        })
        // In real time: fast steps never render, and sparks only live a few tenths of a second
        await page.waitForTimeout(60)
        await shot('weapons_blast')
        await page.waitForTimeout(1500)
        await shot('weapons_debris')

        // A few strides for the footsteps, through whatever is in the way, then a slide
        await page.evaluate(() =>
        {
            const { world, input, camera } = window.experience
            // She only takes the keys in first or third person, and the camera only needs to follow
            camera.mode = 'third'
            world.player.grid = { resolveCircle() {} }
            input.keys.add('KeyW')
            for(let frame = 0; frame < 40; frame++)
            {
                if(frame === 30)
                    input.pressed.add('KeyC')
                window.tick()
            }
            input.keys.delete('KeyW')
            world.player.grid = world.grid
        })

        const heard = await page.evaluate(() => ({ played: window.played, context: window.experience.sounds.listener.context.state }))
        console.log('  sounds played:', JSON.stringify(heard.played), 'audio', heard.context)
        for(const name of ['shot_1', 'reload_shell', 'reload_rack', 'explosion', 'step', 'slide', 'gravel'])
            assert(heard.played[name] > 0, `${name} played`)
        // Every enemy is a robot now: shots on them ring like metal (def.flesh would make them sound like flesh)
        assert(heard.played.metal > 0 && heard.played.metal_bong > 0, 'hits sound like what they hit')
    },

    // T10: title, site plan, workshop, waiting for the mouse, the fight HUD, the round ticket, pause, the end.
    screens: async ({ page, step, shot, assert }) =>
    {
        const state = () => page.evaluate(() => window.experience.ui.state)
        const text = (selector) => page.evaluate((selector) => document.querySelector(selector)?.textContent ?? '', selector)
        await page.waitForFunction(() => window.experience?.ui?.state === 'title', null, { timeout: 120000 })
        await page.waitForTimeout(1200)
        await shot('ui_title')
        assert(await page.isVisible('.title .plate-go'), 'the title shows the Clock in plate')

        // Credits: CREDITS.md on a sheet, every CC-BY model with a link
        await page.click('.title-credits')
        await page.waitForTimeout(300)
        const credits = await page.evaluate(() => ({ open: document.querySelector('.credits').classList.contains('open'), links: document.querySelectorAll('.credits-row a[href*="sketchfab.com"]').length }))
        assert(credits.open && credits.links >= 19, `Credits opens with ${credits.links} Sketchfab models linked`)
        await shot('ui_credits')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        assert(!(await page.evaluate(() => document.querySelector('.credits').classList.contains('open'))), 'Esc closes the credits')

        await page.click('.title .plate-go')
        assert(await state() === 'play', 'Clock in starts play')
        const camera = await page.evaluate(() => window.experience.camera.mode)
        assert(camera === 'top', `the camera flies down to the site plan, mode ${camera}`)
        await page.mouse.move(700, 380)
        await page.waitForTimeout(1600)
        await shot('ui_plan')
        assert((await text('.site-round')) === 'Round 1', 'the title block names round 1')
        assert(await page.isVisible('.tags .tag-repair'), 'the repair tag hangs on the site plan')
        await page.click('.tag[data-type="turret"]')
        assert(await page.evaluate(() => window.experience.game.build.selected) === 'turret', 'a click on a tag picks it')
        const placed = await page.evaluate(() => window.experience.game.structures.list.length)
        assert(placed === 0, 'clicking a tag builds nothing under it')

        // Workshop
        await page.evaluate(() => { window.experience.game.scrap = 500 })
        await page.keyboard.press('KeyU')
        await page.waitForTimeout(100)
        assert(await state() === 'shop', 'U opens the workshop on the site plan')
        await page.click('.part[data-id="dmg"]')
        await page.click('.part[data-id="medkit"]')
        const bought = await page.evaluate(() => ({ scrap: window.experience.game.scrap, dmg: window.experience.game.upgrades.bonus('dmg'), medkits: window.experience.game.upgrades.medkits }))
        assert(bought.dmg === 0.2 && bought.medkits === 1 && bought.scrap === 500 - 60 - 35, `bought Hot loads and a medkit, ${bought.scrap} scrap left`)
        await page.evaluate(() => { window.experience.world.player.hp = 70; window.experience.ui.shop.update() })
        const patch = await text('.part[data-id="heal"] .part-price')
        assert(patch === '12 scrap', `Patch up is priced by missing health, 30 missing costs ${patch}`)
        await page.click('.part[data-id="heal"]')
        const patched = await page.evaluate(() => ({ hp: window.experience.world.player.hp, scrap: window.experience.game.scrap }))
        assert(patched.hp === 100 && patched.scrap === 405 - 12, `Patch up fills her to 100 for 12 scrap, ${patched.scrap} left`)
        await page.waitForTimeout(600)
        await shot('ui_shop')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(100)
        assert(await state() === 'play', 'Esc closes the workshop')

        // The round starts without the mouse: the game waits for a click
        await page.evaluate(() =>
        {
            const { rounds } = window.experience.game
            rounds.ready()
            rounds.ready()
        })
        await page.waitForTimeout(700)
        assert(await state() === 'pause' && (await text('.pause-title')) === 'Round 1', 'a round without the mouse waits under a Round 1 plate')
        await shot('ui_aim')

        // From here the playtest plays without the mouse
        await page.evaluate(() =>
        {
            const { ui, world } = window.experience
            ui.pauseOnUnlock = false
            ui.setState('play')
        })
        await step(9)
        // Nothing hits her until the build mode shot
        await page.evaluate(() =>
        {
            const player = window.experience.world.player
            player.hp = 40
            player.takeDamage = () => {}
        })
        await page.keyboard.press('KeyH')
        await page.waitForTimeout(150)
        const medkit = () => page.evaluate(() => ({ hp: window.experience.world.player.hp, left: window.experience.world.player.patching, medkits: window.experience.game.upgrades.medkits }))
        const early = await medkit()
        assert(early.medkits === 0 && early.left > 4 && early.hp < 50, `H starts the medkit: ${early.left.toFixed(1)} s to go, health ${Math.round(early.hp)}`)
        await step(5.2)
        const late = await medkit()
        // Exactly 50 more: she does not heal by herself
        assert(late.left === 0 && Math.abs(late.hp - 90) < 0.5, `five seconds later it healed 50 and no more, health ${late.hp.toFixed(1)}`)
        await page.evaluate(() =>
        {
            const { game, world } = window.experience
            game.weapons.ammo = 2
            world.player.hp = 22
            game.stashHp = 900
        })
        await page.waitForTimeout(900)
        await shot('ui_fight')
        const hud = await page.evaluate(() => ({
            shells: document.querySelectorAll('.shell').length,
            spent: document.querySelectorAll('.shell.spent').length,
            low: document.querySelector('.gauge-her').classList.contains('low'),
            left: document.querySelector('.hud-left').textContent
        }))
        assert(hud.shells === 6 && hud.spent === 4, `shells show 2 of 6, ${hud.spent} spent`)
        assert(hud.low, 'her gauge reads low at 22 health')
        assert(/^\d+ left$/.test(hud.left), `the round says what is left: ${hud.left}`)

        // Build mode in the fight: the tags come up, the note sits under the crosshair
        await page.evaluate(() => { window.experience.game.build.active = true })
        await page.waitForTimeout(400)
        await shot('ui_build')
        assert(await page.isVisible('.tags') && !(await page.isVisible('.tag-repair')), 'build mode shows the tags, without the repair tool')
        // She can be hit again
        await page.evaluate(() =>
        {
            window.experience.game.build.active = false
            delete window.experience.world.player.takeDamage
        })

        // Clear the round: the ticket feeds out
        await page.evaluate(() =>
        {
            const { game } = window.experience
            game.rounds.schedule = []
            for(const enemy of game.enemies.list)
                if(!enemy.dying)
                    enemy.hit(1e6)
        })
        await step(1)
        await page.waitForTimeout(2200)
        await shot('ui_ticket')
        const ticket = await text('.ticket')
        assert(/Round 1 cleared/i.test(ticket) && /Net/i.test(ticket), 'the round ticket printed')

        // Esc on the site plan pauses, the key sheet is up
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        assert(await state() === 'pause' && (await text('.pause-title')) === 'Paused', 'Esc on the site plan pauses')
        await shot('ui_pause')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        assert(await state() === 'play', 'Esc again goes back')

        // The Stash falls
        await page.evaluate(() =>
        {
            const { game } = window.experience
            game.rounds.ready()
            game.rounds.ready()
        })
        await step(4)
        await page.evaluate(() =>
        {
            const { game } = window.experience
            const enemy = game.enemies.list[0]
            game.stashHp = 1
            game.damageStash(10, enemy)
        })
        await page.waitForTimeout(2400)
        assert(await state() === 'over', 'the game is over once the Stash falls')
        assert(/Yard closed/i.test(await text('.ticket')), 'the last ticket printed')
        await shot('ui_over')
    },

    // T11: the light falls through a fight. Day on the map, night in the yard with the crane's flood on.
    night: async ({ page, ready, shot, assert }) =>
    {
        await ready()
        // Holds the light where the test puts it
        const dusk = (value) => page.evaluate((value) =>
        {
            const environment = window.experience.world.environment
            environment.target = () => value
            environment.setDusk(value)
        }, value)
        const lamps = () => page.evaluate(() => ({ flood: window.experience.world.floodlights.flood.intensity, stash: window.experience.world.stash.lamp.intensity }))

        await dusk(0)
        await page.waitForTimeout(300)
        const day = await lamps()
        assert(day.flood === 0 && day.stash === 0, 'by day the lamps are off')

        await dusk(1)
        await page.evaluate(() => window.experience.camera.setMode('third'))
        await page.waitForTimeout(1500)
        const night = await lamps()
        assert(night.flood > 0 && night.stash > 0, `at night the flood and the Stash lamp are on, ${night.flood} and ${night.stash}`)
        await shot('night_ground')

        // Looking north, at the crane and its flood
        await page.evaluate(() =>
        {
            const { camera, world } = window.experience
            camera.setMode('free')
            camera.instance.position.set(0, 4, 18)
            camera.instance.lookAt(world.floodlights.flood.position)
        })
        await page.waitForTimeout(400)
        await shot('night_crane')

        await page.evaluate(() => window.experience.camera.setMode('top'))
        await page.waitForTimeout(1600)
        await shot('night_map')

        const frame = await page.evaluate(() => new Promise((resolve) =>
        {
            window.experience.camera.setMode('third')
            const times = []
            let last = performance.now()
            const tick = (now) =>
            {
                times.push(now - last)
                last = now
                if(times.length < 90)
                    requestAnimationFrame(tick)
                else
                    resolve(times.slice(10).sort((a, b) => a - b))
            }
            requestAnimationFrame(tick)
        }))
        console.log(`  frame time at night: median ${frame[40].toFixed(1)} ms, worst ${frame[frame.length - 1].toFixed(1)} ms`)
    },

    // T11: six rounds by a simple bot. It places what it owns, buys an upgrade, and in the fight kills what
    // comes close to the Stash or to her every few seconds, as a player would. Watches for errors and frame time.
    long: async ({ page, ready, step, assert }) =>
    {
        await ready()
        const ROUNDS = 6
        const frames = []
        let held = true

        // Work per frame in the fight view: the update and the render, waited out with gl.finish. The rAF
        // interval would only say which 6.06 ms step of the 165 Hz display it landed on.
        const sample = () => page.evaluate(() => new Promise((resolve) =>
        {
            const experience = window.experience
            const gl = experience.renderer.instance.getContext()
            const update = experience.update.bind(experience)
            const times = []
            experience.update = () =>
            {
                const start = performance.now()
                update()
                gl.finish()
                times.push(performance.now() - start)
                if(times.length < 60)
                    return
                experience.update = update
                resolve(times.slice(10).sort((a, b) => a - b)[25])
            }
        }))

        for(let round = 1; round <= ROUNDS; round++)
        {
            const placed = await page.evaluate(() =>
            {
                const { game, world } = window.experience
                const grid = world.grid
                let count = 0
                for(const type of Object.keys(game.inventory.items))
                {
                    for(let tries = 0; tries < 200 && game.inventory.count(type) > 0; tries++)
                    {
                        const i = 3 + Math.floor(Math.random() * (grid.size - 6))
                        const j = 3 + Math.floor(Math.random() * (grid.size - 6))
                        const rotation = Math.floor(Math.random() * 4)
                        if(!grid.canPlace(grid.footprint(type, i, j, rotation)))
                            continue
                        game.structures.place(type, i, j, rotation, game.inventory.take(type))
                        count++
                    }
                }
                const cheapest = ['dmg', 'hp', 'turret', 'rate', 'armor', 'mag', 'speed'].find((id) => game.upgrades.price(id) !== null && game.upgrades.price(id) <= game.scrap)
                if(cheapest)
                    game.upgrades.buy(cheapest)
                game.rounds.ready()
                game.rounds.ready()
                return count
            })

            let seconds = 0
            let phase = 'combat'
            while(phase === 'combat' && seconds < 300)
            {
                await step(3)
                seconds += 3
                const state = await page.evaluate(() =>
                {
                    const { game, world } = window.experience
                    const stash = world.stash.position
                    const player = world.player.position
                    for(const enemy of game.enemies.list)
                        if(!enemy.dying && (enemy.position.distanceTo(stash) < 14 || enemy.position.distanceTo(player) < 10))
                            enemy.hit(1e9)
                    // Keeps the run going: note it, then patch the Stash
                    const fell = game.stashHp < 200
                    if(fell)
                        game.stashHp = 600
                    return { phase: game.rounds.phase, fell }
                })
                phase = state.phase
                held = held && !state.fell
                if(seconds === 15)
                    frames.push(await sample())
            }
            const after = await page.evaluate(() => ({ round: window.experience.game.rounds.round, phase: window.experience.game.rounds.phase, kills: window.experience.game.kills, scrap: window.experience.game.scrap }))
            if(after.phase === 'combat')
                console.log('  left:', JSON.stringify(await page.evaluate(() =>
                {
                    const { game, world } = window.experience
                    return { schedule: game.rounds.schedule.length, alive: game.enemies.list.filter((e) => !e.dying).map((e) => ({ type: e.type, state: e.state, x: +e.position.x.toFixed(1), y: +e.position.y.toFixed(1), z: +e.position.z.toFixed(1), stash: +e.position.distanceTo(world.stash.position).toFixed(1), cell: world.grid.worldToCell(e.position.x, e.position.z), terrain: world.grid.terrain[world.grid.index(world.grid.worldToCell(e.position.x, e.position.z).i, world.grid.worldToCell(e.position.x, e.position.z).j)], moving: e.moving, target: e.target?.type ?? null })) }
                })))
            console.log(`  round ${round}: placed ${placed}, fight ${seconds} s, ${JSON.stringify(after)}`)
            assert(after.round === round && after.phase === 'prep', `round ${round} ended and prep began`)
        }

        frames.sort((a, b) => a - b)
        console.log(`  fight frame work per round, sorted: ${frames.map((value) => value.toFixed(1)).join(', ')} ms`)
        console.log(`  the Stash ${held ? 'held without help' : 'needed patching to keep the run going'}`)
        const median = frames[Math.floor(frames.length / 2)]
        assert(median < 16.7, `median fight frame fits the 60 fps budget, ${median.toFixed(1)} ms of work`)
    }
}
