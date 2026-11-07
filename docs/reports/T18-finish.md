# T18: Credits screen, README, build check, code graph

**Status:** done
**Check:** `npm test` -> 28 pass, 2 new for the credits. `npm run playtest -- screens` -> passes. Credits opens with 19 Sketchfab models linked, and Esc closes it. Shot `ui_credits.png` looked at. `npm run build` passes. `dist/` was served with `vite preview` and loaded in headless Chrome: the title came up after 8.2 s, Clock in started play, no errors and no failed requests. `/graphify src`: 579 nodes, 1282 edges, 25 communities.

## What exists now
- A **Credits** plate beside Clock in on the title. It opens CREDITS.md as a typed sheet clipped to a board. Every model, source and license is listed, the links open in a new tab, and Esc or Back closes it. CC-BY asks for credit where players see it, so it is in the game now.
- `README.md`: what the game is, how to run it, the keys, commands, where things are, the asset pipeline and the Sketchfab hand download.
- `graphify-out/`: the code graph of `src/` (`graph.html`, `GRAPH_REPORT.md`, `graph.json`). CLAUDE.md says how to query and update it.

## Files
- `Ui/readCredits.js`: CREDITS.md tables as data, no DOM. `Ui/Credits.js`: the sheet. `style/credits.css`.
- `Ui/Menu.js`: `.title-plates` holds Clock in and Credits. `style/menu.css`: their sizes.
- `tests/credits.test.js`: the reader handles links, escaped pipes and Windows line ends. Every manifest `sketchfab` entry is credited.
- `tools/scenarios.mjs`: `screens` opens and closes the credits.
- `README.md`, `CLAUDE.md` (graphify line).

## Interfaces other code uses
- `readCredits(markdown)` -> `[{ heading, rows: [[{ text, url }]] }]`. `menu.credits.open(from)` and `close()`.

## Decisions and why
- The game imports CREDITS.md itself (`?raw`), so there is one list to keep up to date, and a test fails if a Sketchfab model goes uncredited.
- The graph covers `src/` only, built from the code (no LLM, no tokens). `index.html` was the one document and was left out. `tokens.css` was skipped by graphify as possibly sensitive, a false alarm from its name.

## Gotchas
- CREDITS.md has Windows line ends. The first reader split on `\n` and showed the `|---|` line as a row.
- The graph's health check reports 9 dangling, 11 self-loop and 6 collapsed edges. They come from the code extractor on `damp()` and `wrap()` helpers defined in several files. The graph is still usable.

## Not done
- No in-game credits beyond the sheet (no scrolling credits roll).
- `/graphify` has no hook to rebuild on its own; run `/graphify src --update` after big changes.
