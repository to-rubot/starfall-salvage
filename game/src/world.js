// The simulation: the salvage ship, its bullets, three hunter kinds plus the
// Dreadnought, drifting star cores, power-ups, particles and floating score
// text. Pure logic with no DOM — main.js feeds it input, render.js draws the
// state, and the screenshot stager drives it with a pilot. One step advances
// exactly STEP seconds and returns an event bitmask for sound and shake.

import {
  COMBO, CORE, DREADNOUGHT, ENEMY, FIELD, FINAL_WAVE, PLAYER, POWERUP,
  SALVAGE, STINGER, WAVE,
} from './config.js';
import { randomRange } from './random.js';

export const KIND_MITE = 'mite';
export const KIND_DRIFTER = 'drifter';
export const KIND_STINGER = 'stinger';
export const KIND_DREADNOUGHT = 'dreadnought';

export const EVENT_SHOT = 1;
export const EVENT_ENEMY_SHOT = 2;
export const EVENT_EXPLOSION = 4;
export const EVENT_BIG_EXPLOSION = 8;
export const EVENT_CORE = 16;
export const EVENT_POWERUP = 32;
export const EVENT_PLAYER_HIT = 64;
export const EVENT_SHIELD_POP = 128;
export const EVENT_DASH = 256;
export const EVENT_WAVE = 512;
export const EVENT_SALVAGE_BONUS = 1024;
export const EVENT_GAME_OVER = 2048;
export const EVENT_VICTORY = 4096;

const TAU = Math.PI * 2;

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function circlesTouch(ax, ay, ar, bx, by, br) {
  const reach = ar + br;
  return distanceSquared(ax, ay, bx, by) <= reach * reach;
}

/**
 * Create a world driven by `random` (a function returning [0, 1)).
 * Input for step: { moveX, moveY, aimX, aimY, firing, dash }.
 * With `harmless` set, hunters drift and fall but cannot hurt or be hurt —
 * the title screen's living backdrop.
 */
