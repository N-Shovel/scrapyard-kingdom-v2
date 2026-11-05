---
name: playtest
description: Use after any visible change in Scrapyard Kingdom, before claiming it works. Drives the real game in Chrome with tools/playtest.mjs and reports errors, frame time and screenshots.
---

# Playtest

```
npm run playtest                 full run, every scenario
npm run playtest -- menu prep    only these scenarios
```

The script starts Vite, opens Chrome, walks through the game through `window.experience`, and saves screenshots to `tools/.playtest/`. It fails on any console error or uncaught exception.

## Rules

- Look at the screenshots with the Read tool. A passing script does not mean it looks right.
- Add a scenario to `tools/playtest.mjs` for every new mode or screen.
- Compare against the checklist below before calling it done.

## Does it look generated?

- Any flat untextured box in view?
- Any rounded card with a soft shadow, gradient button, emoji or glow?
- Anything perfectly symmetrical that should be messy, like piles, tape or labels?
- Would this screenshot be mistaken for any other tower defense? Then it needs more junkyard.
