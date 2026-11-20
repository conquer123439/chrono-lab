# Chrono Lab: Echoes of Time

A browser 3D puzzle game built with Three.js for the Week 05/06 group assignment.

You are a time researcher trapped in a sealed laboratory. You cannot reach every switch by
yourself, so you record your own movement, rewind time, and let your echo hold the controls you
cannot hold at the same time.

## Run locally

1. Double-click `start_game.bat` (Windows). It starts a no-cache local server and opens the game.
2. Keep the command window open while playing; close it to stop the server.
3. Click **START EXPERIMENT** on the title screen, then use the keyboard.

Manual alternative: `python serve.py` from this folder, then open `http://127.0.0.1:5173/`.

Do **not** double-click `index.html`. Browsers block ES module loading from `file://`, so the page
shows a "需要本地服务器" notice instead of starting. If port 5173 is already in use, an earlier
server is still running: close that old command window first.

The server sends `Cache-Control: no-store`, so an ordinary refresh always loads the current files.
Three.js is stored locally under `src/vendor/`, so the game needs no CDN or network access.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move in the XZ plane (W = +Z, A/D = left/right) |
| `Space` | Jump |
| `R` | Rewind: finish the current recording, return to spawn, replay your route as a violet echo |
| `E` | Interact — collect a nearby time core, or use the exit |
| `Esc` | Leave Demo mode |
| Mouse drag | Orbit the camera (click the viewport to capture the pointer) |

## The puzzle chain

1. **Sync gate** — two pressure plates. You can only stand on one, so record a route onto the
   first plate, press `R`, and take the second plate yourself. The gate opens while both are held.
2. **Time core 1** — behind the gate; press `E` next to it.
3. **Laser hall** — jump the low orange beam, and leave an echo on the cyan switch to shut down
   the vertical gate before crossing. A red beam sweeps the corridor.
4. **Time core 2** — past the gate.
5. **Core chamber** — you and your echo on the two violet plates drop the energy field.
6. **Time core 3** and the exit portal.

## Title screen

- **START EXPERIMENT** — normal play.
- **WATCH DEMO** — a scripted ~30 second run that shows the core loop without any input from the
  viewer. It drives the real controller (it holds the same keys a player would) and steers by
  reading the live player position, so movement, collision, plate logic and echo replay are all
  production code paths. A narration banner explains each beat, and **SKIP** / `Esc` returns to
  the menu.
- **SOUND ON / OFF** — mutes or restores all audio.

## Audio

All sound is synthesised at runtime with the Web Audio API — there are no audio files to load.

| Event | Sound |
| --- | --- |
| Rewind (`R`) | Descending sawtooth sweep |
| Echo spawn | Rising sine sweep |
| Pressure plate | Short confirm blip |
| Laser hit | Low square-wave warning |
| Time core collected | Four-note ascending arpeggio |
| Door / gate opens | Layered energy charge |
| Victory | Short victory melody |

There is also a very quiet low-passed ambient hum. Audio starts on the first click, because
browsers do not allow an `AudioContext` before a user gesture. The sound module attaches to the
`window.CHRONO_EVENTS` hooks that the level already fires, so it never touches puzzle logic.

## Project structure

```text
index.html                page shell, HUD, title screen, demo banner
src/main.js               bootstrap, render loop, camera orbit, menu/demo/audio wiring
src/scene.js              laboratory shell, lights, camera, renderer, resize
src/player.js             WASD controller, jump, orb character model
src/timeClone.js          100 ms action recording, rewind, interpolated echo replay
src/level.js              puzzle chain, collision resolver, objectives, events
src/audio.js              Web Audio synthesis and mute control
src/demoMode.js           scripted "Watch Demo" autopilot
src/styles.css            HUD, menu, and demo-banner styling
src/vendor/               local Three.js build
tools/jscheck.py          static check: bracket balance, import resolution, exports
tools/demo-check.html     headless harness that drives Demo mode and reports progress
serve.py                  static server with no-store caching
start_game.bat            one-click launcher
```

## Verification

`tools/jscheck.py` checks every module for balanced brackets, that each relative import resolves,
and that every imported name is actually exported:

```powershell
python tools/jscheck.py
```

`tools/demo-check.html` loads the game in an iframe, clicks **WATCH DEMO**, samples the player
position every few seconds and reports the log through a request the static server records. Serve
the folder and open `http://127.0.0.1:5173/tools/demo-check.html`.

## Known limits

- A rewind pressed almost immediately after a loop starts only resets the player, because there is
  not enough movement data for a useful replay.
- The echo replays one previous route at a time; a new valid rewind replaces the old echo.
- Replay follows the recorded track and is not collision-resolved, so an echo walks through a door
  that closed after it was recorded.
- Audio initialises and fires without errors headlessly; the final listening check was done by the
  team in a normal browser window.
