# T10: HUD, menu, workshop, site plan, ticket

**Status:** done with gaps
**Check:** `npm test` -> 25 pass, 3 new for `Upgrades`. `npm run playtest -- screens` -> title up, Clock in flies to the map, a tag click picks without building, U opens the workshop, Hot loads and a medkit bought (500 to 405 scrap), Esc closes it. A round started without the mouse waits under a Round 1 plate. H heals with the medkit. The fight HUD shows 2 of 6 shells and a low gauge at 22 health. Build mode shows 7 tags and "Too far" under the crosshair. Clearing the round prints the ticket, Esc pauses on the map, a fallen Stash ends on the last ticket. Passed 5 runs. Full playtest passes, world 6.1 ms, 28 enemies 12.1 ms. Shots `ui_*.png` looked at.

## What exists now
A title over the turning yard, the site plan with a title block and parts tags, a fight HUD (gauges, tally counter, shells, crosshair, tape notes), the workshop pegboard, a pause screen with the key sheet, weighbridge tickets for round end and game over. Workshop upgrades and medkits work.

## Files
- `Ui/Ui.js`: owns the screens, the state (`loading`, `title`, `play`, `pause`, `shop`, `over`) and its changes.
- `Ui/Menu.js`: title (and its camera drift), pause with the key sheet, game over plate.
- `Ui/Hud.js`: composes `Gauge`, `Tally`, `Shells`, `Notes`, the round and crosshair. Writes only what changed.
- `Ui/Tags.js`: build row and the cursor note. `Ui/SitePlan.js`: prep title block and the big countdown.
- `Ui/Ticket.js`: prints and tears off tickets with gsap. `Ui/Shop.js`: the pegboard.
- `Game/Upgrades.js`: levels, prices, medkits. No three.js.
- `style/parts.css` (plate, tape, worn paint, focus), `hud.css`, `plan.css`, `ticket.css`, `menu.css`, `shop.css`.

## Interfaces other code uses
- `experience.ui`: `state`, `view` ('map' | 'fight'), `setState(s)`, `clockIn()`, `pause()`, `resume()`, `openShop()`, `closeShop()`, `nearStash`, `pauseOnUnlock`. `pause()` drops the mouse lock (T13). State `aim` and `waitForAim()` since T14.
- `#ui` has `data-state` and `data-view`. CSS shows each piece from those, not JS.
- `Experience.update`: world runs in `title` and `play`, game only in `play`. Ui updates after the game.
- `game.upgrades`: `bonus(id)` (step times level), `price(id)` (null at the top), `buy(id)`, `levels`, `medkits`, `useMedkit()`. `config.UPGRADES[n].step`, `config.WORKSHOP_REACH` 5.
- `game.earned`: all scrap ever added. `weapons.mag`. `player.maxHp` (getter), `heal(n)`, `useMedkit()`, `patching`: a medkit heals `CONSUMABLES.medkit.heal` over `time` (5 s), lost if she goes down, H does nothing while one is on. No regen: health comes back only from medkits, Patch up, Scrap plating and getting up after going down.
- `hud.notes.say(text, key, tone)`, `forget(key)`. Tone `'warn'` is red lead.
- Playtest `ready()` waits for the title, sets `pauseOnUnlock = false` and clocks in. `screens` waits for the title itself.

## Decisions and why
- The fight pauses whenever it is in first or third person without the mouse. A round starting from the timer has no click to lock with, so it waits under "Round N, Take aim". 400 ms grace after asking for the lock, or closing the workshop flashed the pause plate.
- Input ignores a mousedown that is not on the canvas. That one line keeps clicks on tags, tickets and the title block from building on the map under them.
- She only moves in first or third person. On the title (camera 'free') the keys did nothing else to stop her.
- Site plan sits under the counter, not bottom right: eight tags and the gauges need the whole bottom edge at 1280 px.
- Ticket text is set in sentence case and uppercased in CSS, because a weighbridge printer prints caps. Only there.
- Clock out and Clock in again reload the page. Nothing else holds state worth keeping.
- The workshop pauses the prep timer too, since the game does not update in `shop`.

## Gotchas
- Frame times once read 20 ms for every scenario with the UI shown or hidden. That was the machine, not the UI: the next full run was 6.1 ms.
- `.paint` is a CSS mask from SVG turbulence. Denser noise read as camouflage or dalmatian spots. Keep it sparse.
- Pointer lock was never driven here, headless Chrome has none. T13 drove every flow in a headed Chrome and they pass.

## Not done
- The title's name is HTML. The plan's rusted 3D sign on the crane is T11.
- No sound for UI beyond the existing clink. No gamepad.
- Below about 1100 px wide the tags reach the gauges.
