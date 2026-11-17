// Synthesised sound: every effect is an oscillator blip shaped by hand, so the
// game needs no audio files. A quiet two-note bass pulse loops underneath the
// action. The context is created lazily on the first user gesture, and every
// call is safe before that (it simply stays silent).

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensureContext() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return true;
  }

  /** One shaped tone. `slideTo` bends the pitch across the tone's life. */
  function tone({ type = 'square', from = 440, slideTo = null, seconds = 0.12, volume = 0.16, delay = 0 }) {
    if (!ensureContext()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  /** A burst of filtered noise, for explosions and hull hits. */
  function noise({ seconds = 0.25, volume = 0.22, delay = 0, low = 400, high = 2400 }) {
    if (!ensureContext()) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(high, start);
    filter.frequency.exponentialRampToValueAtTime(low, start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  const shoot = () => tone({ type: 'square', from: 880, slideTo: 320, seconds: 0.07, volume: 0.05 });
  const enemyShoot = () => tone({ type: 'sawtooth', from: 300, slideTo: 180, seconds: 0.1, volume: 0.045 });
  const explosion = (big) => {
    noise({ seconds: big ? 0.5 : 0.25, volume: big ? 0.3 : 0.18, high: big ? 1600 : 2400 });
    tone({ type: 'triangle', from: big ? 160 : 220, slideTo: 40, seconds: big ? 0.45 : 0.22, volume: 0.2 });
  };
  const pickup = () => {
    tone({ type: 'sine', from: 660, seconds: 0.07, volume: 0.12 });
    tone({ type: 'sine', from: 990, seconds: 0.1, volume: 0.12, delay: 0.06 });
  };
  const powerup = () => {
    tone({ type: 'triangle', from: 523, seconds: 0.09, volume: 0.14 });
    tone({ type: 'triangle', from: 659, seconds: 0.09, volume: 0.14, delay: 0.08 });
    tone({ type: 'triangle', from: 784, seconds: 0.14, volume: 0.14, delay: 0.16 });
  };
  const playerHit = () => {
    noise({ seconds: 0.3, volume: 0.26, low: 200, high: 1200 });
    tone({ type: 'sawtooth', from: 200, slideTo: 60, seconds: 0.3, volume: 0.2 });
  };
  const shieldPop = () => tone({ type: 'sine', from: 1200, slideTo: 500, seconds: 0.16, volume: 0.16 });
  const dash = () => noise({ seconds: 0.16, volume: 0.1, low: 900, high: 3000 });
  const waveHorn = () => {
    tone({ type: 'sawtooth', from: 196, seconds: 0.28, volume: 0.1 });
    tone({ type: 'sawtooth', from: 294, seconds: 0.34, volume: 0.1, delay: 0.12 });
  };
  const salvageBonus = () => {
    tone({ type: 'sine', from: 784, seconds: 0.1, volume: 0.14 });
    tone({ type: 'sine', from: 1046, seconds: 0.16, volume: 0.14, delay: 0.09 });
  };
  const gameOver = () => {
    tone({ type: 'triangle', from: 392, seconds: 0.3, volume: 0.16 });
    tone({ type: 'triangle', from: 311, seconds: 0.3, volume: 0.16, delay: 0.28 });
    tone({ type: 'triangle', from: 233, seconds: 0.6, volume: 0.16, delay: 0.56 });
  };
  const victory = () => {
    const notes = [523, 659, 784, 1046];
    notes.forEach((note, i) => tone({ type: 'triangle', from: note, seconds: 0.22, volume: 0.15, delay: i * 0.13 }));
  };
  const uiConfirm = () => tone({ type: 'sine', from: 740, seconds: 0.06, volume: 0.1 });

  /** The understated pulse that runs while a run is live. */
  function startMusic() {
    if (!ensureContext() || musicTimer !== null) return;
    const bassLine = [55, 55, 82.4, 55, 65.4, 55, 98, 73.4];
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = bassLine[musicStep % bassLine.length];
      musicStep += 1;
      tone({ type: 'triangle', from: note, seconds: 0.22, volume: 0.07 });
      if (musicStep % 4 === 0) tone({ type: 'sine', from: note * 4, seconds: 0.3, volume: 0.025 });
    }, 240);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    unlock: ensureContext,
    shoot, enemyShoot, explosion, pickup, powerup, playerHit, shieldPop,
    dash, waveHorn, salvageBonus, gameOver, victory, uiConfirm,
    startMusic, stopMusic, toggleMute,
    isMuted: () => muted,
  };
}
