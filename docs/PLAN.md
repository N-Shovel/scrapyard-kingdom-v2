# Scrapyard Kingdom rebuild: plan

**Goal:** rebuild Scrapyard Kingdom from scratch so it looks and moves like a game someone made by hand, using what the ITE-18 Three.js lessons teach.

**Source of truth for rules:** the old game at `../Tower Defense game dev` (README lists every mechanic). Its grid, flow-field and wave logic was sound, so it gets ported, not reinvented.

## What changes from the old game

| Old | New |
|---|---|
| Colored boxes | Scanned CC0 props from Poly Haven, real PBR textures, rust shader on low-poly models |
| One walk clip, stretched for running | Own Blender clips: idle, walk, jog, sprint, strafes, backpedal, jump, fall, land, slide, aim, fire, reload, hurt, death. Arm bones added to the rig |
| Rifle aimed by twisting the whole body | Upper body layer shoulders the rifle with IK-authored arms |
| Enemies built from boxes, legs swing | Rigged CC0 models with their own clips |
| Everything fits one cell | Footprints: car 1x2, container 1x3, rotate with R |
| Fixed afternoon light | HDRI sky, day falls toward night each round, floodlights come on |
| Particles only | cannon-es debris, casings and scrap, plus Points dust |
| Synth beeps | Recorded CC0 sounds |
| CDN script tags, globals | Vite, modules, Experience class tree |

## Lesson map

| Lesson | Used for |
|---|---|
| 1.5 Cameras, 1.6 Resize | First, third and top-down camera, resizing |
| 1.8 Debug UI | lil-gui panels behind `#debug` |
| 1.9 Textures, 1.10 Materials | PBR sets, repeat wrapping, anisotropy, physical materials |
| 1.11 3D Text | Title sign welded from rusted letters |
| 2.1 Lights, 2.2 Shadows | Sun with a tuned shadow camera, floodlights |
| 2.3 Haunted House | Fog, ground splat, the Stash shack built from textured parts, gate lights |
| 3.1 Particles, 3.2 Galaxy | Dust, smoke and spark Points with BufferGeometry |
| 3.3 Scroll animation | gsap for camera moves and UI |
| 3.4 Physics | Debris, casings and scrap drops, impact sounds by collision strength |
| 3.5 Imported Models | GLTFLoader with Draco, AnimationMixer, crossfades |
| 3.6 Raycaster | Shooting, build cursor, repair target |
| 4.2 Realistic Render | Environment map, tone mapping, sRGB, shadow acne fixes |
| 4.3 Code Structure | Experience singleton, Utils, Resources and sources.js, World tree, destroy() |
| 1.12 Go Live | Vite build with `base: './'` |

## File structure

```
src/index.html, script.js, style/{tokens,base,parts,hud,plan,ticket,menu,shop}.css
src/Experience/Experience.js, Camera.js, Renderer.js, sources.js
src/Experience/Utils/{EventEmitter,Sizes,Time,Debug,Resources,Input}.js
src/Experience/World/{World,Environment,Ground,Junkyard,Fence,Stash,Dust,Floodlights,TitleSign}.js
src/Experience/Materials/Rust.js
src/Experience/Game/{config,Game,Grid,FlowField,Rounds,Inventory,Upgrades}.js
src/Experience/Actors/{Player,PlayerAnimation,Enemy,Enemies}.js
src/Experience/Combat/{Weapons,Structures,Structure,Build,Effects,Debris,Pickups}.js
src/Experience/Audio/Sounds.js
src/Experience/Ui/{Ui,Hud,Gauge,Tally,Shells,Notes,Tags,Menu,Shop,SitePlan,Ticket}.js
tools/{fetch-assets,optimize-assets,playtest}.mjs, tools/blender/*.py
tests/*.test.js
```

## Tasks

Each task ends with a check and a report in `docs/reports/`.

| # | Task | Check |
|---|---|---|
| T01 | Folder setup: plugins, skills, reports, Vite skeleton, Experience tree, playtest harness | Blank scene renders, playtest passes |
| T02 | Asset pipeline: optimize script, static/ filled, CREDITS | Every glb loads in the game |
| T03 | Player rig and clips in Blender | Renders of each clip, clip list in glb |
| T04 | World: sky, ground splat, junk piles, fence, Stash | Screenshots from ground and top |
| T05 | Grid and flow field ported with footprints | `npm test` |
| T06 | Player controller, cameras, layered animation | Playtest walks every direction, no foot slide |
| T07 | Enemies and rounds | Playtest round ends after all die |
| T08 | Structures, traps, build mode | Playtest places and picks up |
| T09 | Weapons, effects, debris, sound | Playtest shoots, kills, drops |
| T10 | HUD, menu, shop, site plan | Screenshots against design notes |
| T11 | Polish and balance, title sign, day to night | Long bot run without errors, 60 fps target |
| T12 | README, build, graph, final review | `npm run build`, preview playtest |

