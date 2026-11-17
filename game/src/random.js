// A tiny seeded random source (mulberry32). The live game seeds it from the
// clock; the screenshot scenes seed it with a fixed number so the same scene
// renders identically on every visit.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** Random integer in [min, max], both ends included. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one entry of a non-empty array. */
export function randomPick(random, entries) {
  return entries[Math.floor(random() * entries.length)];
}
