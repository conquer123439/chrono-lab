import * as THREE from './vendor/three.module.js';

// Layout (z increases forward):
//   spawn -6 | plates 8 | door wall 12 | core1 13.5 | switch 17
//   low beam 19 (jump) | gate 23 (switch) | moving beam 27 | core2 29.5
//   final buttons 32 | energy field + core3 35 | exit 38.5
const Z = {
  wall: 12, plateA: 8, core1: 13.5, switch: 17, lowLaser: 19,
  gate: 22.75, movingLaser: 27, core2: 29.5, finalButtons: 32,
  field: 35, exit: 38.5, respawnB: 15,
};

function makeLabelSprite(text, color = '#7fe9ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(4, 12, 24, 0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.font = 'bold 44px "Segoe UI", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.6, 0.68, 1);
  return sprite;
}

export function createLevel({ scene, player, timeLoop, onStatus = () => {}, onEvent = () => {} }) {
  const initial = () => ({
    plateAActive: false, plateBActive: false, syncDoorOpen: false,
    laserSwitchActive: false, gateOn: true, finalAActive: false, finalBActive: false,
    energyFieldDown: false, coreCount: 0, exitUnlocked: false, gameWon: false,
    area: 1,
  });
  const state = initial();
  let clock = 0;
  const group = new THREE.Group();
  group.name = 'laboratory-puzzles';
  scene.add(group);

  const actorRadius = 0.58;
  const plateRadius = 0.8;
  const gapHalfWidth = 1.5;

  /* ---------- structure ---------- */
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x22354f, metalness: 0.7, roughness: 0.34, emissive: 0x061326 });
  function makeWall(width, x, z) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 3.1, 0.5), wallMaterial);
    wall.position.set(x, 1.55, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    return wall;
  }
  for (const x of [-6.75, 6.75]) makeWall(10.5, x, Z.wall);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3.1, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x36c5f0, emissive: 0x1c6c86, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  door.position.set(0, 1.55, Z.wall);
  group.add(door);

  // Portal frames read as "this is the way forward".
  function makePortal(z, color, radius = 1.9) {
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.09, 10, 56),
      new THREE.MeshBasicMaterial({ color }),
    );
    frame.position.set(0, 1.7, z);
    group.add(frame);
    const glow = new THREE.PointLight(color, 6, 9, 2);
    glow.position.set(0, 1.6, z);
    group.add(glow);
    return frame;
  }
  const portalA = makePortal(Z.wall + 0.4, 0x36c5f0, 2.0);

  // Region floor markings make each room read as its own space.
  function makeStrip(z, length, color) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.03, length),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14 }),
    );
    strip.position.set(0, 0.02, z);
    group.add(strip);
  }
  makeStrip(-1, 14, 0x2a7fd4);   // spawn hall
  makeStrip(9, 8, 0x36dfff);     // sync gate room
  makeStrip(23.5, 13, 0xff4b63); // laser hall
  makeStrip(35, 11, 0xb163ff);   // core chamber

  // Floor light lines down both sides tie the rooms together.
  for (const x of [-10.6, 10.6]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 46),
      new THREE.MeshBasicMaterial({ color: 0x2e7fa8 }),
    );
    rail.position.set(x, 0.03, 16);
    group.add(rail);
  }

  const labels = [];
  function addLabel(text, x, y, z) {
    const sprite = makeLabelSprite(text);
    sprite.position.set(x, y, z);
    group.add(sprite);
    labels.push(sprite);
    return sprite;
  }
  addLabel('01 · SYNC GATE', 0, 3.6, Z.wall);
  addLabel('02 · LASER HALL', 0, 3.4, 23.5);
  addLabel('03 · CORE CHAMBER', 0, 3.4, 35);

  /* ---------- interactive pieces ---------- */
  function createPlate(x, z, color = 0x39d98a) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(plateRadius + 0.12, plateRadius + 0.12, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x141c28, metalness: 0.8, roughness: 0.4 }),
    );
    base.position.set(x, 0.05, z);
    group.add(base);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(plateRadius, plateRadius, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, emissive: 0x000000, metalness: 0.5, roughness: 0.3 }),
    );
    mesh.position.set(x, 0.13, z);
    mesh.userData.activeColor = color;
    group.add(mesh);
    return mesh;
  }
  const plateA = createPlate(-6, Z.plateA);
  const plateB = createPlate(6, Z.plateA);
  const laserSwitch = createPlate(-8, Z.switch, 0x63e9ff);
  const finalA = createPlate(-5, Z.finalButtons, 0xc27cff);
  const finalB = createPlate(5, Z.finalButtons, 0xc27cff);

  function makeLaser(width, height, x, y, z, color) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, toneMapped: false }),
    );
    beam.position.set(x, y, z);
    group.add(beam);
    // Emitter blocks at both ends sell the danger.
    for (const ex of [-12, 12]) {
      const emitter = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      emitter.position.set(ex, y, z);
      group.add(emitter);
    }
    return beam;
  }
  const lowLaser = makeLaser(24, 0.3, 0, 0.16, Z.lowLaser, 0xff8a3d);
  const gate = makeLaser(24, 3.0, 0, 1.55, Z.gate, 0xff3344);
  const movingLaser = makeLaser(12, 3.0, 0, 1.55, Z.movingLaser, 0xff4b63);

  const field = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 28, 18),
    new THREE.MeshBasicMaterial({ color: 0x36c5f0, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  field.position.set(0, 1.15, Z.field);
  group.add(field);

  function createCore(z) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4),
      new THREE.MeshStandardMaterial({ color: 0xffd24d, emissive: 0xa06a00, metalness: 0.5, roughness: 0.2 }),
    );
    mesh.position.set(0, 1.15, z);
    group.add(mesh);
    const halo = new THREE.PointLight(0xffc447, 3, 5, 2);
    halo.position.copy(mesh.position);
    group.add(halo);
    mesh.userData.halo = halo;
    return mesh;
  }
  const cores = [createCore(Z.core1), createCore(Z.core2), createCore(Z.field)];

  const exitFrame = makePortal(Z.exit, 0xff5566, 1.6);

  /* ---------- movement / collision ---------- */
  function resolveMovement(from, proposed) {
    const clearance = 0.25 + actorRadius;
    const fromSide = Math.sign(from.z - Z.wall);
    if (fromSide === 0) return proposed;
    const edge = Z.wall + fromSide * clearance;
    const crossing = fromSide < 0 ? proposed.z > edge : proposed.z < edge;
    if (!crossing) return proposed;
    const t = proposed.z === from.z ? 0 : THREE.MathUtils.clamp((edge - from.z) / (proposed.z - from.z), 0, 1);
    const xAtWall = THREE.MathUtils.lerp(from.x, proposed.x, t);
    if (!state.syncDoorOpen || Math.abs(xAtWall) > gapHalfWidth - actorRadius) proposed.z = edge;
    return proposed;
  }
  player.setMovementResolver(resolveMovement);

  /* ---------- update ---------- */
  const pressed = (plate, actors) =>
    actors.some((a) => a.position.y <= 0.9 && Math.hypot(a.position.x - plate.position.x, a.position.z - plate.position.z) < plateRadius);

  function setPlateVisual(plate, active) {
    plate.material.color.setHex(active ? plate.userData.activeColor : 0x3a3f4a);
    plate.material.emissive.setHex(active ? 0x1d6b45 : 0x000000);
  }

  function update(delta, elapsed) {
    const actors = timeLoop.getAllActors();
    const entries = [
      [plateA, 'plateAActive', 'pressurePlateA'],
      [plateB, 'plateBActive', 'pressurePlateB'],
      [laserSwitch, 'laserSwitchActive', 'laserSwitch'],
      [finalA, 'finalAActive', 'finalButtonA'],
      [finalB, 'finalBActive', 'finalButtonB'],
    ];
    for (const [plate, key, id] of entries) {
      const active = pressed(plate, actors);
      if (active && !state[key]) {
        window.CHRONO_EVENTS?.onPlateActivate?.(id);
        onEvent?.('plate', id);
      }
      state[key] = active;
      setPlateVisual(plate, active);
    }

    if (!state.syncDoorOpen && state.plateAActive && state.plateBActive) {
      state.syncDoorOpen = true;
      door.visible = false;
      portalA.material.color.setHex(0x39d98a);
      window.CHRONO_EVENTS?.onDoorOpen?.('syncDoor');
      onEvent?.('door', 'syncDoor');
    }

    clock += delta;
    state.gateOn = !state.laserSwitchActive;
    gate.visible = state.gateOn;
    movingLaser.position.x = Math.sin(clock * 0.7) * 5.4;

    const p = player.position;
    const hitsLow = Math.abs(p.z - Z.lowLaser) < 0.68 && p.y - 0.58 < 0.32;
    const hitsGate = state.gateOn && Math.abs(p.z - Z.gate) < 0.68;
    const hitsMoving = Math.abs(p.z - Z.movingLaser) < 0.68 && Math.abs(p.x - movingLaser.position.x) < 6.1;
    if (hitsLow || hitsGate || hitsMoving) {
      player.teleport(0, Z.respawnB);
      onEvent?.('laser', 'hit');
      window.CHRONO_EVENTS?.onLaserHit?.();
    }

    if (!state.energyFieldDown && state.finalAActive && state.finalBActive) {
      state.energyFieldDown = true;
      field.visible = false;
      onEvent?.('field', 'down');
      window.CHRONO_EVENTS?.onDoorOpen?.('energyField');
    }

    for (const core of cores) {
      if (!core.visible) continue;
      core.rotation.y += delta * 1.2;
      core.rotation.x += delta * 0.4;
      core.position.y = 1.15 + Math.sin(elapsed * 2 + core.position.z) * 0.16;
      if (core.userData.halo) core.userData.halo.position.y = core.position.y;
    }

    // Area indicator for the HUD.
    state.area = p.z < Z.wall ? 1 : p.z < 24 ? 2 : 3;

    let objective;
    if (state.gameWon) objective = 'Victory — you escaped the lab.';
    else if (!state.syncDoorOpen) objective = 'Stand on one plate, press R, then take the other plate.';
    else if (state.coreCount === 0) objective = 'Walk through the gate and press E to take core 1.';
    else if (state.coreCount === 1) objective = state.gateOn
      ? 'Laser hall: jump the orange beam, then let your echo hold the cyan switch.'
      : 'Gate offline — cross now and take core 2.';
    else if (state.coreCount === 2) objective = state.energyFieldDown
      ? 'Field down — press E to take the final core.'
      : 'Stand you and your echo on both violet plates.';
    else objective = 'Exit unlocked — reach the portal and press E.';

    onStatus(objective, state);
  }

  function interact() {
    if (state.gameWon) return;
    const index = state.coreCount;
    const unlocked = index === 0 ? state.syncDoorOpen
      : index === 1 ? true
      : index === 2 ? state.energyFieldDown : false;
    if (index < 3 && unlocked) {
      const core = cores[index];
      if (core.visible && Math.hypot(player.position.x - core.position.x, player.position.z - core.position.z) < 1.3) {
        core.visible = false;
        if (core.userData.halo) core.userData.halo.visible = false;
        state.coreCount += 1;
        window.CHRONO_EVENTS?.onCoreCollect?.(`core${['One', 'Two', 'Three'][index]}`);
        onEvent?.('core', index + 1);
        if (state.coreCount === 3) {
          state.exitUnlocked = true;
          exitFrame.material.color.setHex(0x39d98a);
          window.CHRONO_EVENTS?.onDoorOpen?.('exitDoor');
        }
        return;
      }
    }
    if (state.exitUnlocked && Math.hypot(player.position.x, player.position.z - Z.exit) < 1.7) {
      state.gameWon = true;
      window.CHRONO_EVENTS?.onVictory?.();
      onEvent?.('victory', 'win');
    }
  }

  function reset() {
    Object.assign(state, initial());
    clock = 0;
    door.visible = true;
    portalA.material.color.setHex(0x36c5f0);
    field.visible = true;
    gate.visible = true;
    cores.forEach((core) => {
      core.visible = true;
      if (core.userData.halo) core.userData.halo.visible = true;
    });
    exitFrame.material.color.setHex(0xff5566);
  }

  return { update, interact, reset, state, Z };
}
