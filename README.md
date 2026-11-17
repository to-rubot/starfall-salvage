# STARFALL SALVAGE

An original neon arena shooter for the desktop browser, built for make.fun's
**best-game-01** ("Make the best game"). No build step, no dependencies, no
network: serve `game/` with any static file server and play.

## The game

A salvage ship alone in a falling starfield. Hunter swarms — darting **Mites**,
splitting **Drifters** and strafing **Stingers** — guard the star cores the
field is owed. Blast them, recover the cores, chain kills into combo
multipliers, and survive to **Wave 8**, where the **Dreadnought** waits.
Bring it down to win; lose all five hull hearts and the run ends.

- **Move** — WASD / arrow keys
- **Aim & fire** — mouse (or hold Space to fire toward the pointer)
- **Dash** — Shift: a burst of speed with brief invulnerability
- **Pause** — P · **Mute** — M · **Restart** — R
- **Salvage** — every 10 cores pays a 300-point bonus and repairs 1 hull
- **Power-ups** — Shield, Rapid Fire, Core Magnet and Repair drop from wrecks
- **Combo** — kills within 3 seconds of each other raise the score multiplier up to x8

All sound is synthesised live with WebAudio; all art is drawn in code on a
canvas. The best score is kept in `localStorage`.

## Run it locally

```sh
node serve.ts            # http://localhost:8080
```

## Hand it in (make.fun)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` using the kit's `vendor/makefun-game.ts` (unchanged).

## Screenshots

The three shots in `screenshots/` are real renders of this code, staged
deterministically through the game's own screenshot scenes:

- `game/?shot=start&seed=1` — title screen over a live field
- `game/?shot=play&seed=1` — a piloted run in progress
- `game/?shot=end&seed=1` — the game-over screen after a careless run

## Layout

- `game/index.html` — the page (canvas + status line)
- `game/src/config.js` — all tuning: field, ship, hunters, waves, palette
- `game/src/world.js` — the simulation (waves, combat, pickups, particles)
- `game/src/render.js` — every drawing: sky, ships, HUD, title and end screens
- `game/src/input.js` — keyboard, mouse and touch
- `game/src/audio.js` — WebAudio-synthesised effects and the bass pulse
- `game/src/random.js` — the seeded random source
- `game/src/shots.js` — the deterministic screenshot scenes and their pilot
- `game/src/main.js` — screen flow and the fixed-step game loop

MIT licensed — see `LICENSE`.
