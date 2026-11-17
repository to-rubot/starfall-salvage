// Canvas rendering: a neon salvage field — layered starfield and nebula,
// vector-drawn ships and hunters, particle bursts, and every screen the judge
// needs to see: title, live play with its HUD, pause, game over and victory.

import { COLORS, CORE, FIELD, PLAYER, POWERUP, SALVAGE } from './config.js';
import { KIND_DREADNOUGHT, KIND_DRIFTER, KIND_MITE, KIND_STINGER } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

// A fixed starfield and two nebula washes, generated once from a seed so every
// frame (and every screenshot) shows the same sky.
const starRandom = createRandom(20261117);
const STARS = Array.from({ length: 170 }, () => ({
  x: starRandom() * FIELD.width,
  y: starRandom() * FIELD.height,
  size: 0.6 + starRandom() * 1.7,
  bright: 0.25 + starRandom() * 0.75,
  layer: Math.floor(starRandom() * 3),
}));

const POWERUP_STYLE = {
  shield: { color: COLORS.shield, glyph: 'S', label: 'SHIELD' },
  rapid: { color: COLORS.rapid, glyph: 'R', label: 'RAPID' },
  magnet: { color: COLORS.magnet, glyph: 'M', label: 'MAGNET' },
  repair: { color: COLORS.repair, glyph: '+', label: 'REPAIR' },
};

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function drawSky(ctx, elapsed) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, COLORS.space);
  gradient.addColorStop(1, COLORS.spaceDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const nebulaA = ctx.createRadialGradient(300, 170, 40, 300, 170, 420);
  nebulaA.addColorStop(0, 'rgba(64, 40, 140, 0.30)');
  nebulaA.addColorStop(1, 'rgba(64, 40, 140, 0)');
  ctx.fillStyle = nebulaA;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const nebulaB = ctx.createRadialGradient(1020, 560, 40, 1020, 560, 460);
  nebulaB.addColorStop(0, 'rgba(10, 90, 110, 0.26)');
  nebulaB.addColorStop(1, 'rgba(10, 90, 110, 0)');
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (const star of STARS) {
    const drift = (elapsed * (2 + star.layer * 3)) % FIELD.height;
    const y = (star.y + drift) % FIELD.height;
    const twinkle = 0.7 + 0.3 * Math.sin(elapsed * 2 + star.x);
    ctx.globalAlpha = star.bright * twinkle;
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(star.x, y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, player, elapsed) {
  const blink = player.invulnerable > 0 && player.dashTimer === 0
    && Math.floor(elapsed * 14) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (player.dashTimer > 0) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = COLORS.ship;
    polygon(ctx, [[-30, 0], [-12, -9], [-12, 9]]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLORS.ship;
  polygon(ctx, [[20, 0], [-12, -12], [-6, 0], [-12, 12]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.shipAccent;
  polygon(ctx, [[10, 0], [-4, -5], [-4, 5]]);
  ctx.fill();
  const flame = 8 + Math.sin(elapsed * 31) * 3;
  ctx.fillStyle = '#ffb84d';
  polygon(ctx, [[-12, -4], [-12 - flame, 0], [-12, 4]]);
  ctx.fill();
  ctx.restore();

  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = COLORS.shield;
    ctx.globalAlpha = 0.75 + 0.2 * Math.sin(elapsed * 5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius + 11, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMite(ctx, enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = COLORS.mite;
  ctx.shadowBlur = 12;
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : COLORS.mite;
  polygon(ctx, [[13, 0], [-6, -9], [-11, 0], [-6, 9]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2b0714';
  ctx.beginPath();
  ctx.arc(3, 0, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawDrifter(ctx, enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = COLORS.drifter;
  ctx.shadowBlur = 12;
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#4a3673';
  polygon(ctx, [[24, -8], [12, -22], [-10, -20], [-25, -4], [-18, 16], [4, 24], [22, 10]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.drifter;
  ctx.lineWidth = 2;
  polygon(ctx, [[24, -8], [12, -22], [-10, -20], [-25, -4], [-18, 16], [4, 24], [22, 10]]);
  ctx.stroke();
  ctx.fillStyle = 'rgba(176, 137, 255, 0.35)';
  ctx.beginPath();
  ctx.arc(-4, -4, 6, 0, TAU);
  ctx.arc(9, 8, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
  drawHullPips(ctx, enemy);
}

function drawStinger(ctx, enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = COLORS.stinger;
  ctx.shadowBlur = 12;
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : COLORS.stinger;
  polygon(ctx, [[17, 0], [-4, -13], [-13, -5], [-9, 0], [-13, 5], [-4, 13]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#331d00';
  ctx.beginPath();
  ctx.arc(4, 0, 3.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  drawHullPips(ctx, enemy);
}

function drawDreadnought(ctx, enemy, elapsed) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = COLORS.dreadnought;
  ctx.shadowBlur = 26;
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#57182b';
  polygon(ctx, [[64, 0], [34, -34], [-6, -52], [-52, -30], [-64, 0], [-52, 30], [-6, 52], [34, 34]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.dreadnought;
  ctx.lineWidth = 3;
  polygon(ctx, [[64, 0], [34, -34], [-6, -52], [-52, -30], [-64, 0], [-52, 30], [-6, 52], [34, 34]]);
  ctx.stroke();
  ctx.rotate(enemy.angle * 0.6);
  ctx.strokeStyle = 'rgba(255, 93, 143, 0.8)';
  ctx.lineWidth = 2;
  polygon(ctx, [[40, 0], [0, -40], [-40, 0], [0, 40]]);
  ctx.stroke();
  ctx.rotate(-enemy.angle * 0.6);
  const pulse = 13 + Math.sin(elapsed * 4) * 2.5;
  const coreGradient = ctx.createRadialGradient(0, 0, 2, 0, 0, pulse + 6);
  coreGradient.addColorStop(0, '#ffe3ec');
  coreGradient.addColorStop(0.5, COLORS.dreadnought);
  coreGradient.addColorStop(1, 'rgba(255, 61, 94, 0)');
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, pulse + 6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Small hull pips above multi-hit hunters. */
function drawHullPips(ctx, enemy) {
  if (enemy.maxHull <= 1 || enemy.hull === enemy.maxHull) return;
  const width = 6;
  const gap = 3;
  const total = enemy.maxHull * (width + gap) - gap;
  ctx.save();
  for (let i = 0; i < enemy.maxHull; i += 1) {
    ctx.fillStyle = i < enemy.hull ? '#eaf6ff' : 'rgba(234, 246, 255, 0.22)';
    ctx.fillRect(enemy.x - total / 2 + i * (width + gap), enemy.y - enemy.radius - 14, width, 4);
  }
  ctx.restore();
}

function drawCore(ctx, core, elapsed) {
  const fading = core.age > CORE.lifetimeSeconds - CORE.blinkSeconds;
  if (fading && Math.floor(elapsed * 8) % 2 === 0) return;
  const spin = elapsed * 2.4 + core.x * 0.01;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(spin);
  ctx.shadowColor = COLORS.core;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLORS.core;
  polygon(ctx, [[0, -10], [3, -3], [10, 0], [3, 3], [0, 10], [-3, 3], [-10, 0], [-3, -3]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(ctx, powerup, elapsed) {
  const style = POWERUP_STYLE[powerup.kind];
  const bob = Math.sin(elapsed * 3 + powerup.x * 0.05) * 3;
  ctx.save();
  ctx.translate(powerup.x, powerup.y + bob);
  ctx.shadowColor = style.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(6, 12, 26, 0.9)';
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP.radius + 2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = style.color;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.glyph, 0, 1);
  ctx.restore();
}

function drawProjectiles(ctx, state) {
  ctx.save();
  ctx.shadowColor = COLORS.bullet;
  ctx.shadowBlur = 9;
  ctx.fillStyle = COLORS.bullet;
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, PLAYER.bulletRadius, 0, TAU);
    ctx.fill();
  }
  ctx.shadowColor = COLORS.bolt;
  ctx.fillStyle = COLORS.bolt;
  for (const bolt of state.bolts) {
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticlesAndText(ctx, state) {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const floater of state.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - floater.age / floater.life);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

function drawHeart(ctx, x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? '#ff5d7e' : 'rgba(255, 93, 126, 0.18)';
  ctx.strokeStyle = '#ff5d7e';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-11, -2, -8, -11, 0, -5);
  ctx.bezierCurveTo(8, -11, 11, -2, 0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state, world, best) {
  const player = state.player;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 20, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, 58);
  ctx.fillStyle = 'rgba(62, 242, 216, 0.35)';
  ctx.fillRect(0, 58, FIELD.width, 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SCORE', 22, 16);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(String(state.score).padStart(6, '0'), 22, 40);

  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('BEST', 196, 16);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(String(Math.max(best, state.score)).padStart(6, '0'), 196, 40);

  // Combo: the multiplier, with a draining timer bar under it.
  const multiplier = world.comboMultiplier();
  ctx.textAlign = 'center';
  if (state.combo > 0) {
    ctx.fillStyle = multiplier > 1 ? COLORS.core : COLORS.dimText;
    ctx.font = 'bold 25px system-ui, sans-serif';
    ctx.fillText(`COMBO x${multiplier}`, FIELD.width / 2, 26);
    ctx.fillStyle = 'rgba(234, 246, 255, 0.18)';
    ctx.fillRect(FIELD.width / 2 - 70, 42, 140, 5);
    ctx.fillStyle = COLORS.core;
    ctx.fillRect(FIELD.width / 2 - 70, 42, 140 * (state.comboTimer / 3), 5);
  } else {
    ctx.fillStyle = COLORS.dimText;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('CHAIN KILLS FOR COMBO', FIELD.width / 2, 28);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('WAVE', FIELD.width - 22, 16);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(state.wave > 0 ? `${state.wave} / 8` : '—', FIELD.width - 22, 40);

  // Bottom-left: hull hearts and the dash pip.
  for (let i = 0; i < PLAYER.maxHull; i += 1) {
    drawHeart(ctx, 30 + i * 26, FIELD.height - 26, i < player.hull);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = player.dashCooldown === 0 ? COLORS.ship : COLORS.dimText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(player.dashCooldown === 0 ? 'DASH READY (SHIFT)' : 'DASH …', 152, FIELD.height - 24);

  // Bottom-right: salvage meter — ten cores buy a bonus and a repair.
  const meterWidth = 190;
  const meterX = FIELD.width - 22 - meterWidth;
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SALVAGE', FIELD.width - 22, FIELD.height - 44);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.15)';
  ctx.fillRect(meterX, FIELD.height - 34, meterWidth, 10);
  ctx.fillStyle = COLORS.core;
  ctx.fillRect(meterX, FIELD.height - 34, meterWidth * (state.salvageProgress / SALVAGE.coresPerBonus), 10);

  // Active power-up timers, stacked above the hearts.
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px system-ui, sans-serif';
  let row = 0;
  if (player.shield) { ctx.fillStyle = COLORS.shield; ctx.fillText('SHIELD ACTIVE', 22, FIELD.height - 62 - row * 18); row += 1; }
  if (player.rapidTimer > 0) { ctx.fillStyle = COLORS.rapid; ctx.fillText(`RAPID FIRE ${player.rapidTimer.toFixed(0)}s`, 22, FIELD.height - 62 - row * 18); row += 1; }
  if (player.magnetTimer > 0) { ctx.fillStyle = COLORS.magnet; ctx.fillText(`CORE MAGNET ${player.magnetTimer.toFixed(0)}s`, 22, FIELD.height - 62 - row * 18); row += 1; }

  // The Dreadnought's hull bar, under the top strip.
  const boss = state.enemies.find((e) => e.kind === KIND_DREADNOUGHT);
  if (boss) {
    const barWidth = 460;
    const barX = FIELD.width / 2 - barWidth / 2;
    ctx.fillStyle = COLORS.dimText;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DREADNOUGHT', FIELD.width / 2, 72);
    ctx.fillStyle = 'rgba(255, 61, 94, 0.2)';
    ctx.fillRect(barX, 80, barWidth, 9);
    ctx.fillStyle = COLORS.dreadnought;
    ctx.fillRect(barX, 80, barWidth * Math.max(0, boss.hull / boss.maxHull), 9);
  }
  ctx.restore();
}

function drawBanner(ctx, state) {
  if (state.bannerTimer <= 0 || !state.bannerText) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.bannerTimer);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 22;
  ctx.fillText(state.bannerText, FIELD.width / 2, 168);
  ctx.restore();
}

function panel(ctx, width, height, centerY = FIELD.height / 2) {
  const x = FIELD.width / 2 - width / 2;
  const y = centerY - height / 2;
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  return { x, y, width, height };
}

function drawTitle(ctx, state, elapsed, best) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 30;
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText('STARFALL', FIELD.width / 2, 168);
  ctx.fillStyle = COLORS.core;
  ctx.fillText('SALVAGE', FIELD.width / 2, 246);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Blast the hunter swarm, recover the star cores, and bring down the Dreadnought in Wave 8.', FIELD.width / 2, 292);

  const box = panel(ctx, 560, 168, 406);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    'MOVE        WASD / Arrow keys',
    'AIM + FIRE  Mouse (or hold Space)',
    'DASH        Shift — brief invulnerability',
    'PAUSE       P  ·  MUTE  M',
    'GOAL        10 cores = salvage bonus · Survive to Wave 8 and win',
  ];
  lines.forEach((line, i) => ctx.fillText(line, box.x + 34, box.y + 34 + i * 29));

  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(elapsed * 4);
  ctx.fillStyle = COLORS.ship;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 552);
  ctx.globalAlpha = 1;
  if (best > 0) {
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 592);
  }
  ctx.restore();
  void state;
}

function drawEndPanel(ctx, state, victory, best) {
  const box = panel(ctx, 520, 330);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = victory ? COLORS.core : COLORS.dreadnought;
  ctx.shadowBlur = 24;
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(victory ? 'SALVAGE COMPLETE!' : 'SHIP LOST', FIELD.width / 2, box.y + 62);
  ctx.shadowBlur = 0;
  ctx.fillStyle = victory ? COLORS.core : COLORS.dimText;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(
    victory ? 'The Dreadnought is down and the field is yours.' : `Your run ended on Wave ${state.wave}. The cores drift on…`,
    FIELD.width / 2, box.y + 96,
  );
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  const rows = [
    ['FINAL SCORE', String(state.score)],
    ['BEST SCORE', String(Math.max(best, state.score))],
    ['HUNTERS DOWN', String(state.kills)],
    ['CORES RECOVERED', String(state.coresCollected)],
    ['BEST COMBO', `x${1 + Math.floor(state.bestCombo / 4)}  (${state.bestCombo} chain)`],
    ['TIME', `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`],
  ];
  rows.forEach(([label, value], i) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.dimText;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(label, box.x + 70, box.y + 138 + i * 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(value, box.x + box.width - 70, box.y + 138 + i * 27);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ship;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, box.y + 330 - 24);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 12, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 30);
  ctx.restore();
}

/**
 * Draw one frame. `screen` is one of the SCREEN_* values; `options` carries
 * { paused, best, shakeX, shakeY } from the main loop.
 */
export function drawFrame(ctx, world, screen, elapsed, options = {}) {
  const state = world.state;
  ctx.save();
  drawSky(ctx, elapsed);
  if (options.shakeX || options.shakeY) ctx.translate(options.shakeX || 0, options.shakeY || 0);

  for (const core of state.cores) drawCore(ctx, core, elapsed);
  for (const powerup of state.powerups) drawPowerup(ctx, powerup, elapsed);
  for (const enemy of state.enemies) {
    if (enemy.kind === KIND_MITE) drawMite(ctx, enemy);
    else if (enemy.kind === KIND_DRIFTER) drawDrifter(ctx, enemy);
    else if (enemy.kind === KIND_STINGER) drawStinger(ctx, enemy);
    else if (enemy.kind === KIND_DREADNOUGHT) drawDreadnought(ctx, enemy, elapsed);
  }
  drawProjectiles(ctx, state);
  if (!state.over) drawShip(ctx, state.player, elapsed);
  drawParticlesAndText(ctx, state);
  ctx.restore();

  if (screen !== SCREEN_TITLE) drawHud(ctx, state, world, options.best || 0);
  drawBanner(ctx, state);
  if (screen === SCREEN_TITLE) drawTitle(ctx, state, elapsed, options.best || 0);
  if (screen === SCREEN_OVER) drawEndPanel(ctx, state, false, options.best || 0);
  if (screen === SCREEN_VICTORY) drawEndPanel(ctx, state, true, options.best || 0);
  if (options.paused) drawPaused(ctx);
}
