// Screenshot scenes behind ?shot=start|play|end. Each scene runs the real
// simulation forward from a fresh world, steered by a small pilot, so a frame
// is what an actual short game looks like — and a fixed seed makes it the
// same frame on every visit.

import { FIELD, STEP } from './config.js';
import { KIND_DREADNOUGHT, KIND_MITE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 28;
const END_LIMIT_SECONDS = 240;

/** The nearest active enemy to a point, or null. */
function nearestEnemy(state, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = enemy; }
  }
  return best;
}

/**
 * A competent pilot: aim at the nearest hunter, keep a comfort distance from
 * it, and drift toward the nearest core when nothing is close. With
 * `careless` set it does the opposite — it rams the nearest hunter head-on
 * and never fires, a run that cannot last.
 */
function pilotInput(state, careless) {
  const player = state.player;
  if (careless) {
    const target = nearestEnemy(state, player.x, player.y);
    if (!target) {
      return { moveX: 0, moveY: -1, aimX: player.x, aimY: 0, firing: false, dash: false };
    }
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    return { moveX: dx / dist, moveY: dy / dist, aimX: target.x, aimY: target.y, firing: false, dash: false };
  }
  const target = nearestEnemy(state, player.x, player.y);
  let moveX = 0;
  let moveY = 0;
  let aimX = player.x;
  let aimY = player.y - 100;

  if (target) {
    aimX = target.x;
    aimY = target.y;
    const dx = player.x - target.x;
    const dy = player.y - target.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const comfort = target.kind === KIND_DREADNOUGHT ? 330 : 215;
    if (dist < comfort) {
      moveX = dx / dist;
      moveY = dy / dist;
    } else if (dist > comfort + 130) {
      moveX = -dx / dist;
      moveY = -dy / dist;
    } else {
      moveX = -dy / dist * 0.7;
      moveY = dx / dist * 0.7;
    }
  } else if (state.cores.length > 0) {
    const core = state.cores[0];
    const dx = core.x - player.x;
    const dy = core.y - player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    moveX = dx / dist;
    moveY = dy / dist;
    aimX = core.x;
    aimY = core.y;
  }

  // Keep off the walls so the pilot never pins itself in a corner.
  if (player.x < 90) moveX = Math.max(moveX, 0.6);
  if (player.x > FIELD.width - 90) moveX = Math.min(moveX, -0.6);
  if (player.y < 110) moveY = Math.max(moveY, 0.6);
  if (player.y > FIELD.height - 90) moveY = Math.min(moveY, -0.6);

  const incoming = state.bolts.some(
    (bolt) => (bolt.x - player.x) ** 2 + (bolt.y - player.y) ** 2 < 110 * 110,
  );
  return { moveX, moveY, aimX, aimY, firing: Boolean(target), dash: incoming };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  const idle = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false, dash: false };

  if (name !== 'play' && name !== 'end') {
    // Title backdrop: hunters drift through a harmless field behind the logo.
    world.spawnEnemy(KIND_MITE, 240, 150);
    world.spawnEnemy(KIND_MITE, 1060, 120);
    world.spawnEnemy('drifter', 880, 560);
    world.spawnEnemy('stinger', 330, 580);
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idle, true);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, pilotInput(world.state, false), false);
      if (world.state.over) break;
    }
    return { screen: SCREEN_PLAY };
  }

  // End: a careless run, flown until the swarm finishes it.
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    world.step(STEP, pilotInput(world.state, true), false);
    if (world.state.over) break;
  }
  return { screen: SCREEN_OVER };
}