export function createWorld(random) {
  const state = {
    elapsed: 0,
    score: 0,
    kills: 0,
    coresCollected: 0,
    salvageProgress: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    wave: 0,
    phase: 'intermission', // 'intermission' | 'spawning' | 'combat' | 'boss' | 'done'
    phaseTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    bannerText: '',
    bannerTimer: 0,
    shake: 0,
    over: false,
    victory: false,
    player: null,
    bullets: [],
    bolts: [],
    enemies: [],
    cores: [],
    powerups: [],
    particles: [],
    floaters: [],
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2 + 120,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: PLAYER.maxHull,
      invulnerable: 0,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashDirectionX: 0,
      dashDirectionY: -1,
      shield: false,
      rapidTimer: 0,
      magnetTimer: 0,
    };
  }

  function reset() {
    state.elapsed = 0;
    state.score = 0;
    state.kills = 0;
    state.coresCollected = 0;
    state.salvageProgress = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.wave = 0;
    state.phase = 'intermission';
    state.phaseTimer = 1.2;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.bannerText = '';
    state.bannerTimer = 0;
    state.shake = 0;
    state.over = false;
    state.victory = false;
    state.player = freshPlayer();
    state.bullets = [];
    state.bolts = [];
    state.enemies = [];
    state.cores = [];
    state.powerups = [];
    state.particles = [];
    state.floaters = [];
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, age: 0, life: 0.9 });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const pace = randomRange(random, speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        age: 0,
        life: randomRange(random, 0.3, 0.75),
        size: randomRange(random, 1.5, 3.5),
        color,
      });
    }
  }

  function showBanner(text, seconds = 2) {
    state.bannerText = text;
    state.bannerTimer = seconds;
  }

  /** A spawn point on a field edge, kept a fair distance from the ship. */
  function edgeSpawnPoint() {
    const player = state.player;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const side = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (side === 0) { x = random() * FIELD.width; y = -40; }
      if (side === 1) { x = random() * FIELD.width; y = FIELD.height + 40; }
      if (side === 2) { x = -40; y = random() * FIELD.height; }
      if (side === 3) { x = FIELD.width + 40; y = random() * FIELD.height; }
      if (!player || distanceSquared(x, y, player.x, player.y) > 260 * 260) return { x, y };
      if (attempt === 7) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  function spawnEnemy(kind, x, y) {
    const spec = ENEMY[kind];
    const enemy = {
      kind,
      x, y,
      vx: 0, vy: 0,
      radius: spec.radius,
      hull: spec.hull,
      maxHull: spec.hull,
      angle: random() * TAU,
      spin: randomRange(random, -1.2, 1.2),
      wobble: random() * TAU,
      shotTimer: randomRange(random, 1, STINGER.shotInterval),
      radialTimer: DREADNOUGHT.radialInterval,
      aimedTimer: DREADNOUGHT.aimedInterval,
      miteTimer: DREADNOUGHT.miteInterval,
      flash: 0,
      entering: true,
    };
    if (kind === KIND_DRIFTER) {
      const drift = random() * TAU;
      enemy.vx = Math.cos(drift) * spec.speed;
      enemy.vy = Math.sin(drift) * spec.speed;
    }
    if (kind === KIND_DREADNOUGHT) {
      enemy.x = FIELD.width / 2;
      enemy.y = -70;
      enemy.entering = true;
    }
    state.enemies.push(enemy);
    return enemy;
  }

  function buildWaveQueue(wave) {
    const plan = WAVE.plan[wave];
    const queue = [];
    for (const kind of [KIND_MITE, KIND_DRIFTER, KIND_STINGER]) {
      for (let i = 0; i < plan[kind]; i += 1) queue.push(kind);
    }
    // Shuffle so kinds interleave instead of arriving in blocks.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function beginWave(wave) {
    state.wave = wave;
    if (wave === FINAL_WAVE) {
      state.phase = 'boss';
      spawnEnemy(KIND_DREADNOUGHT, FIELD.width / 2, -70);
      showBanner('FINAL WAVE — THE DREADNOUGHT', 2.6);
    } else {
      state.phase = 'spawning';
      state.spawnQueue = buildWaveQueue(wave);
      state.spawnTimer = 0;
      showBanner(`WAVE ${wave}`, 1.8);
    }
    return EVENT_WAVE;
  }

  function dropCore(x, y) {
    state.cores.push({
      x, y,
      vx: randomRange(random, -30, 30),
      vy: randomRange(random, -30, 30),
      age: 0,
    });
  }

  function dropPowerup(x, y) {
    const kind = POWERUP.kinds[Math.floor(random() * POWERUP.kinds.length)];
    state.powerups.push({ x, y, kind, age: 0 });
  }

  function comboMultiplier() {
    return Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.killsPerTier));
  }

  function awardKill(enemy) {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.windowSeconds;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const gained = ENEMY[enemy.kind].points * comboMultiplier();
    state.score += gained;
    addFloater(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#eaf6ff');
    if (random() < ENEMY[enemy.kind].coreChance) dropCore(enemy.x, enemy.y);
    if (random() < POWERUP.dropChance) dropPowerup(enemy.x, enemy.y);
  }

  function killEnemy(enemy, events) {
    enemy.dead = true;
    burst(enemy.x, enemy.y, enemy.kind === KIND_MITE ? '#ff5d8f'
      : enemy.kind === KIND_DRIFTER ? '#b089ff'
        : enemy.kind === KIND_STINGER ? '#ffb84d' : '#ff3d5e',
    enemy.kind === KIND_DREADNOUGHT ? 60 : 16,
    enemy.kind === KIND_DREADNOUGHT ? 340 : 220);
    state.shake = Math.min(14, state.shake + (enemy.kind === KIND_DREADNOUGHT ? 14 : 4));
    awardKill(enemy);
    if (enemy.kind === KIND_DRIFTER) {
      for (let i = 0; i < 2; i += 1) {
        const mite = spawnEnemy(KIND_MITE, enemy.x + randomRange(random, -14, 14), enemy.y + randomRange(random, -14, 14));
        mite.entering = false;
      }
    }
    if (enemy.kind === KIND_DREADNOUGHT) {
      state.victory = true;
      state.phase = 'done';
      showBanner('DREADNOUGHT DOWN', 3);
      return events | EVENT_BIG_EXPLOSION | EVENT_VICTORY;
    }
    return events | EVENT_EXPLOSION;
  }

  function hurtPlayer(events) {
    const player = state.player;
    if (player.invulnerable > 0 || state.over) return events;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = PLAYER.invulnerableSeconds;
      burst(player.x, player.y, '#57b6ff', 18, 240);
      return events | EVENT_SHIELD_POP;
    }
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerableSeconds;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.min(16, state.shake + 9);
    burst(player.x, player.y, '#3ef2d8', 22, 260);
    if (player.hull <= 0) {
      state.over = true;
      state.phase = 'done';
      burst(player.x, player.y, '#3ef2d8', 60, 340);
      return events | EVENT_PLAYER_HIT | EVENT_BIG_EXPLOSION | EVENT_GAME_OVER;
    }
    return events | EVENT_PLAYER_HIT;
  }

  function stepPlayer(dt, input, events) {
    const player = state.player;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.rapidTimer > 0) player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    if (player.magnetTimer > 0) player.magnetTimer = Math.max(0, player.magnetTimer - dt);
    if (player.fireTimer > 0) player.fireTimer = Math.max(0, player.fireTimer - dt);

    if (input.dash && player.dashCooldown === 0 && player.dashTimer === 0) {
      player.dashTimer = PLAYER.dashSeconds;
      player.dashCooldown = PLAYER.dashCooldown;
      const hasMove = input.moveX !== 0 || input.moveY !== 0;
      player.dashDirectionX = hasMove ? input.moveX : Math.cos(player.angle);
      player.dashDirectionY = hasMove ? input.moveY : Math.sin(player.angle);
      events |= EVENT_DASH;
    }

    if (player.dashTimer > 0) {
      player.dashTimer = Math.max(0, player.dashTimer - dt);
      player.x += player.dashDirectionX * PLAYER.dashSpeed * dt;
      player.y += player.dashDirectionY * PLAYER.dashSpeed * dt;
      if (player.invulnerable < 0.05) player.invulnerable = 0.05;
    } else {
      player.x += input.moveX * PLAYER.speed * dt;
      player.y += input.moveY * PLAYER.speed * dt;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y));
    player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

    if (input.firing && player.fireTimer === 0 && !state.over) {
      player.fireTimer = player.rapidTimer > 0 ? PLAYER.rapidFireInterval : PLAYER.fireInterval;
      state.bullets.push({
        x: player.x + Math.cos(player.angle) * (PLAYER.radius + 6),
        y: player.y + Math.sin(player.angle) * (PLAYER.radius + 6),
        vx: Math.cos(player.angle) * PLAYER.bulletSpeed,
        vy: Math.sin(player.angle) * PLAYER.bulletSpeed,
        age: 0,
      });
      events |= EVENT_SHOT;
    }
    return events;
  }

  function stepEnemies(dt, harmless, events) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.wobble += dt * 3;
      const toPlayerX = player.x - enemy.x;
      const toPlayerY = player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
      const ux = toPlayerX / dist;
      const uy = toPlayerY / dist;

      if (enemy.kind === KIND_MITE) {
        const wobbleX = Math.cos(enemy.wobble) * 26;
        const wobbleY = Math.sin(enemy.wobble * 1.3) * 26;
        enemy.x += (ux * ENEMY.mite.speed + wobbleX) * dt;
        enemy.y += (uy * ENEMY.mite.speed + wobbleY) * dt;
        enemy.angle = Math.atan2(uy, ux);
      } else if (enemy.kind === KIND_DRIFTER) {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.angle += enemy.spin * dt;
        if (enemy.x < -60) enemy.x = FIELD.width + 60;
        if (enemy.x > FIELD.width + 60) enemy.x = -60;
        if (enemy.y < -60) enemy.y = FIELD.height + 60;
        if (enemy.y > FIELD.height + 60) enemy.y = -60;
      } else if (enemy.kind === KIND_STINGER) {
        const strafe = Math.sin(enemy.wobble * 0.6) > 0 ? 1 : -1;
        let radial = 0;
        if (dist > STINGER.preferredRange + 24) radial = 1;
        if (dist < STINGER.preferredRange - 24) radial = -1;
        enemy.x += (ux * radial * ENEMY.stinger.speed + -uy * strafe * STINGER.strafeSpeed) * dt;
        enemy.y += (uy * radial * ENEMY.stinger.speed + ux * strafe * STINGER.strafeSpeed) * dt;
        enemy.angle = Math.atan2(uy, ux);
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && !harmless && !state.over) {
          enemy.shotTimer = STINGER.shotInterval * randomRange(random, 0.85, 1.2);
          state.bolts.push({
            x: enemy.x, y: enemy.y,
            vx: ux * STINGER.boltSpeed, vy: uy * STINGER.boltSpeed,
            radius: STINGER.boltRadius, age: 0,
          });
          events |= EVENT_ENEMY_SHOT;
        }
      } else if (enemy.kind === KIND_DREADNOUGHT) {
        if (enemy.entering) {
          enemy.y += 46 * dt;
          if (enemy.y >= 128) { enemy.y = 128; enemy.entering = false; }
        } else {
          enemy.x = FIELD.width / 2 + Math.sin(state.elapsed * 0.35) * 210;
          enemy.angle += dt * 0.4;
          if (!harmless && !state.over) {
            enemy.radialTimer -= dt;
            enemy.aimedTimer -= dt;
            enemy.miteTimer -= dt;
            if (enemy.radialTimer <= 0) {
              enemy.radialTimer = DREADNOUGHT.radialInterval;
              const offset = random() * TAU;
              for (let i = 0; i < DREADNOUGHT.radialBolts; i += 1) {
                const a = offset + (i / DREADNOUGHT.radialBolts) * TAU;
                state.bolts.push({
                  x: enemy.x, y: enemy.y,
                  vx: Math.cos(a) * DREADNOUGHT.boltSpeed,
                  vy: Math.sin(a) * DREADNOUGHT.boltSpeed,
                  radius: STINGER.boltRadius, age: 0,
                });
              }
              events |= EVENT_ENEMY_SHOT;
            }
            if (enemy.aimedTimer <= 0) {
              enemy.aimedTimer = DREADNOUGHT.aimedInterval;
              for (const spread of [-0.14, 0, 0.14]) {
                const a = Math.atan2(uy, ux) + spread;
                state.bolts.push({
                  x: enemy.x, y: enemy.y,
                  vx: Math.cos(a) * (DREADNOUGHT.boltSpeed + 60),
                  vy: Math.sin(a) * (DREADNOUGHT.boltSpeed + 60),
                  radius: STINGER.boltRadius, age: 0,
                });
              }
              events |= EVENT_ENEMY_SHOT;
            }
            if (enemy.miteTimer <= 0) {
              enemy.miteTimer = DREADNOUGHT.miteInterval;
              spawnEnemy(KIND_MITE, enemy.x - 40, enemy.y + 30).entering = false;
              spawnEnemy(KIND_MITE, enemy.x + 40, enemy.y + 30).entering = false;
            }
          }
        }
      }

      if (!harmless && !state.over && circlesTouch(enemy.x, enemy.y, enemy.radius * 0.85, player.x, player.y, PLAYER.radius)) {
        if (enemy.kind !== KIND_DREADNOUGHT) {
          events = killEnemy(enemy, events) & ~EVENT_EXPLOSION;
          burst(enemy.x, enemy.y, '#ff5d8f', 12, 200);
        }
        events = hurtPlayer(events);
      }
    }
    return events;
  }

  function stepProjectiles(dt, harmless, events) {
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.age += dt;
      if (bullet.age > 1.4 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        continue;
      }
      if (harmless) continue;
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (circlesTouch(bullet.x, bullet.y, PLAYER.bulletRadius, enemy.x, enemy.y, enemy.radius)) {
          bullet.dead = true;
          enemy.hull -= 1;
          enemy.flash = 0.09;
          burst(bullet.x, bullet.y, '#aefcff', 3, 140);
          if (enemy.hull <= 0) events = killEnemy(enemy, events);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.enemies = state.enemies.filter((e) => !e.dead);

    const player = state.player;
    for (const bolt of state.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.age += dt;
      if (bolt.age > 5 || bolt.x < -24 || bolt.x > FIELD.width + 24 || bolt.y < -24 || bolt.y > FIELD.height + 24) {
        bolt.dead = true;
        continue;
      }
      if (!harmless && !state.over && player.dashTimer === 0
        && circlesTouch(bolt.x, bolt.y, bolt.radius, player.x, player.y, PLAYER.radius)) {
        bolt.dead = true;
        events = hurtPlayer(events);
      }
    }
    state.bolts = state.bolts.filter((b) => !b.dead);
    return events;
  }

  function stepPickups(dt, events) {
    const player = state.player;
    const magnetOn = player.magnetTimer > 0;
    for (const core of state.cores) {
      core.age += dt;
      core.x += core.vx * dt;
      core.y += core.vy * dt;
      core.vx *= 0.98;
      core.vy *= 0.98;
      const near = distanceSquared(core.x, core.y, player.x, player.y);
      if (!state.over && (magnetOn || near < CORE.magnetRadius * CORE.magnetRadius)) {
        const dist = Math.max(1, Math.sqrt(near));
        core.x += ((player.x - core.x) / dist) * CORE.magnetSpeed * dt;
        core.y += ((player.y - core.y) / dist) * CORE.magnetSpeed * dt;
      }
      if (!state.over && near < CORE.collectRadius * CORE.collectRadius) {
        core.dead = true;
        state.coresCollected += 1;
        state.salvageProgress += 1;
        state.score += CORE.points;
        addFloater(core.x, core.y - 12, `+${CORE.points}`, '#ffd94d');
        burst(core.x, core.y, '#ffd94d', 6, 130);
        events |= EVENT_CORE;
        if (state.salvageProgress >= SALVAGE.coresPerBonus) {
          state.salvageProgress = 0;
          state.score += SALVAGE.bonusPoints;
          if (player.hull < PLAYER.maxHull) player.hull += 1;
          addFloater(player.x, player.y - 34, `SALVAGE BONUS +${SALVAGE.bonusPoints}`, '#7dff9a');
          events |= EVENT_SALVAGE_BONUS;
        }
      }
      if (core.age > CORE.lifetimeSeconds) core.dead = true;
    }
    state.cores = state.cores.filter((c) => !c.dead);

    for (const powerup of state.powerups) {
      powerup.age += dt;
      if (powerup.age > POWERUP.lifetimeSeconds) { powerup.dead = true; continue; }
      if (!state.over && circlesTouch(powerup.x, powerup.y, POWERUP.radius, player.x, player.y, PLAYER.radius + 6)) {
        powerup.dead = true;
        applyPowerup(powerup.kind);
        events |= EVENT_POWERUP;
      }
    }
    state.powerups = state.powerups.filter((p) => !p.dead);
    return events;
  }

  function applyPowerup(kind) {
    const player = state.player;
    if (kind === 'shield') player.shield = true;
    if (kind === 'rapid') player.rapidTimer = POWERUP.rapidSeconds;
    if (kind === 'magnet') player.magnetTimer = POWERUP.magnetSeconds;
    if (kind === 'repair') player.hull = Math.min(PLAYER.maxHull, player.hull + 1);
    const label = { shield: 'SHIELD UP', rapid: 'RAPID FIRE', magnet: 'CORE MAGNET', repair: 'HULL +1' }[kind];
    addFloater(player.x, player.y - 34, label, '#eaf6ff');
    burst(player.x, player.y, '#eaf6ff', 12, 180);
  }

  function stepEffects(dt) {
    for (const particle of state.particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
    }
    state.particles = state.particles.filter((p) => p.age < p.life);
    for (const floater of state.floaters) {
      floater.age += dt;
      floater.y -= 34 * dt;
    }
    state.floaters = state.floaters.filter((f) => f.age < f.life);
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  }

  function step(dt, input, harmless = false) {
    let events = 0;
    state.elapsed += dt;

    if (state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0) state.combo = 0;
    }

    // Wave flow: intermission -> spawning -> combat -> next intermission.
    if (!state.over && !state.victory) {
      if (state.phase === 'intermission') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) events |= beginWave(state.wave + 1);
      } else if (state.phase === 'spawning') {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
          state.spawnTimer = WAVE.spawnGapSeconds;
          const kind = state.spawnQueue.shift();
          const point = edgeSpawnPoint();
          spawnEnemy(kind, point.x, point.y);
        }
        if (state.spawnQueue.length === 0) state.phase = 'combat';
      } else if (state.phase === 'combat' && state.enemies.length === 0) {
        state.phase = 'intermission';
        state.phaseTimer = WAVE.intermissionSeconds;
        showBanner('WAVE CLEAR', 1.6);
      }
    }

    if (!state.over) events = stepPlayer(dt, input, events);
    events = stepEnemies(dt, harmless, events);
    events = stepProjectiles(dt, harmless, events);
    if (!harmless) events = stepPickups(dt, events);
    stepEffects(dt);
    return events;
  }

  reset();
  return { state, reset, step, comboMultiplier, spawnEnemy, showBanner };
}
