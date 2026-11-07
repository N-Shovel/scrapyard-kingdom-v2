import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import readCredits from '../src/Experience/Ui/readCredits.js'

test('the credits sheet reads every table row of CREDITS.md, links and escaped pipes included', () =>
{
    const markdown = [
        '# Credits',
        '',
        '| What | Source | License |',
        '|---|---|---|',
        '| Sounds | Someone, [OpenGameArt](https://opengameart.org/x) | CC0 |',
        '',
        '## CC-BY models from Sketchfab',
        '',
        '| Model | Author | License |',
        '|---|---|---|',
        '| [A \\| B](https://sketchfab.com/3d-models/abc) | Them | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |'
    ].join('\r\n')

    const [first, second] = readCredits(markdown)
    assert.equal(first.heading, '')
    assert.equal(first.rows.length, 1, 'the |---| line is not a row, with Windows line ends too')
    assert.deepEqual(first.rows[0].map(({ text }) => text), ['Sounds', 'Someone, OpenGameArt', 'CC0'])
    assert.equal(second.heading, 'CC-BY models from Sketchfab')
    assert.deepEqual(second.rows[0][0], { text: 'A | B', url: 'https://sketchfab.com/3d-models/abc' })
    assert.equal(second.rows[0][2].url, 'http://creativecommons.org/licenses/by/4.0/')
})

test('every CC-BY model in the manifest is on the credits sheet', () =>
{
    const manifest = JSON.parse(fs.readFileSync(new URL('../tools/assets.manifest.json', import.meta.url), 'utf8'))
    const sections = readCredits(fs.readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8'))
    const credited = new Set(sections.flatMap(({ rows }) => rows.map(([model]) => model.url)))
    for(const { url } of manifest.sketchfab)
        assert.ok(credited.has(url), `${url} is credited`)
})
