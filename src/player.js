import * as THREE from './vendor/three.module.js';
import { WORLD_BOUNDS } from './scene.js';

// Spawn a little further into the room: the rear wall is at z = -8, and with the
// spawn at z = -6 there was no room behind the player for the orbit camera, so it
// clamped against the wall and filled the screen with the rear wall.
export const PLAYER_SPAWN = new THREE.Vector3(0, 0.55, -2);
const MOVE_SPEED = 4;
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

function createOrbMaterial({ color, emissive, opacity = 1 }) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: opacity < 1 ? 1.8 : 0.45,
    metalness: 0.96,
    roughness: 0.14,
    clearcoat: 0.8,
    clearcoatRoughness: 0.08,
    reflectivity: 1,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

/**
 * Build a polished metallic time orb from local Three.js primitives. The
 * silhouette stays simple for the assignment while the material, highlights,
 * energy core, and orbiting ring give it a deliberate game identity.
 */
export function createActorVisual({ kind = 'player' } = {}) {
  const isClone = kind === 'clone';
  const opacity = isClone ? 0.46 : 1;
  const color = isClone ? 0x665cff : 0x247f9b;
  const emissive = isClone ? 0x2e20a8 : 0x062a38;
  const glowColor = isClone ? 0xc27cff : 0x63efff;
  const root = new THREE.Group();
  root.name = isClone ? 'time-echo-orb' : 'time-orb';
  const model = new THREE.Group();
  root.add(model);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 48, 32),
    createOrbMaterial({ color, emissive, opacity }),
  );
  orb.castShadow = true;
  orb.receiveShadow = true;
  model.add(orb);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 16),
    new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false, transparent: isClone, opacity: isClone ? 0.7 : 1 }),
  );
  // The camera follows from behind the orb, so the rear energy port keeps the
  // character readable even before the level adds its own lighting.
  core.position.set(0, 0, 0.5);
  model.add(core);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: glowColor,
    toneMapped: false,
    transparent: isClone,
    opacity: isClone ? 0.65 : 0.9,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 16, 96), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  model.add(ring);

  const ringSecondary = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 12, 72), ringMaterial.clone());
  ringSecondary.rotation.x = Math.PI / 2;
  ringSecondary.rotation.z = Math.PI / 3;
  model.add(ringSecondary);

  const pointLight = new THREE.PointLight(glowColor, isClone ? 0.9 : 1.25, 3.2, 2);
  pointLight.position.set(0, 0, 0);
  model.add(pointLight);

  let animationTime = isClone ? 1.7 : 0;
  return {
    root,
    update(delta, moving) {
      animationTime += delta * (moving ? 5 : 1.8);
      model.position.y = Math.sin(animationTime) * (moving ? 0.035 : 0.012);
      ring.rotation.z += delta * (isClone ? -0.9 : 0.7);
      ringSecondary.rotation.z -= delta * (isClone ? -0.45 : 0.35);
      const pulse = 1 + Math.sin(animationTime * 2.4) * 0.05;
      core.scale.setScalar(pulse);
      pointLight.intensity = (isClone ? 0.8 : 1.15) + Math.sin(animationTime * 2.4) * 0.12;
    },
  };
}

export function disposeActorVisual(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material.dispose();
    }
  });
}

/**
 * Create the controllable actor. The public position and rotationY fields are
 * intentionally simple so the time-loop and level modules can consume them.
 */
export function createPlayer(scene, { bounds = WORLD_BOUNDS } = {}) {
  // Level modules may replace this resolver; it receives cloned positions and
  // must return a finite Vector3 representing the permitted final position.
  let resolveMovement = (_from, proposed) => proposed;
  const visual = createActorVisual({ kind: 'player' });
  const mesh = visual.root;
  mesh.position.copy(PLAYER_SPAWN);
  scene.add(mesh);

  const pressedKeys = new Set();
  let verticalVelocity = 0;
  let inputEnabled = true;
  const onKeyDown = (event) => {
    if (!inputEnabled) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat && mesh.position.y <= PLAYER_SPAWN.y + 0.001) verticalVelocity = 7;
    }
    if (MOVEMENT_KEYS.has(event.code)) {
      pressedKeys.add(event.code);
      event.preventDefault();
    }
  };
  const onKeyUp = (event) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      pressedKeys.delete(event.code);
      event.preventDefault();
    }
  };
  const clearKeys = () => pressedKeys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);

  const controller = {
    mesh,
    get position() {
      return mesh.position;
    },
    get rotationY() {
      return mesh.rotation.y;
    },
    update(delta) {
      // World-axis movement: W/S = +Z/-Z (forward/back), A/D = -X/+X (left/right).
      const x = (pressedKeys.has('KeyA') ? 1 : 0) - (pressedKeys.has('KeyD') ? 1 : 0);
      const z = (pressedKeys.has('KeyW') ? 1 : 0) - (pressedKeys.has('KeyS') ? 1 : 0);
      const direction = new THREE.Vector3(x, 0, z);

      if (direction.lengthSq() > 0) {
        direction.normalize();
        const from = mesh.position.clone();
        const proposed = from.clone().addScaledVector(direction, MOVE_SPEED * delta);
        proposed.x = THREE.MathUtils.clamp(proposed.x, bounds.minX, bounds.maxX);
        proposed.z = THREE.MathUtils.clamp(proposed.z, bounds.minZ, bounds.maxZ);
        const resolved = resolveMovement(from.clone(), proposed.clone());
        if (resolved && Number.isFinite(resolved.x) && Number.isFinite(resolved.y) && Number.isFinite(resolved.z)) {
          mesh.position.set(
            THREE.MathUtils.clamp(resolved.x, bounds.minX, bounds.maxX),
            resolved.y,
            THREE.MathUtils.clamp(resolved.z, bounds.minZ, bounds.maxZ),
          );
        }
        // Face the movement direction.
        mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
      verticalVelocity -= 16 * delta;
      mesh.position.y += verticalVelocity * delta;
      if (mesh.position.y <= PLAYER_SPAWN.y) { mesh.position.y = PLAYER_SPAWN.y; verticalVelocity = 0; }
      visual.update(delta, direction.lengthSq() > 0);
    },
    setInputEnabled(enabled) { inputEnabled = Boolean(enabled); if (!inputEnabled) pressedKeys.clear(); },
    teleport(x, z) { mesh.position.set(x, PLAYER_SPAWN.y, z); verticalVelocity = 0; },
    // Pass null to remove the level collision resolver.
    setMovementResolver(resolver) {
      if (resolver != null && typeof resolver !== 'function') throw new TypeError('resolver must be a function or null');
      resolveMovement = resolver ?? ((_from, proposed) => proposed);
    },
    getState() {
      return {
        time: 0,
        position: {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        },
        rotationY: mesh.rotation.y,
      };
    },
    reset() {
      mesh.position.copy(PLAYER_SPAWN);
      verticalVelocity = 0;
      mesh.rotation.y = 0;
      pressedKeys.clear();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      scene.remove(mesh);
      disposeActorVisual(mesh);
    },
  };

  return controller;
}
