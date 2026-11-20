/**
 * src/demoMode.js — Chrono Lab automated Demo mode.
 *
 * "Watch Demo" plays a short, fully scripted run of the real game so a viewer
 * can see the core loop (record → rewind → cooperate with your echo) without
 * knowing the controls.
 *
 * The demo does not teleport the player and does not fake anything: it drives
 * the *real* player controller by dispatching the same keyboard events a human
 * would send, and it steers toward waypoints using the live player position, so
 * movement, collision, door logic and echo replay all run through production
 * code paths.
 *
 * Member C — AI REQUIRED / AI ALLOWED
 */

/* ------------------------------------------------------------------ *
 * Level coordinates used by the route. Kept local so the demo reads as a
 * self-contained script; they mirror src/level.js.
 * ------------------------------------------------------------------ */
const ROUTE_CONSTANTS = {
  door: 12,
  core1: 13.5,
  plateZ: 8,
  plateX: 6,
};

/* ------------------------------------------------------------------ *
 * Key synthesis
 * ------------------------------------------------------------------ */

const held = new Set();

function setKey(code, on) {
  if (on && !held.has(code)) {
    held.add(code);
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  } else if (!on && held.has(code)) {
    held.delete(code);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }
}

function releaseAllKeys() {
  for (const code of [...held]) setKey(code, false);
}

/**
 * Movement is world-axis (see src/player.js):
 *   W → +Z, S → -Z, A → +X, D → -X
 * Returns true once the waypoint tolerance is met.
 */
function steerToward(x, z, tolerance) {
  const position = window.chronoLab?.player?.position;
  if (!position) return true;

  const dx = x - position.x;
  const dz = z - position.z;
  if (Math.hypot(dx, dz) <= tolerance) {
    setKey('KeyW', false);
    setKey('KeyS', false);
    setKey('KeyA', false);
    setKey('KeyD', false);
    return true;
  }

  setKey('KeyW', dz > 0.1);
  setKey('KeyS', dz < -0.1);
  setKey('KeyA', dx > 0.1);
  setKey('KeyD', dx < -0.1);
  return false;
}

/* ------------------------------------------------------------------ *
 * Route
 * ------------------------------------------------------------------ */

/**
 * One beat is one of:
 *   { move: [x, z], text?, timeout? }  walk to a waypoint
 *   { key: 'KeyR', text?, hold? }      press and release a key
 *   { wait: seconds, text? }           pause
 *   { text, seconds }                  narration only
 *   { end: true }
 */
function buildRoute() {
  const { plateX, plateZ, door, core1 } = ROUTE_CONSTANTS;
  return [
    { text: 'Chrono Lab — a temporal research facility.', seconds: 2.4 },
    { move: [0, -1.5], text: 'W A S D to move through the lab.', timeout: 4 },

    // Record a path onto the first pressure plate.
    { move: [-plateX, plateZ], text: 'Stand on a pressure plate…', timeout: 9 },
    { wait: 0.9 },
    { key: 'KeyR', text: 'Press R — rewind time and leave an echo behind.' },
    { text: 'Your echo retraces your steps.', seconds: 2.2 },
    { wait: 1.8 },

    // Take the second plate yourself so both are held at once.
    { move: [plateX, plateZ], text: 'Walk to the matching plate — your past self holds this one.', timeout: 10 },
    { wait: 1.2, text: 'Both plates active. The sync gate opens.' },
    { wait: 0.6 },

    // Through the gate and take the first time core.
    { move: [0, door + 0.6], timeout: 7 },
    { move: [0, core1], text: 'Cross the gate.', timeout: 6 },
    { key: 'KeyE', text: 'Press E to collect a time core.' },
    { wait: 1.4 },
    { text: 'Chrono Lab: Echoes of Time — press START to play.', seconds: 3.0 },
    { end: true },
  ];
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

let active = false;
let frameHandle = null;
let timerHandle = null;
let beatStartedAt = 0;

function clearTimers() {
  if (frameHandle !== null) {
    cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }
  if (timerHandle !== null) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
}

/** @returns {boolean} whether the demo is currently playing. */
export function isDemoActive() {
  return active;
}

/**
 * Start the scripted demo.
 * @param {{ onText?: (text: string) => void, onEnd?: () => void }} handlers
 */
export function startDemo({ onText = () => {}, onEnd = () => {} } = {}) {
  if (active) return;
  active = true;

  // Enter through the normal start path so every subsystem is production-like.
  document.querySelector('#start')?.click();

  const route = buildRoute();
  let index = 0;

  const finish = () => {
    active = false;
    clearTimers();
    releaseAllKeys();
    onText('');
    onEnd();
  };

  const advance = () => {
    clearTimers();
    if (!active) return;

    const beat = route[index];
    index += 1;
    beatStartedAt = performance.now();

    if (!beat || beat.end) {
      finish();
      return;
    }
    if (beat.text) onText(beat.text);

    if (beat.move) {
      tickMove(beat, advance);
      return;
    }

    if (beat.key) {
      setKey(beat.key, true);
      timerHandle = setTimeout(() => {
        setKey(beat.key, false);
        timerHandle = setTimeout(advance, 700);
      }, beat.hold ?? 160);
      return;
    }

    const seconds = beat.wait ?? beat.seconds ?? 1;
    timerHandle = setTimeout(advance, seconds * 1000);
  };

  const tickMove = (beat, next) => {
    const [x, z] = beat.move;
    const timeoutMs = (beat.timeout ?? 9) * 1000;

    const step = () => {
      if (!active) return;
      const arrived = steerToward(x, z, 0.55);
      const expired = performance.now() - beatStartedAt > timeoutMs;
      if (arrived || expired) {
        releaseAllKeys();
        frameHandle = null;
        timerHandle = setTimeout(next, 250);
        return;
      }
      frameHandle = requestAnimationFrame(step);
    };
    frameHandle = requestAnimationFrame(step);
  };

  advance();
}

/** Stop the demo early (Esc, or when leaving the page). */
export function stopDemo() {
  if (!active) return;
  active = false;
  clearTimers();
  releaseAllKeys();
}
