// Drives the real game in Chrome and fails on any console error.
//   npm run playtest                 every scenario
//   npm run playtest -- boot world   only those scenarios
// Screenshots go to tools/.playtest/. Scenarios live in tools/scenarios.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import scenarios from './scenarios.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.join(here, '.playtest')
fs.mkdirSync(shots, { recursive: true })

const wanted = process.argv.slice(2)
const list = Object.keys(scenarios).filter((name) => !wanted.length || wanted.includes(name))

const server = await createServer({
    configFile: path.join(here, '..', 'vite.config.js'),
    root: path.join(here, '..', 'src'),
    publicDir: path.join(here, '..', 'static'),
    server: { open: false, port: 5199, strictPort: false },
    logLevel: 'error'
})
await server.listen()
const url = server.resolvedUrls.local[0]

const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required']
})

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

const problems = []
page.on('console', (message) =>
{
    if(message.type() === 'error')
        problems.push(`console: ${message.text()}`)
    if(message.type() === 'warning' && !/GPU stall|GL Driver Message|Unrecognized feature/.test(message.text()))
        console.log('  warn:', message.text().slice(0, 200))
})
page.on('pageerror', (error) => problems.push(`exception: ${error.message}\n${error.stack ?? ''}`.slice(0, 900)))
page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`))

const tools =
{
    page,
    shot: async (name) =>
    {
        await page.screenshot({ path: path.join(shots, `${name}.png`) })
        console.log('  shot:', `tools/.playtest/${name}.png`)
    },
    // Runs the game forward fast: fixed 33 ms steps, without waiting for the real clock.
    step: (seconds) => page.evaluate((seconds) =>
    {
        const experience = window.experience
        const steps = Math.round(seconds / 0.033)
        experience.time.delta = 33
        for(let i = 0; i < steps; i++)
        {
            experience.time.elapsed += 33
            experience.world.update()
            experience.game.update()
            experience.camera.update()
            experience.input.endFrame()
        }
    }, seconds),
    // Loaded, then past the title. Headless Chrome never locks the mouse, so a missing lock must not pause the fight.
    ready: async () =>
    {
        await page.waitForFunction(() => window.experience?.ui?.state === 'title', null, { timeout: 120000 })
        await page.evaluate(() =>
        {
            const { ui } = window.experience
            ui.pauseOnUnlock = false
            ui.clockIn()
        })
    },
    assert: (condition, message) =>
    {
        if(!condition)
            throw new Error(`Assertion failed: ${message}`)
        console.log('  ok:', message)
    }
}

let failed = false

for(const name of list)
{
    console.log(`scenario: ${name}`)
    const before = problems.length
    const started = Date.now()

    try
    {
        // Fresh page per scenario, so one scenario's leftovers cannot pass or fail the next
        await page.goto(url)
        await scenarios[name](tools)
    }
    catch(error)
    {
        problems.push(`scenario ${name}: ${error.message}`)
    }

    for(const problem of problems.slice(before))
        console.log('  PROBLEM:', problem)
    if(problems.length > before)
        failed = true
    console.log(`  ${problems.length > before ? 'FAILED' : 'passed'} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

await browser.close()
await server.close()

console.log(failed ? `\nFAILED with ${problems.length} problem(s)` : '\nAll scenarios passed')
process.exit(failed ? 1 : 0)
