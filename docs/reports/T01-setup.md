# T01: Folder setup and skeleton

**Status:** done
**Check:** `npm run playtest` -> boot scenario passed, WebGL 2 on the real GPU (AMD Radeon integrated, D3D11).

## What exists now
Vite project, Experience class tree copied from ITE-18 Activity 4.3, playtest harness, per-task reports, project skills and plugins.

## Files
- `CLAUDE.md`: session routine, rules, commands. `AGENTS.md`: same for other agents, plus the caveman rule.
- `.claude/settings.json`: plugins enabled for this folder.
- `.claude/skills/{task-report,playtest,assets}/SKILL.md`: project skills.
- `docs/PLAN.md`: task list, lesson map, design notes.
- `vite.config.js`: lesson layout, `root: src`, `publicDir: static`, `base: './'`.
- `src/Experience/Experience.js`: singleton, owns everything, `update()` order is world, camera, renderer, input.endFrame.
- `src/Experience/Utils/*`: Sizes, Time, Debug, Input, Resources, EventEmitter.
- `tools/playtest.mjs`, `tools/scenarios.mjs`: Chrome driver and its scenarios.

## Interfaces other code uses
- `new Experience()` anywhere returns the singleton. `window.experience` too.
- `experience.time.seconds`: delta in seconds, capped at 50 ms. `time.delta`, `time.elapsed` in ms, as in the lesson.
- `experience.input`: `down(code)`, `justPressed(code)`, `mouse.{dx,dy,ndcX,ndcY,wheel,left,right,leftPressed,rightPressed,rightClick}`, `lock(el)`, `unlock()`, `locked`, `lockListeners[]`. Since T10 a mousedown off the canvas is ignored.
- `resources.on('ready' | 'progress' | 'error')`, `resources.items[name]`. Source types: `gltfModel`, `texture`, `hdr`, `audio`.
- Scenario tools: `{ page, shot(name), step(seconds), ready(), assert(cond, msg) }`. Since T10 `ready()` also clocks in past the title. `step` runs the game fast with fixed 33 ms ticks and no rendering.

## Decisions and why
- Time keeps the lesson's ms fields and adds a capped `seconds` getter, so gameplay never sees a huge delta after a tab switch.
- Playtest uses the installed Chrome through `playwright-core`, no browser download, and gets the real GPU.

## Gotchas
- three 0.187 removed `PCFSoftShadowMap`, `outputEncoding` and `physicallyCorrectLights` that the lessons use. `PCFShadowMap` is already soft.
- `HDRLoader` replaces `RGBELoader`.
- The dev machine is an integrated GPU. Treat it as the performance target.
- The caveman init script is downloaded code and the permission system blocked running it, so the rule was written into `AGENTS.md` by hand. Only that file, not the Cursor, Windsurf or Cline copies.

## Not done
No git repo. The user commits when they want to.
