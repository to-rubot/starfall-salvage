// STARFALL SALVAGE — tuning constants. Every number that shapes how the game
// feels lives here so the world, the renderer and the screenshot stager all
// agree on the same field, speeds and wave plan.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds. The world only ever advances by this. */
export const STEP = 1 / 120;

export const PLAYER = {
  radius: 14,
  speed: 272,
  maxHull: 5,
  fireInterval: 0.17,
  rapidFireInterval: 0.085,
  bulletSpeed: 640,
  bulletRadius: 4,
  invulnerableSeconds: 1.25,
  dashSeconds: 0.16,
  dashCooldown: 1.5,
  dashSpeed: 780,
};

export const COMBO = {
  windowSeconds: 3,
  killsPerTier: 4,
  maxMultiplier: 8,
};

export const SALVAGE = {
  coresPerBonus: 10,
  bonusPoints: 300,
};

export const ENEMY = {
  mite: { radius: 12, hull: 1, speed: 128, points: 40, coreChance: 0.5 },
  drifter: { radius: 27, hull: 4, speed: 46, points: 90, coreChance: 1 },
  stinger: { radius: 16, hull: 2, speed: 96, points: 120, coreChance: 0.8 },
  dreadnought: { radius: 56, hull: 90, speed: 30, points: 2000, coreChance: 1 },
};

export const STINGER = {
  preferredRange: 265,
  strafeSpeed: 62,
  shotInterval: 2.3,
  boltSpeed: 300,
  boltRadius: 5,
};

export const DREADNOUGHT = {
  radialInterval: 2.6,
  radialBolts: 10,
  aimedInterval: 1.15,
  miteInterval: 4.5,
  boltSpeed: 250,
};

export const CORE = {
  radius: 9,
  lifetimeSeconds: 12,
  blinkSeconds: 3,
  points: 25,
  magnetRadius: 120,
  magnetSpeed: 340,
  collectRadius: 30,
};

export const POWERUP = {
  radius: 12,
  dropChance: 0.13,
  lifetimeSeconds: 10,
  rapidSeconds: 8,
  magnetSeconds: 9,
  kinds: ['shield', 'rapid', 'magnet', 'repair'],
};

/** The last wave. Clearing it means beating the Dreadnought: a win. */
export const FINAL_WAVE = 8;

export const WAVE = {
  intermissionSeconds: 2.6,
  spawnGapSeconds: 0.55,
  /** Enemy mix per wave; the Dreadnought arrives alone in the final wave. */
  plan: [
    null,
    { mite: 5, drifter: 1, stinger: 0 },
    { mite: 7, drifter: 2, stinger: 1 },
    { mite: 9, drifter: 2, stinger: 2 },
    { mite: 11, drifter: 3, stinger: 3 },
    { mite: 13, drifter: 4, stinger: 3 },
    { mite: 15, drifter: 4, stinger: 4 },
    { mite: 17, drifter: 5, stinger: 5 },
    { mite: 0, drifter: 0, stinger: 0 },
  ],
};

export const COLORS = {
  space: '#070b1d',
  spaceDeep: '#04060f',
  star: '#cfe8ff',
  ship: '#3ef2d8',
  shipAccent: '#eafffb',
  bullet: '#aefcff',
  bolt: '#ff5d8f',
  mite: '#ff5d8f',
  drifter: '#b089ff',
  stinger: '#ffb84d',
  dreadnought: '#ff3d5e',
  core: '#ffd94d',
  shield: '#57b6ff',
  rapid: '#ff8a5c',
  magnet: '#7dff9a',
  repair: '#ff7dd6',
  text: '#eaf6ff',
  dimText: '#8fb4d8',
  panel: 'rgba(8, 16, 36, 0.82)',
  panelEdge: '#2b5f8a',
};
