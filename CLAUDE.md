# Scrapyard Kingdom

3D action tower defense. Rebuild of `../Tower Defense game dev` (old, plain JS, kept as reference).
Stack: Vite, three r187, cannon-es, gsap, lil-gui. Structure follows ITE-18 Activity 4.3 (Experience singleton).

## Starting a session: read this, not the code

1. Read [docs/reports/INDEX.md](docs/reports/INDEX.md): one line per finished task, plus what is next.
2. Read only the report for the area you will touch. Each report lists files, interfaces and gotchas.
3. Need the big picture? [docs/PLAN.md](docs/PLAN.md).
4. Open source files only after the steps above. Do not re-read the whole project.

## Finishing a task

Use the `task-report` skill (`.claude/skills/task-report/SKILL.md`). A task is not done until:
- its check ran and passed (`npm run playtest` for anything visible, `npm test` for logic), and
- `docs/reports/Txx-<name>.md` exists and `docs/reports/INDEX.md` has its line.

## Rules

- Code style matches the ITE-18 lessons: Allman braces, no semicolons, 4 spaces, one class per file, `new Experience()` for shared access, `setSomething()` methods.
- Keep files small with one job. CSS lives in `src/style/`, colors and fonts only in `tokens.css`.
- Balance numbers live only in `src/Experience/Game/config.js`.
- Every third-party asset goes through `tools/assets.manifest.json` and gets a line in `CREDITS.md`. CC0, or CC-BY with title, author, link and license in `CREDITS.md`. Sketchfab models need a login, so the user downloads them as glTF into `tools/.cache/sketchfab/<id>/`.
- Blender work is scripted in `tools/blender/` so it can be re-run. Never hand-edit files in `static/models/`.
- UI must not look generated: read the design notes in `docs/PLAN.md` before touching HUD or menus.
- Git: no commits or pushes unless asked. Never add AI attribution.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build in `dist/` |
| `npm test` | Logic tests in `tests/` |
| `npm run playtest` | Drives the game in Chrome, saves screenshots to `tools/.playtest/` |
| `npm run assets:fetch` | Downloads third-party assets to `tools/.cache/` |
| `npm run assets:optimize` | Converts the cache into `static/`. Add names to rebuild only those: `-- player mob_hope` |
| `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python tools/blender/build_player.py` | Rebuilds `tools/.cache/built/player.glb` with all clips |
| `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python tools/blender/build_sign.py` | Rebuilds `tools/.cache/built/title_sign.glb`, then `npm run assets:optimize -- title_sign` |

## What the user asked for

Rebuild Scrapyard Kingdom from scratch on the ITE-18 Three.js lessons. Use the Blender character, add own movement animation, find more assets online, improve the game. Full creative freedom, no need to ask about design. It must not look AI-made. Write a report per task so new sessions skip re-reading. The user is a student who will extend the code, so keep it clean and modular.

## Plugins for this folder

Enabled in `.claude/settings.json`:
- `frontend-design`: read before HUD and menu work.
- `playwright`: browser control through MCP, for looking at the running game.
- `context7`: current three.js and cannon-es docs. Prefer it over memory, the API changed since the lessons (three 0.148).
- `superpowers`, `caveman`, `ponytail`: workflow, terse replies, smallest complete change.
- `graphify` (global skill): the graph of `src/` is in `graphify-out/` (`graph.html`, `GRAPH_REPORT.md`). Ask it how the code connects with `/graphify query "..."`. After big changes rebuild it with `/graphify src --update`.
