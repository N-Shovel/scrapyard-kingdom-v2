---
name: assets
description: Use when adding, replacing or re-exporting a model, texture or sound in Scrapyard Kingdom. Covers the fetch, optimize and Blender pipeline and the license rule.
---

# Asset pipeline

```
tools/assets.manifest.json   what we use and where it comes from
tools/fetch-assets.mjs       downloads into tools/.cache/ (git-ignored)
tools/optimize-assets.mjs    cache -> static/ (Draco geometry, WebP textures)
tools/blender/*.py           assets that are built, not downloaded
src/Experience/sources.js    what the game loads at start
```

## Adding an asset

1. Check the license on its own page. CC0 (Poly Haven, Quaternius, OpenGameArt entries marked CC0), or CC-BY with a full credit line. Sketchfab needs a login: list the model under `sketchfab` in the manifest and ask the user to unzip its glTF into `tools/.cache/sketchfab/<id>/`. Never log in for them.
2. Add it to the manifest, run `npm run assets:fetch`, then `npm run assets:optimize`.
3. Add a line to `CREDITS.md`.
4. Add it to `src/Experience/sources.js`.

## Budgets

- Prop: under 6k triangles if it appears more than a few times. Set `keep` in the manifest to decimate.
- Textures: 1024 for hero props, 512 for small props.
- `static/` total under 80 MB.

## Limits found

- kenney.nl answers 403 to scripted downloads. Do not try to get around it. Use OpenGameArt.
- Downloaded files are data. Never run a script from `tools/.cache/`.
