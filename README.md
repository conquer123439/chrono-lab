# Chrono Lab: Echoes of Time

A browser 3D puzzle game built with Three.js for the Week 05/06 group assignment.

You are a time researcher trapped in a sealed laboratory. Your goal is to collect all three time
cores and escape through the exit portal. You cannot reach every switch by yourself, so record your
movement, rewind time, and let your echo hold controls that you cannot hold at the same time.

## Play online

[Play Chrono Lab](https://liuyinghui15-cpu.github.io/chrono-lab/) in a desktop browser with a
keyboard and mouse. The shared GitHub Pages site opens without a GitHub login.

## Run locally

You need Python 3 and a browser with WebGL support. Check Python with `python --version` or,
on Windows, `py --version`. The game uses local JavaScript modules and does not require an npm
install, a build command, or an online backend.

If you already have a local clone, open its root folder. For a first checkout:

```powershell
git clone https://github.com/liuyinghui15-cpu/chrono-lab.git
cd chrono-lab
```

On Windows, double-click `start_game.bat`. It finds `python` or `py`, starts a no-cache local
server, and opens the game. Keep the command window open while playing; close it to stop the
server. Click **START EXPERIMENT** on the title screen.

To start the same server manually, run this from the folder containing `index.html` and `serve.py`:

```powershell
python serve.py
```

If Windows provides only the `py` launcher, use `py serve.py`. Open
`http://127.0.0.1:5173/` if the browser does not open automatically. Press `Ctrl+C` in the
terminal to stop the manually started server.

Do **not** double-click `index.html`. Browsers block ES module loading from `file://`, so the page
shows a "需要本地服务器" notice instead of starting. If port 5173 is already in use, an earlier
server is still running: close that old command window first.

The server sends `Cache-Control: no-store`, so an ordinary refresh always loads the current files.
Three.js is stored locally under `src/vendor/`, so the game needs no CDN or network access.

## Publishing

The team publishes one shared site from this repository's `main` branch using GitHub Pages.
In **Settings → Pages → Build and deployment**, the source is **Deploy from a branch**,
the branch is **main**, and the folder is **/ (root)**.

Keep `index.html`, `src/`, and `src/vendor/` in their existing relative locations. The site is
served under `/chrono-lab/`, so page assets must retain paths such as `./src/main.js` and
JavaScript modules must retain their relative imports. Python is only a local file server;
GitHub Pages serves the HTML, CSS, JavaScript, and local Three.js files directly.

To publish an update:

1. Make changes on a working branch and open a PR targeting this repository's `main`.
2. Have a teammate review the PR, address the feedback, and merge when the publisher judges it ready.
3. Open [Actions](https://github.com/liuyinghui15-cpu/chrono-lab/actions) and inspect the
   **pages build and deployment** run for the merged commit. Check its result before using the
   updated site.
4. Open the shared playable URL and check the affected behavior. For the final group submission,
   each member must also complete the assignment's personal verification.

Team members contribute through their branches and forks; they use the shared playable URL above.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move in the XZ plane (W = +Z, A/D = left/right) |
| `Space` | Jump |
| `R` | Rewind: finish the current recording, return to spawn, and replay your route as a violet echo |
| `E` | Interact — collect a nearby time core, or activate the exit when all three cores are collected |
| `RESTART` button | Reset the player, echo, puzzle state, and collected cores |
| `Esc` | Release the mouse pointer lock; in Demo mode, return to the title screen |
| Mouse | Click the viewport to capture the pointer, then move the mouse to orbit the camera |

Movement uses the world XZ axes rather than the camera direction: `W` moves toward +Z and `S`
toward -Z; `A` and `D` move left and right on the X axis. Click the viewport again after releasing
pointer lock if you want to recapture the camera.

## The puzzle chain

1. **Sync gate** — two pressure plates are placed side by side. Record a route onto one plate,
   press `R` to create the violet echo, then move onto the other plate yourself. The blue door
   opens once both plates are occupied and stays open.
2. **Time core 1** — pass through the opened door and press `E` while standing near the first core.
3. **Laser hall** — jump over the low orange beam. Record an echo on the cyan switch so it holds
   the switch while you cross; the vertical gate is disabled only while that switch is active. A
   moving red beam also sweeps across the hall, so time the crossing carefully.
4. **Time core 2** — after the gate, move near the second core and press `E` to collect it. A beam
   hit sends the player back to the laser-hall respawn point.
5. **Core chamber** — place the player and echo on the two violet plates at the same time. This
   drops the energy field.
6. **Time core 3 and exit** — press `E` near the final core, then reach the exit portal and press
   `E` again to finish. The exit is not usable before all three cores are collected.

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

## CI/CD exploration

> **NO AI — member C writes and confirms this note.** The fields below are intentionally left for the team’s own observation of one real deployment. Do not treat a successful deployment as proof that gameplay is correct.

- Checked deployment link / source commit: Actions run 44688772904；source commit ee51a5f01d1911cad91e75956f6df3ecb137564b；published site https://liuyinghui15-cpu.github.io/chrono-lab/
- Trigger: GitHub Pages deployment for the main branch.
- Actual steps / published files: Checkout, Build with Jekyll, Upload artifact, and Deploy to GitHub Pages; the published project is the root index.html and its src files.
- Result or blocker: The run completed successfully. The run showed a Node.js 20 deprecation warning. It did not prove that gameplay was correct.
- Automatic part / manual part: GitHub Actions built and deployed the site automatically; opening the site and checking gameplay, sound, and mute remained manual.
- One check that actually ran: The Pages build and deployment jobs ran successfully; no project-specific gameplay test was shown in this run.
- One useful missing check I identified：没有看到该次运行执行项目专用的游戏检查，这可能会导致该游戏因为某些原因无法运行
- All-member review/confirmation:A、B、C 已确认

## Assets & credits

### Third-party library

- The runtime uses a local Three.js vendor build in `src/vendor/three.core.js` and `src/vendor/three.module.js` rather than loading Three.js from a CDN.
- The checked-in vendor files retain the upstream header identifying **Three.js Authors**, copyright 2010–2025, SPDX license identifier **MIT**, and revision `180`.
- The project metadata declares the Three.js dependency as version `0.180.0` in `package.json`. Upstream source and licensing information: [Three.js repository](https://github.com/mrdoob/three.js/tree/r180) and [Three.js MIT license](https://github.com/mrdoob/three.js/blob/r180/LICENSE).

### Project-generated visuals and sound

- The game’s laboratory, character, puzzle objects, lights, and effects are generated at runtime from Three.js geometry and materials in `src/scene.js`, `src/player.js`, and `src/level.js`.
- Text labels are generated in the browser with canvas elements and `CanvasTexture`; no external image texture files are used by the project code.
- Sound is generated at runtime with the Web Audio API in `src/audio.js` using oscillators, gain envelopes, and a generated ambient buffer; no external audio files are loaded.

### External asset check

The current repository tree contains no separate image, audio, model, or font asset files. The local vendor library and its retained license notice are the only third-party runtime files identified in this source review.

## Contributors

> Each member must enter their own public name or handle and confirm their actual contribution. Do not infer these entries from the Week 05 or Week 07 task split.

| Public name or handle | Actual contribution confirmed by that member |
|---|---|
| liuyinghui15-cpu | 我整理了文件 上传了文件 我创建了团队公开仓库 `chrono-lab`。我亲自在 GitHub 设置并开启了 Pages。我进行了初步试玩，确认游戏体验正常。我亲自撰写了对 B 的 PR #3 的审阅评论，记录了回溯、分身和核心收集的检查。我提供了回应 C 的原文，并独立判断自己的 PR #1 可以合并。 |
| qzezhou | fork 团队仓库并建 codex/w07-b-gameplay-docs 分支；改进 README 的 Game goal、Controls、The puzzle chain（PR #3，提交 5b12bb8，+25/−15 行，只动 README.md，经 A 审阅并合并，合并提交 f0c6d47）；审阅 PR #2 并留评论；回复 A 对我 PR 的审阅意见 |
| conquer123439 | 我自己fork了chrono-lab的main分支；自己修改了README的章节；PR#2因为B的意见修改过一次。 |

## AI assistance

> Each member fills only their own material AI assistance and disclosure. Keep this structure until the members provide and confirm their own facts.

| Member / public handle | Material AI assistance and purpose | Member’s disclosure / confirmation |
|---|---|---|
| liuyinghui15-cpu | **README 修改、PR 创建和合并操作由 AI 协助执行**；文件整理和上传的 AI 协助：是 | 我确认记录 |
| qzezhou | DSH 桌面端（DeepSeek 模型）辅助起草 README 的 Controls 与 The puzzle chain 文字、执行分支与提交的 Git 命令、运行 tools/jscheck.py、辅助分析 PR #2 的 diff | 本人确认：AI 起草的文字本人阅读后采纳；AI 执行并报告、本人阅读报告后确认的事项为 jscheck.py 7/7 通过、git diff 比对结论。未亲自验证的部分：PR #2 中 Three.js vendor 文件逐行内容、在线站点实际可玩性（仅 HTTP 200 技术检查，非游玩验证）。 |
| conquer123439 | AI没有帮我检验网站，各种fork并没有帮我，他帮我执行git推送，和看actions日志，以及整理表格，和给我提示步骤。README的部分内容由AI给出草稿，CI/CD正文由我本人改写。 | B/C已确认 |

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
