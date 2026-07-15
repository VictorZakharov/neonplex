# NEONPLEX

[![CI](https://github.com/VictorZakharov/neonplex/actions/workflows/ci.yml/badge.svg)](https://github.com/VictorZakharov/neonplex/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-56efff.svg)](LICENSE)
[![Play Neonplex](https://img.shields.io/badge/play-GitHub%20Pages-6fffd2.svg)](https://victorzakharov.github.io/neonplex/)

Neonplex is an original, Supaplex-inspired 2D puzzle-action game with a neon-industrial identity, large scrolling sectors, deterministic grid simulation, and high-refresh presentation. Mine the circuit, collect every Infotron, control gravity, outmaneuver live wall-following Sentinels, and reach the extraction gate.

The game is built with strict TypeScript, Webpack 5, Canvas 2D, and Web Audio. Gameplay art is procedural, the HUD uses an original generated surface texture stored as an optimized JPEG, and sound is synthesized at runtime. It does not download fonts, music, sprites, or other runtime assets.

**[Play the latest release](https://victorzakharov.github.io/neonplex/)**

## Run locally

Prerequisites: Node.js 24 or newer and npm 10 or newer.

```powershell
npm ci
npm start
```

Open `http://localhost:8080`.

## Controls

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Move | `WASD` or arrow keys | Drag the virtual joystick, or hold and drag from the Carrier; it moves toward the held finger and stops on release |
| Travel along a clear straight corridor | - | Tap a reachable cell in the Carrier's row or column |
| Consume an adjacent dirt, Infotron, or pickup Disk without moving | Hold `Space` + direction | Hold Pulse + joystick direction |
| Deploy a collected Pulse Disk beneath the Carrier | Hold `Space` alone for 1.5 seconds | Hold Pulse for 1.5 seconds |
| Push a Zonk | Move horizontally into it when the next cell is clear | Virtual joystick |
| Pan the map | Drag with either mouse button | Drag anywhere on the level away from the Carrier |
| Return to camera follow | Move the Carrier | Move the Carrier |
| Zoom from 68% to 172% | Mouse wheel | Pinch around a point or use the `−` / `+` controls |
| Pause or resume | `Esc` or `P` | Pause button |
| Restart a sector | Hold `R` for 2 seconds | Pause menu |
| Navigate menus | Arrows/WASD, `Tab`, `Home`, `End`, `Enter`, `Space` | Tap controls |

Disk input is deliberately chord-safe. A direction pressed with `Space` performs stationary consumption and resets the deployment timer. Only an uninterrupted 1.5-second hold deploys a Disk on the Carrier's current cell. Restart uses the same hold-to-confirm pattern but keeps its two-second threshold, with an in-world progress indicator and no duplicate popup underneath it.

## Game rules

- Collect every Infotron to bring the green `E` exit online. An off-screen chevron includes the exit image and points toward it.
- Zonks and loose Infotrons obey gravity. They roll visibly sideways from eligible rounded supports, then fall vertically on a later step; movement is never diagonal.
- A roll begins only if both the side cell and the future fall cell are clear. A Carrier or another object in that fall lane blocks the roll.
- Stationary objects overhead are harmless. Only objects already in a falling state can crush the Carrier or a Sentinel.
- Every Carrier death creates a 3x3 explosion, regardless of its cause. A falling object crushing a Sentinel creates the same blast.
- Rounded violet Circuit Walls allow roll-off behavior and can be destroyed by a Pulse Disk. Square Steel Bulkheads and Carbon Trusses are permanent, blast-proof, and non-rollable.
- Pulse Disks can be collected, deployed beneath the Carrier, chain-react, and destroy nearby destructible cells after a short fuse.
- Sentinels use a live right-hand wall-following rule. They visibly rotate before moving, follow current terrain rather than an initial mask, and immediately adapt when excavation or an explosion changes the patrol boundary.

Every sector opens with mandatory pre-breach intelligence. Its tile illustrations are rendered from the same gameplay visuals, so unfamiliar elements are explained before the simulation starts.

## Campaign

| Sector | Grid | Infotrons | Focus |
| --- | ---: | ---: | --- |
| First Shift | 20x11 | 3 | Fundamentals, gravity, and tile identification |
| Circuit Warren | 38x24 | 11 | Lateral scrolling, dynamic patrols, and map navigation |
| Deep Cascade | 44x28 | 18 | Multi-deck demolition, gravity control, and chain reactions |

All three layouts are distinct and selectable from the campaign menu. Local best scores, par-time bonuses, and S/A/B completion ranks persist in browser storage.

## Presentation and usability

- Display-rate rendering is decoupled from the 60 Hz simulation and interpolates movement for smooth presentation on high-refresh displays, including 144 Hz when the browser and monitor provide it.
- Carrier moves, Zonk pushes, rolls, falls, Infotron falls, Sentinel translation, and Sentinel rotation animate continuously between cells.
- Traversal excavation is linear; stationary consumption uses a vortex-like effect matched to the consumed tile.
- Camera follow, focal-point-preserving wheel zoom, and manual map pan transition smoothly without lateral jumps.
- Phones and tablets have a continuous analog-style movement joystick, queue-free hold-to-follow Carrier steering with immediate release, clear-corridor tap travel, stabilized midpoint-preserving pinch zoom, large zoom controls, safe-area spacing, and live portrait/landscape reflow.
- Wide layouts keep the tactical minimap in a dedicated right rail; narrow portrait layouts reserve a compact top HUD dock, while phone and tablet landscapes use a shallow horizontal HUD with floating controls so the board receives the available height.
- Touch surfaces suppress page overscroll, pull-to-refresh, browser swipe navigation where supported, and long-press callouts; controls remain inset from operating-system-reserved screen edges.
- The responsive textured shell keeps compact extraction status, runtime, score, Disk inventory, minimap, and readable learning and pause screens visible after rotation.
- Optional, subdued performance telemetry reports FPS, 1% low, frame interval, and render/draw time. It can be shown or hidden persistently from the pause menu.
- Audio is event-only and has a persistent mute control. There is no music loop or idle hum.
- Keyboard-first menus, touch controls, visible focus states, semantic controls, live announcements, and reduced-motion support are included.

## Engineering

The simulation uses a browser-independent 60 Hz fixed timestep with bounded catch-up. Rendering consumes immutable simulation snapshots and interpolates between ticks, so a 120/144/165 Hz display can receive distinct motion frames without changing gameplay outcomes.

Large-map performance work includes:

- viewport culling and cached static board layers;
- cached backdrop and post-processing surfaces;
- minimap geometry caching with a bounded refresh rate;
- clipped board effects and a 360-particle cap;
- a device-pixel-ratio cap of 2;
- a desynchronized Canvas 2D context where supported;
- explicit teardown for the application, renderer, input listeners, observers, camera handlers, and audio.
- gesture arbitration that gives two-finger pinch priority, separates taps from pans, and cancels held input safely on orientation, visibility, and pointer-capture changes.

The renderer is split into focused camera, board, sprite, minimap, exit-indicator, preview, and effects modules. Input chords, motion tracking, gravity, explosions, and enemy navigation live in isolated systems. ESLint enforces a 500-line effective ceiling for implementation files, and interfaces are kept in dedicated `types.ts` or `*Types.ts` contract modules.

## Project layout

- `src/game` - deterministic simulation, campaign data, parsing, systems, domain events, and tests.
- `src/render` - Canvas pipeline, cached layers, cameras, sprites, previews, minimap, and feedback effects.
- `src/input` - keyboard, pointer, touch, hold, and chord translation.
- `src/audio` - gesture-gated synthesized event effects.
- `src/ui` - application lifecycle, HUD, menus, persistence, accessibility, and responsive controls.

## Quality gates

```powershell
npm run check
npm run build
```

`npm run check` runs strict type-checking, ESLint, and 180 deterministic tests across 25 suites. Pull requests and pushes to `main` run the same checks in GitHub Actions.

| Script | Purpose |
| --- | --- |
| `npm start` | Start the Webpack development server |
| `npm run typecheck` | Run TypeScript without emitting output |
| `npm run lint` | Enforce style and maintainability constraints |
| `npm test` | Run Jest in-band |
| `npm run check` | Run type-checking, linting, and tests |
| `npm run build` | Produce an optimized `dist/` build |

## Deployment and previews

GitHub Actions publishes `main` to GitHub Pages. Same-repository pull requests receive an isolated preview under `/pr-preview/pr-N/`; closing a pull request removes its preview. Fork pull requests still run CI, but intentionally do not deploy untrusted code with write credentials.

## Browser support

Neonplex targets current evergreen desktop and mobile browsers with Canvas 2D, `ResizeObserver`, Pointer Events, Web Audio, and ES2022 support. `prefers-reduced-motion` suppresses shake, flashes, and nonessential transitions without changing game rules.

## Contributing and security

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, follow the [Code of Conduct](CODE_OF_CONDUCT.md), and report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License and attribution

Copyright (c) 2026 Victor Zakharov. Released under the [MIT License](LICENSE).

Neonplex is an independent, original project inspired by the puzzle mechanics of Supaplex. It is not affiliated with, endorsed by, or a distribution of the original Supaplex game or its rights holders. Please do not contribute copied proprietary assets, levels, audio, or source code.
