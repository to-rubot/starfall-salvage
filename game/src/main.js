// STARFALL SALVAGE — entry point. Wires input, world, audio and rendering
// into a screen flow (title -> play -> game over / victory, with pause and
// restart), runs the simulation on a fixed step, and stages the screenshot
// scenes when the page is opened with ?shot=start|play|end.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_BIG_EXPLOSION, EVENT_CORE, EVENT_DASH, EVENT_ENEMY_SHOT,
  EVENT_EXPLOSION, EVENT_GAME_OVER, EVENT_PLAYER_HIT, EVENT_POWERUP,
  EVENT_SALVAGE_BONUS, EVENT_SHIELD_POP, EVENT_SHOT, EVENT_VICTORY, EVENT_WAVE,
} from './world.js';
import { drawFrame, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? 1) || 1;

const audio = createAudio();
const input = createInput(canvas);

let best = 0;
try {
  best = Number(window.localStorage.getItem('starfall-salvage-best') ?? 0) || 0;
} catch {
  best = 0;
}

function saveBest(score) {
  if (score <= best) return;
  best = score;
  try {
    window.localStorage.setItem('starfall-salvage-best', String(best));
  } catch {
    // Storage can be unavailable (private mode); the run still counts.
  }
}

function announce(text) {
  if (status) status.textContent = text;
}

// --- Screenshot mode: stage one deterministic scene and hold it. ---
if (shotName !== null) {
  const world = createWorld(createRandom(shotSeed * 7919));
  const { screen } = stageShot(shotName, world);
  const shotBest = screen === SCREEN_TITLE ? 0 : world.state.score;
  drawFrame(ctx, world, screen, 2.4, { best: shotBest, paused: false });
  announce(`STARFALL SALVAGE screenshot scene: ${shotName}`);
} else {
  runGame();
}

function runGame() {
  let world = createWorld(createRandom((Date.now() % 2147483647) || 1));
  let screen = SCREEN_TITLE;
  let paused = false;
  let elapsed = 0;
  let accumulator = 0;
  let lastTime = performance.now();
  let announcedScreen = '';

  function startRun() {
    world = createWorld(createRandom((Date.now() % 2147483647) || 1));
    screen = SCREEN_PLAY;
    paused = false;
    audio.unlock();
    audio.uiConfirm();
    audio.startMusic();
  }

  function playEvents(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_ENEMY_SHOT) audio.enemyShoot();
    if (events & EVENT_EXPLOSION) audio.explosion(false);
    if (events & EVENT_BIG_EXPLOSION) audio.explosion(true);
    if (events & EVENT_CORE) audio.pickup();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_PLAYER_HIT) audio.playerHit();
    if (events & EVENT_SHIELD_POP) audio.shieldPop();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE) audio.waveHorn();
    if (events & EVENT_SALVAGE_BONUS) audio.salvageBonus();
    if (events & EVENT_GAME_OVER) { audio.gameOver(); audio.stopMusic(); }
    if (events & EVENT_VICTORY) { audio.victory(); audio.stopMusic(); }
  }

  function handleActions() {
    let action = input.consumeAction();
    while (action !== null) {
      if (action === 'mute') {
        const muted = audio.toggleMute();
        announce(muted ? 'Sound muted' : 'Sound on');
      } else if (action === 'pause' && screen === SCREEN_PLAY) {
        paused = !paused;
        announce(paused ? 'Paused' : 'Resumed');
      } else if (action === 'confirm') {
        if (screen === SCREEN_TITLE) startRun();
        else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) startRun();
      } else if (action === 'restart' && screen !== SCREEN_TITLE) {
        startRun();
      }
      action = input.consumeAction();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += delta;
    handleActions();

    if (screen === SCREEN_TITLE) {
      // The title floats over a harmless live field.
      accumulator += delta;
      const idle = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false, dash: false };
      while (accumulator >= STEP) {
        world.step(STEP, idle, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY && !paused) {
      accumulator += delta;
      const move = input.moveVector();
      const live = {
        moveX: move.x,
        moveY: move.y,
        aimX: input.state.aimX,
        aimY: input.state.aimY,
        firing: input.state.firing,
        dash: input.consumeDash(),
      };
      while (accumulator >= STEP) {
        const events = world.step(STEP, live, false);
        live.dash = false; // A queued dash fires on the first step only.
        playEvents(events);
        accumulator -= STEP;
        if (world.state.over) { screen = SCREEN_OVER; saveBest(world.state.score); break; }
        if (world.state.victory) { screen = SCREEN_VICTORY; saveBest(world.state.score); break; }
      }
    }

    const shake = world.state.shake;
    const shakeX = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    drawFrame(ctx, world, screen, elapsed, { best, paused, shakeX, shakeY });

    if (screen !== announcedScreen) {
      announcedScreen = screen;
      announce(
        screen === SCREEN_TITLE
          ? 'STARFALL SALVAGE. Click or press Enter to launch.'
          : screen === SCREEN_PLAY
            ? `Wave ${world.state.wave}. Score ${world.state.score}.`
            : `Run over. Final score ${world.state.score}. Press R to fly again.`,
      );
    }
  }

  requestAnimationFrame(frame);
}
