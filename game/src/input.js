// Keyboard and mouse input. Movement comes from WASD or the arrow keys, the
// aim point follows the mouse, firing is the mouse button or Space, and the
// dash is Shift. One-shot presses (confirm, pause, mute) are queued as named
// actions so the main loop can consume each press exactly once.

import { FIELD } from './config.js';

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const ACTION_KEYS = {
  Enter: 'confirm',
  KeyR: 'restart',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  const actions = [];
  const state = {
    aimX: FIELD.width / 2,
    aimY: FIELD.height / 3,
    firing: false,
    dashHeld: false,
  };
  let dashQueued = false;

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      held[move] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      state.firing = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (!event.repeat) dashQueued = true;
      state.dashHeld = true;
      return;
    }
    const action = ACTION_KEYS[event.code];
    if (action && !event.repeat) actions.push(action);
    if (action === 'confirm' && !event.repeat) actions.push('confirmKey');
  });

  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) held[move] = false;
    if (event.code === 'Space') state.firing = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') state.dashHeld = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event.clientX, event.clientY);
    state.aimX = point.x;
    state.aimY = point.y;
  });

  canvas.addEventListener('mousedown', (event) => {
    const point = toField(event.clientX, event.clientY);
    state.aimX = point.x;
    state.aimY = point.y;
    if (event.button === 0) {
      state.firing = true;
      actions.push('confirm');
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });

  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const point = toField(touch.clientX, touch.clientY);
    state.aimX = point.x;
    state.aimY = point.y;
    state.firing = true;
    actions.push('confirm');
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const point = toField(touch.clientX, touch.clientY);
    state.aimX = point.x;
    state.aimY = point.y;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', () => { state.firing = false; });

  /** The current movement vector, normalised: x and y each in [-1, 1]. */
  function moveVector() {
    const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (x !== 0 && y !== 0) return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 };
    return { x, y };
  }

  /** True once per Shift press. */
  function consumeDash() {
    const was = dashQueued;
    dashQueued = false;
    return was;
  }

  /** Pop the next queued one-shot action ('confirm', 'restart', ...), or null. */
  function consumeAction() {
    return actions.length > 0 ? actions.shift() : null;
  }

  return { state, moveVector, consumeDash, consumeAction };
}
