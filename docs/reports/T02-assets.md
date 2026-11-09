# T02: Asset pipeline

**Status:** done
**Check:** `npm run playtest -- assets robots` -> 40 models, 42 textures, sky and 24 sounds load with no error. Player has 22 clips. `static/` is 19.7 MB against an 80 MB budget. Looked at `assets.png` and `robots.png`.

## What exists now
`npm run assets:optimize` rebuilds `static/` from `tools/.cache/`. `sources.js` lists what the game reads (since T21 not every texture map), so `resources.items[name]` has it once `ready` fires. Everything is loaded up front.

## Files
- `tools/assets.manifest.json`: every third-party asset. `keep` is the decimation ratio, `size` the texture size (default 512), `strip` lists bones whose triangles are dropped (T07, the mech's frog), `sounds` maps a game name to a cached file.
- `tools/fetch-assets.mjs`: downloads into the cache.
- `tools/optimize-assets.mjs`: cache to `static/`. `npm run assets:optimize -- player swat` rebuilds only those names.
- `src/Experience/sources.js`: what the game loads.
- `CREDITS.md`: license lines.

## Interfaces other code uses
- Models: `resources.items.<name>` is a gltf: `.scene`, `.animations`. Static models are one mesh per material with no node transforms, so their geometry can go straight into an `InstancedMesh`.
- Skinned models clone with `SkeletonUtils.clone`. Robots are one draw call each. Clip names are short (`Run`, not `CharacterArmature|Run`).
- Textures: `<id>_color` (sRGB already set), `<id>_normal`, `<id>_arm`. Wrapping and repeat are not set, the material code does that.
- Sky: `resources.items.sky`, needs `mapping = EquirectangularReflectionMapping`.
- Sounds: `resources.items.shot_1`, `metal_bong`, full list in `sources.js`. A sound that fails to load is `null`, the game goes on.

## Sizes in meters, x by y by z, at file scale
| Model | Size | Model | Size |
|---|---|---|---|
| swat, posed | 0.5 x 1.8 x 0.9 | broken_car | 2.64 x 1.76 x 5.49 |
| mech | 3.4 x 2.9 x 2.2 | car_a | 1.64 x 1.15 x 3.31 |
| robot_large | 1.4 x 0.9 x 0.8 | suv | 2.11 x 1.53 x 4.21 |
| robot_flying | 1.3 x 0.8 x 0.7 | pickup | 2.31 x 1.85 x 5.18 |
| container | 4.36 x 2.13 x 2.09 | truck | 2.71 x 2.88 x 5.26 |
| barrier_trash | 4.49 x 2.51 x 1.31 | covered_car | 1.79 x 1.41 x 4.38 |
| gas_can | 1.88 x 2.47 x 0.62, oversized | overhead_crane | 12.49 x 5.12 x 4 |
| street_lamp_01 | 0.7 x 3.87 x 0.39 | rollershutter_door | 3.08 x 2.4 x 0.3 |

Poly Haven props are real scale. Quaternius ones are not, scale them in the game. Long axis of cars is z, of `container` it is x.

## Decisions and why
- Sky, textures and props not in the picks were removed from the manifest, so it says what the game uses. `robot_enemy` too, the plan has four enemies.
- Sound picks are by name only. Nobody has listened to them yet, T09 has to.
- `barrier_trash`, `debris_pile`, `gas_can` added for piles. Each page says CC0, see `tools/.cache/polypizza/*.license.txt`.

## Gotchas
- `sharp` must be the same version as the one `ndarray-pixels` brings in, 0.35.5 today. Two versions load two libvips into one process and every encode fails with `colourspace: parameter space not set`.
- `join()` skips skinned meshes, so `joinSkinned` in the optimizer merges them by hand. `robot_large` and `robot_flying` have a mesh bound differently, which it fixes by moving the vertices.
- `array.forEach(compactPrimitive)` passes the index as its remap argument and corrupts the mesh. Always wrap it.
- A new `three/examples` import reloads the page under the playtest once while Vite re-bundles it. Run it again.
- Zips must stay unpacked in `tools/.cache/oga/x_<zip>/`, `fetch-assets` does not unpack them. `optimize-assets` says so if one is missing.

## Not done
Unused assets are not pruned from `sources.js` yet, T12 does that. Scrap bales in Blender belong to T04.
