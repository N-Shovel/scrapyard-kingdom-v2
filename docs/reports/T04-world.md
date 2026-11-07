# T04: World

**Status:** done with gaps. Built after T05, because piles follow the Grid's map.
**Check:** `npm run playtest -- world` -> screenshots from top, lane, high, Stash and gate looked at. 1.8M triangles a frame counting the shadow pass, 146 draw calls, median 6.1 ms in headless Chrome on the integrated GPU.

## What exists now
A dusk scrapyard: HDR sky, one shadowed sun, splatted ground with tire tracks along gate routes, crushed scrap bales, wrecks, tyre stacks and loose props on junk cells, stacked rusty containers around the border, gates with barriers and red lamps, heaps and hazy mountains outside, a corrugated Stash shack, drifting dust.

## Files
- `World/World.js`: builds it all once resources are ready, `newYard(seed)`.
- `World/Environment.js`: sky, sun, fog.
- `World/Ground.js`: splat shader, `paint(seed)` draws the mask on a canvas.
- `World/JunkLibrary.js`: geometry and material of each junk model, which ones get rust.
- `World/JunkBatch.js`: collects placements, builds InstancedMeshes.
- `World/Junkyard.js`: piles on junk cells, `swap(seed, done)` sinks and raises them.
- `World/Fence.js`: border wall, gates, outside heaps, mountains, crane.
- `World/Stash.js`: the shack and the props around it.
- `World/Dust.js`: Points with its own shader.
- `World/createBaleGeometry.js`, `createBaleTexture.js`: the scrap bale.
- `Materials/surface.js`: material from one texture set.
- `Materials/applyRust.js`: triplanar rust over any standard material.

## Interfaces other code uses
- `world.grid`, `world.seed`, `world.junkyard`, `world.fence`, `world.stash`, `world.environment`, `world.ground`, `world.junkLibrary`.
- `world.junkyard.heights[grid.index(i, j)]`: top of the pile on an inner cell, for shot marching and camera.
- `world.heightAt(x, z)`: the same for any point, with structures and the border wall, added in T06. `world.player` too.
- `world.stash.position`, `.width`, `.lamp` (off, intensity 0). `.pump` was removed in T17.
- `world.fence.gateLamps`: red lamp meshes. `world.fence.lamps`: Map gate to its own lamp material, `fence.warn(gates, blink, elapsedMs)` (T07). `world.environment.sun`.
- `batch.place(name, { x, y, z, yaw, pitch, roll, scale, color })` returns the top height. `y` is where the lowest point goes however it is turned, `x, z` where its middle goes.
- `applyRust(material, { amount, scale, texture })` returns the material. Works on skinned meshes too.
- `surface(id, { repeat, ...materialOptions })`.

## Decisions and why
- Bales are made in JS, not Blender as the plan said. A canvas texture cut from the photo textures looks better than a textured cube and needs no pipeline step.
- Sun direction comes from the HDR, but its 2.4 degree elevation is raised to 21, or everything would be in shadow.
- Loose items and everything outside the fence cast no shadow. That saved about a third of the triangles.
- `Grid.placeJunk` went up to 45 clusters on 36x36. 37 looked thin from above.
- Ground macro variation is noise in the shader. Any tiled lookup shows up as a grid in the top view.

## Gotchas
- `rusted_wheel_rim_01` ships a morph target and an InstancedMesh with one throws in `setProgram`. The optimizer strips targets.
- Quaternius cars are white under their rust. They get a dark paint color through the instance color, otherwise they look brand new.
- Flat-shaded hills look fake close up. Keep them far off in fog.

## Since then
- T15 removed the scrap bales, replaced the shack with Quaternius' Structure and the dirt with gravelly sand. See T15.

## Not done
- Stash has no sign yet. It reads as a dark box from a distance, see T11.
- Floodlights and the day to night fall belong to T11.
- Bales repeat three textures. Fine so far.
