import * as THREE from './vendor/three.module.js';
import { createLabScene, WORLD_BOUNDS, WALL_HEIGHT } from './scene.js';
import { createPlayer } from './player.js';
import { createTimeLoop } from './timeClone.js';
import { createLevel } from './level.js';
import { initAudio, installAudioHooks, startAmbient, toggleMute, isMuted } from './audio.js';
import { startDemo, stopDemo, isDemoActive } from './demoMode.js';

const container = document.querySelector('#game-root');
const status = document.querySelector('#loop-status');
const menu = document.querySelector('#menu');
const demoBanner = document.querySelector('#demo-banner');
const demoText = document.querySelector('#demo-text');
const soundButton = document.querySelector('#sound');
const { scene, camera, renderer } = createLabScene(container);
const player = createPlayer(scene);
const timeLoop = createTimeLoop({ scene, player });
timeLoop.startRecording();
let playing = false;
player.setInputEnabled(false);

/* ---------- audio ---------- */
// Browsers only allow an AudioContext after a user gesture, so audio starts on
// the first click on START / WATCH DEMO / SOUND.
let audioReady = false;
function bootAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  installAudioHooks();
  startAmbient();
  syncSoundButton();
}
function syncSoundButton() {
  const muted = isMuted();
  soundButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  soundButton.setAttribute('aria-pressed', String(!muted));
}
soundButton.addEventListener('click', () => {
  bootAudio();
  toggleMute();
  syncSoundButton();
});

/* ---------- start / demo ---------- */
function startGame() {
  if (playing) return;
  bootAudio();
  menu.hidden = true;
  playing = true;
  player.setInputEnabled(true);
  // Keyboard events belong to the page, not to the hidden button.
  const canvas = container.querySelector('canvas');
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Chrono Lab 3D viewport, press W A S D to move');
    canvas.focus();
  }
}

function returnToMenu() {
  stopDemo();
  playing = false;
  player.setInputEnabled(false);
  timeLoop.resetAll();
  demoBanner.hidden = true;
  menu.hidden = false;
}

document.querySelector('#start').addEventListener('click', startGame);
window.addEventListener('keydown', (event) => {
  if (!playing && !isDemoActive() && (event.code === 'Enter' || event.code === 'Space')) {
    event.preventDefault();
    startGame();
  }
});
const levelStatus = document.querySelector('#level-status');
const level = createLevel({ scene, player, timeLoop, onStatus: (message) => { levelStatus.textContent = message; } });
const resetCore = timeLoop.resetAll;
timeLoop.resetAll = () => { resetCore(); level.reset(); };
document.querySelector('#restart').addEventListener('click', () => timeLoop.resetAll());

// Expose the core interfaces for level and Demo modules, and for manual
// browser-console verification required by the task brief.
window.chronoLab = timeLoop;
window.chronoLab.player = player;

/* ---------- Demo mode (Member C) ---------- */
document.querySelector('#demo').addEventListener('click', () => {
  if (isDemoActive()) return;
  bootAudio();
  demoText.textContent = 'Preparing demonstration…';
  demoBanner.hidden = false;
  startDemo({
    onText: (text) => { demoText.textContent = text || 'Watch Demo'; },
    onEnd: returnToMenu,
  });
});
document.querySelector('#demo-skip').addEventListener('click', returnToMenu);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && isDemoActive()) returnToMenu();
});

/* ---------- gameplay keys ---------- */
const onKeyDown = (event) => {
  if (!playing) return;
  if (event.code === 'KeyR' && !event.repeat) {
    event.preventDefault();
    window.CHRONO_EVENTS?.onRewind?.();
    timeLoop.resetTimeLoop();
    if (timeLoop.hasClone) window.CHRONO_EVENTS?.onCloneSpawn?.();
  } else if (event.code === 'KeyE' && !event.repeat) {
    level.interact();
  }
};
window.addEventListener('keydown', onKeyDown);

const clock = new THREE.Clock();

// ---------- Mouse-orbit camera ----------
const CAMERA_ORBIT_DISTANCE = 10;
const CAMERA_HEIGHT_OFFSET = 1.6;          // look-at point above player's feet
const PITCH_MIN = -Math.PI / 3;            // ~ -60° — don't flip over
const PITCH_MAX =  Math.PI / 3;            // ~ +60°
const SMOOTH_SPEED = 5;                    // lerp speed (1/delta)

// Start looking forward into the lab: yaw 0 puts the camera behind the player
// (on -Z) looking toward +Z, which is where the level runs. yaw PI would place
// it on the +Z side looking back at the rear wall, i.e. away from the lab.
let cameraYaw = 0;                          // horizontal angle (rad)
let cameraPitch = Math.PI / 6;              // vertical angle, start ~30° above
let cameraOrbitTarget = new THREE.Vector3();
let isPointerLocked = false;

// Capture mouse for orbit control.
const canvas = container.querySelector('canvas');
canvas.addEventListener('mousedown', (e) => {
  if (!playing) return;
  // On first click, request pointer lock; subsequent moves update the angles.
  if (!isPointerLocked) {
    canvas.requestPointerLock();
  }
});
document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!isPointerLocked) return;
  // Sensitivity factor — tune to taste.
  const SENSITIVITY = 0.002;
  cameraYaw   -= e.movementX * SENSITIVITY;
  cameraPitch -= e.movementY * SENSITIVITY;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch, PITCH_MIN, PITCH_MAX);
});

// Expose camera angles so player.js can read them for camera-relative movement.
window.__cameraYaw = () => cameraYaw;

function updateCamera(delta) {
  // Build spherical orbit position around the player.
  const dist = CAMERA_ORBIT_DISTANCE;
  // In Three.js, yaw 0 = -Z direction; rotate so 0 faces +Z.
  const effectiveYaw = cameraYaw + Math.PI;
  let cx = player.position.x + dist * Math.cos(cameraPitch) * Math.sin(effectiveYaw);
  let cy = player.position.y + dist * Math.sin(cameraPitch);
  let cz = player.position.z + dist * Math.cos(cameraPitch) * Math.cos(effectiveYaw);

  // Hard interior safety: the camera may orbit, but never crosses the room shell.
  // The inset also prevents the near wall from filling the whole viewport.
  const wallInset = 0.9;
  cx = THREE.MathUtils.clamp(cx, WORLD_BOUNDS.minX + wallInset, WORLD_BOUNDS.maxX - wallInset);
  cz = THREE.MathUtils.clamp(cz, WORLD_BOUNDS.minZ + wallInset, WORLD_BOUNDS.maxZ - wallInset);
  cy = THREE.MathUtils.clamp(cy, 1.2, WALL_HEIGHT - 0.7);

  const desired = new THREE.Vector3(cx, cy, cz);
  const smoothFactor = 1 - Math.exp(-SMOOTH_SPEED * delta);
  camera.position.lerp(desired, smoothFactor);
  cameraOrbitTarget.set(player.position.x, player.position.y + CAMERA_HEIGHT_OFFSET, player.position.z);
  camera.lookAt(cameraOrbitTarget);
}

function updateStatus() {
  const seconds = timeLoop.recordingTime.toFixed(1);
  status.textContent = timeLoop.hasClone
    ? `Loop ${seconds}s · Echo active`
    : `Loop ${seconds}s · Press R to create an echo`;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (playing) {
    player.update(delta);
    timeLoop.update(delta);
    level.update(delta, clock.elapsedTime);
  }
  updateCamera(delta);
  updateStatus();
  renderer.render(scene, camera);
}

animate();
