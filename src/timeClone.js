import * as THREE from './vendor/three.module.js';
import { createActorVisual, disposeActorVisual } from './player.js';

const DEFAULT_SAMPLE_INTERVAL = 0.1;

function cloneState(state) {
  return {
    time: state.time,
    position: { ...state.position },
    rotationY: state.rotationY,
  };
}

function createCloneActor(scene, track) {
  const visual = createActorVisual({ kind: 'clone' });
  const mesh = visual.root;
  scene.add(mesh);

  let playbackTime = 0;
  let segmentIndex = 0;

  const applyState = (state) => {
    mesh.position.set(state.position.x, state.position.y, state.position.z);
    mesh.rotation.y = state.rotationY;
  };
  applyState(track[0]);

  return {
    mesh,
    get position() {
      return mesh.position;
    },
    get rotationY() {
      return mesh.rotation.y;
    },
    update(delta) {
      if (track.length < 2) {
        visual.update(delta, false);
        return;
      }
      playbackTime = Math.min(playbackTime + delta, track[track.length - 1].time);

      while (
        segmentIndex < track.length - 2 &&
        playbackTime > track[segmentIndex + 1].time
      ) {
        segmentIndex += 1;
      }

      const start = track[segmentIndex];
      const end = track[Math.min(segmentIndex + 1, track.length - 1)];
      const duration = end.time - start.time;
      const amount = duration > 0
        ? THREE.MathUtils.clamp((playbackTime - start.time) / duration, 0, 1)
        : 1;

      mesh.position.lerpVectors(
        new THREE.Vector3(start.position.x, start.position.y, start.position.z),
        new THREE.Vector3(end.position.x, end.position.y, end.position.z),
        amount,
      );
      mesh.rotation.y = THREE.MathUtils.lerp(start.rotationY, end.rotationY, amount);
      visual.update(delta, false);
    },
  };
}

/**
 * Owns the current recording and the single replaying time clone.
 * Other modules can use the exported methods to build pressure plates,
 * lasers, collectibles, and Demo mode without knowing recording internals.
 */
export function createTimeLoop({ scene, player, sampleInterval = DEFAULT_SAMPLE_INTERVAL }) {
  let recording = [];
  let savedTrack = null;
  let recordingTime = 0;
  let lastSampleTime = 0;
  let isRecording = false;
  let clone = null;

  const samplePlayer = (time) => {
    const state = player.getState();
    state.time = time;
    recording.push(state);
    lastSampleTime = time;
  };

  const startRecording = () => {
    recording = [];
    recordingTime = 0;
    lastSampleTime = 0;
    isRecording = true;
    samplePlayer(0);
  };

  const finishRecording = () => {
    if (!isRecording) return savedTrack ? savedTrack.map(cloneState) : [];
    if (recordingTime > lastSampleTime) samplePlayer(recordingTime);
    isRecording = false;
    savedTrack = recording.map(cloneState);
    return savedTrack.map(cloneState);
  };

  const replaceClone = (track) => {
    clearClone();
    clone = createCloneActor(scene, track);
  };

  const resetTimeLoop = () => {
    const track = finishRecording();
    // A very short accidental R press only resets the player and keeps any
    // previously useful clone in place.
    if (track.length >= 3 && track[track.length - 1].time >= sampleInterval) {
      replaceClone(track);
    }
    player.reset();
    startRecording();
    return clone;
  };

  const update = (delta) => {
    if (isRecording) {
      recordingTime += delta;
      if (recordingTime - lastSampleTime >= sampleInterval) {
        samplePlayer(recordingTime);
      }
    }
    if (clone) clone.update(delta);
  };

  function clearClone() {
    if (!clone) return;
    scene.remove(clone.mesh);
    disposeActorVisual(clone.mesh);
    clone = null;
  }

  const getAllActors = () => (clone ? [player, clone] : [player]);

  const resetAll = () => {
    clearClone();
    recording = [];
    savedTrack = null;
    player.reset();
    startRecording();
  };

  return {
    startRecording,
    finishRecording,
    resetTimeLoop,
    getAllActors,
    clearClone,
    resetAll,
    update,
    getRecording: () => recording.map(cloneState),
    getSavedTrack: () => (savedTrack ? savedTrack.map(cloneState) : []),
    get isRecording() {
      return isRecording;
    },
    get recordingTime() {
      return recordingTime;
    },
    get hasClone() {
      return Boolean(clone);
    },
  };
}
