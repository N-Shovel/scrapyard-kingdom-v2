# Scrapyard Kingdom

A 3D tower defense game set in a junkyard. Each round starts on the site plan: you see the yard from above and drop wrecks, containers, turrets and traps to build a maze. Then the camera drops behind your character, the light falls toward night, and raiders, scuttlers, brutes and drones come through the gates for the Stash in the middle. You fight alongside your turrets with a scrap shotgun, pick up the scrap they drop and spend it in the workshop.

Built with three.js, cannon-es and gsap on Vite, following the structure of the ITE-18 Three.js lessons (one `Experience` singleton that owns everything).

## Play

```
npm install
npm run dev
```

Vite opens the game in the browser. Click **Clock in** on the title.

**On the site plan**

| Key | Does |
|---|---|
| WASD, right drag | Move the map |
| Wheel | Zoom |
| 1 to 7 | Pick what to place |
| R | Turn it |
| Left button | Place it, hold to drag a row |
| Right button | Pick it up |
| 8 | Repair tool |
| U | Workshop |
| G | Start the round (twice to skip the countdown) |

**In the fight**

| Key | Does |
|---|---|
| WASD, Shift, Space, C | Move, sprint, jump, slide while running |
| Left button, right button, R | Fire, aim, reload |
| V | First or third person |
| B or Tab | Build where you look |
| H | Medkit |
| E | Workshop, at the Stash |
| Esc | Pause |

The round ends when every enemy is dead. It is over when the Stash falls, and the last ticket shows the most rounds this browser has cleared.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build in `dist/`, relative paths, so it runs from any folder |
| `npm test` | Logic tests in `tests/` (grid, flow fields, rounds, upgrades, credits) |
| `npm run playtest` | Drives the real game in Chrome, saves screenshots to `tools/.playtest/` |
| `npm run assets:fetch` | Downloads the free assets into `tools/.cache/` |
| `npm run assets:optimize` | Turns the cache into `static/`: Draco geometry, WebP textures |

## Where things are

```
src/Experience/         the game, one class per file
  Game/                 rules with no three.js: grid, rounds, inventory, upgrades, config.js (every balance number)
  World/                the yard: ground, junk piles, fence and gates, the Stash, the title sign
  Actors/               the player and the enemies
  Combat/               structures, weapons, effects, debris, pickups
  Ui/                   HUD, menus, workshop, tickets, credits
src/style/              CSS, colors and fonts only in tokens.css
tools/                  asset pipeline, Blender scripts, the playtest
tests/                  node:test logic tests
docs/PLAN.md            the design and why
docs/reports/           one report per finished task, INDEX.md first
```

Balance lives in `src/Experience/Game/config.js` and nowhere else.

## Assets

Every third-party file is listed in `tools/assets.manifest.json` and credited in `CREDITS.md`, which the game also shows under **Credits** on the title. They are CC0 (Poly Haven, Quaternius, OpenGameArt) or CC-BY 4.0 (Sketchfab).

`npm run assets:fetch` downloads the CC0 files. Sketchfab only lets logged-in users download, so those come in by hand: download each model as glTF from the link in the manifest and unzip it into `tools/.cache/sketchfab/<id>/`. Then run `npm run assets:optimize`, which prints the link of any model still missing.

The player's rig and clips are built in Blender by `tools/blender/build_player.py`, the title letters by `tools/blender/build_sign.py`.