## Design notes: making it not look generated

**Subject:** a scrapyard's own paperwork and paint. Weighbridge tickets, stencilled steel, masking tape with grease pencil, a mechanical tally counter, pressure gauges, a site plan sketched in pencil.

**Color** (`tokens.css`):
- Primer `#4b5144`, the green-grey of painted steel
- Red lead `#8c3b22`, oxide primer
- Hazard `#e2b100`, the one loud accent, used only for what needs attention now
- Manila `#d6c58f`, ticket paper and tape
- Carbon `#22201c`, ink
- Chalk `#ece5d2`, text on steel

**Type:**
- Saira Stencil One: only for big words painted on things. Round number, title.
- Barlow Condensed: everything readable. Sentence case, no tracked-out caps labels.
- Permanent Marker: grease pencil on tape, for messages and hints.
- DotGothic16: only on the printed ticket, because a weighbridge printer is dot matrix.

**Layout:** in-world objects pinned to the screen edges, not panels. Health and Stash are gauges, bottom left. Scrap is a tally counter, top right. Hotbar is a row of hanging parts tags with slight random tilt. Round-end is a ticket that feeds out of the top of the screen. Workshop is a pegboard.

**The one bold thing:** the title screen. No menu panel, only the real yard at dusk with a rusted steel sign on the crane, and "Clock in" stencilled on a plate.

**Banned:** rounded cards, soft shadows, gradients as decoration, glow text, emoji, pills, tracked caps eyebrows, middle-dot strings, arrows on buttons, glass blur, neon.

**World rules:** no flat untextured box anywhere. Piles are messy on purpose. Nothing axis-aligned that would have been dropped by a crane. Ground has stains, tracks, and color variation.

## Decisions for later tasks

Already thought through, so do not re-derive them. Change them only for a reason.

**Grid (T05):** `CELL = 2.2`, `GRID = 36` (about 79 m). `Grid.js` stays free of three.js, so `node --test` can run it. Port `computeFlow`, `nextCell`, `traceRoute`, `flowTo`, `nextCellTo`, `obstaclesBetween`, `resolveCircle` and map generation from the old `js/grid.js`. A structure now owns a list of cells: car 1x2, container 1x3, the rest 1x1, turned with R. `flowTo` starts from all of a structure's cells.

**Balance (T05, T08):** start from the old `js/config.js`, copied into `Game/config.js`. Footprints change these: wreck hp 400 and cost 15, container hp 1400 and cost 45, start with 6 wrecks and 2 containers. Jog 5.6, sprint 8.6, aiming walk 3.

**Enemies (T07, models since T19):** Raider = `mob_humanoid`, an orange blocky robot. Scuttler, which replaces the Mutant = `mob_chicken`, fast, hunts the player. Brute = `mob_hope`, a caged robot on claws, breaks walls. Drone = `mob_drone`. All four are CC-BY from Sketchfab, one draw per material. Use their own clips, crossfade as in lesson 4.3. A model without an attack clip lunges at each blow, one without a death clip freezes and topples.

**Rust shader (T04):** `Materials/Rust.js` patches a `MeshStandardMaterial` through `onBeforeCompile`. Triplanar rust color and roughness in object space, offset by `instanceMatrix` for instances, masked by noise. This makes flat Quaternius models sit next to scanned props. Apply it to wrecks, robots, the mech and containers.

**Junk piles (T04):** one `InstancedMesh` per primitive per model. A scrap bale is the main piece, built by script in Blender as a crumpled cube using the rusty metal textures. Stack with tyres, barrels, wrecks and tarped cars. Round change: sink the group with gsap, swap the layout, raise it, with dust.

**Shooting (T09):** no mesh raycasts against instances, they are too slow on this GPU. March the ray through the grid using a height per cell, and use `Ray.intersectBox` or capsules for enemies. `THREE.Raycaster` stays for the build cursor and camera collision.

**Player animation (T06):** see the T03 report. Lower and upper layers are split by bone name. All gait actions stay in phase through one shared phase value. `action.time = phase * duration`, weights from speed and direction. Stride data is in T03.

**First person (T06):** a second copy of the model parented to the camera, showing only `Arms`, `Rifle` and the torch, using only the upper clips. The world copy stays and still casts a shadow: material `colorWrite = false`, `depthWrite = false`.

**Repairs (changed after T09):** no torch. On the prep map the repair tool (8) fixes a placed structure for scrap: `REPAIR_SHARE` of its price times the share of health it lost. The user found the torch awkward.

**Post (T11, settled in T13):** the composer cost about 4.5 ms, so no bloom. Vignette and grain are CSS on `.ui`.

**Ponytail (T11, done in T13):** the hair is skinned to a `pony` bone, `Actors/PlayerHair.js` swings it on a spring.
