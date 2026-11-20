import * as THREE from './vendor/three.module.js';

// Shared level coordinates: x -12..12, z -8..44.
export const WORLD_WIDTH = 24;
// The room now spans z=-8..44, so its depth and center must match the wall positions.
export const WORLD_DEPTH = 52;
export const WORLD_CENTER_Z = 18;
export const WORLD_MIN_Z = -8;
export const WORLD_MAX_Z = 44;          // pushed back to give exit zone air
export const WORLD_BOUNDS = { minX: -11.2, maxX: 11.2, minZ: -7.2, maxZ: 43.2 };
// Tall interior volume: the orbit camera stays inside instead of clipping the ceiling.
export const WALL_HEIGHT = 9.5; // floor to ceiling height in world units.

/**
 * Bright clean laboratory shell — white walls, pale grey floor, sealed ceiling.
 * Accent colours (cyan / violet) come from thin neon trims and area markers,
 * matching the portal frames used by the level module.
 */
export function createLabScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce8f0);
  scene.fog = new THREE.Fog(0xdce8f0, 28, 50);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 7, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  /* ——— Lights ——— */
  // Soft overhead ambient.
  const ambient = new THREE.HemisphereLight(0xe1efff, 0x8895a6, 1.0);
  scene.add(ambient);

  // Main laboratory light: cool white from above.
  const keyLight = new THREE.DirectionalLight(0xfffaf0, 2.8);
  keyLight.position.set(0, 14, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -14;
  scene.add(keyLight);

  // Accent fills (subtle).
  const cyanFill = new THREE.PointLight(0x36dfff, 4, 12, 2);
  cyanFill.position.set(-6, 2.5, 6);
  scene.add(cyanFill);
  const violetFill = new THREE.PointLight(0xb163ff, 4, 12, 2);
  violetFill.position.set(6, 2.5, 6);
  scene.add(violetFill);

  /* ——— Floor ——— */
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe8edf2,
    metalness: 0.0,
    roughness: 0.85,
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(WORLD_WIDTH, 0.2, WORLD_DEPTH), floorMat);
  floor.position.set(0, -0.1, WORLD_CENTER_Z);
  floor.receiveShadow = true;
  scene.add(floor);

  // Fine grid lines for spatial reference.
  const grid = new THREE.GridHelper(WORLD_DEPTH, 48, 0x748ba3, 0xb0c4d4);
  grid.scale.x = WORLD_WIDTH / WORLD_DEPTH;
  grid.position.set(0, 0.005, WORLD_CENTER_Z);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  /* ——— Ceiling (sealed) ——— */
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xf2f6fa,
    metalness: 0.0,
    roughness: 0.9,
  });
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(WORLD_WIDTH, 0.12, WORLD_DEPTH), ceilMat);
  ceiling.position.set(0, WALL_HEIGHT, WORLD_CENTER_Z);
  scene.add(ceiling);

  // Ceiling light strips (fluorescent tube look).
  for (const z of [-4, 3.5, 11, 18.5, 26, 33.5, 40]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.04, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xfcffe6, toneMapped: false, transparent: true, opacity: 0.5 }),
    );
    strip.position.set(0, WALL_HEIGHT - 0.08, z);
    scene.add(strip);
    const glow = new THREE.PointLight(0xfffee8, 1.2, 6, 2);
    glow.position.set(0, WALL_HEIGHT - 0.12, z);
    scene.add(glow);
  }

  /* ——— Walls ——— */
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    metalness: 0.0,
    roughness: 0.6,
  });
  const wallT = 0.32;
  const wallY = WALL_HEIGHT / 2;
  const wallSpecs = [
    { size: [WORLD_WIDTH, WALL_HEIGHT, wallT], position: [0, wallY, WORLD_MIN_Z] },
    { size: [WORLD_WIDTH, WALL_HEIGHT, wallT], position: [0, wallY, WORLD_MAX_Z] },
    { size: [wallT, WALL_HEIGHT, WORLD_DEPTH], position: [-12, wallY, WORLD_CENTER_Z] },
    { size: [wallT, WALL_HEIGHT, WORLD_DEPTH], position: [12, wallY, WORLD_CENTER_Z] },
  ];
  for (const spec of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), wallMat);
    wall.position.set(...spec.position);
    wall.receiveShadow = true;
    wall.castShadow = true;
    scene.add(wall);
  }

  // Baseboard trim — thin dark strip along the floor on all four walls.
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xa0b4c4, toneMapped: false });
  const trimH = 0.12;
  const trimSpecs = [
    { size: [WORLD_WIDTH, trimH, 0.03], position: [0, trimH / 2, WORLD_MIN_Z + 0.02] },
    { size: [WORLD_WIDTH, trimH, 0.03], position: [0, trimH / 2, WORLD_MAX_Z - 0.02] },
    { size: [0.03, trimH, WORLD_DEPTH], position: [-12 + 0.02, trimH / 2, WORLD_CENTER_Z] },
    { size: [0.03, trimH, WORLD_DEPTH], position: [12 - 0.02, trimH / 2, WORLD_CENTER_Z] },
  ];
  for (const spec of trimSpecs) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), trimMat);
    trim.position.set(...spec.position);
    scene.add(trim);
  }

  /* ——— Decorative elements ——— */

  // Corner markers — subtle cyan/violet upright bars.
  const accentColors = [0x36dfff, 0xb163ff, 0xb163ff, 0x36dfff];
  const cornerPos = [[-10.8, -7.2], [10.8, -7.2], [-10.8, 7.2], [10.8, 7.2]];
  for (let i = 0; i < cornerPos.length; i++) {
    const [x, zOff] = cornerPos[i];
    const z = WORLD_CENTER_Z + zOff;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 2.4, 0.06),
      new THREE.MeshBasicMaterial({ color: accentColors[i], toneMapped: false, transparent: true, opacity: 0.6 }),
    );
    bar.position.set(x, 1.3, z);
    scene.add(bar);
    // small glow
    const gl = new THREE.PointLight(accentColors[i], 0.8, 3, 2);
    gl.position.set(x, 1.3, z);
    scene.add(gl);
  }

  // Area divider strips in the floor — subtle colour bands at the same z positions
  // the level module uses for its rooms.
  function addFloorStrip(z, width, color) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.015, width),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, toneMapped: false }),
    );
    s.position.set(0, 0.004, z);
    scene.add(s);
  }
  addFloorStrip(-0.5, 23.4, 0x36dfff);   // entrance → sync gate
  addFloorStrip(10.5, 13, 0x36dfff);      // sync gate end
  addFloorStrip(24.5, 20, 0xb163ff);      // laser hall end

  // Area number labels (01 / 02 / 03) on the wall.
  function addLabel(z, text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(240,244,248,0.9)';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.font = 'bold 70px "Segoe UI", sans-serif';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 66);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(0.9, 0.46, 1);
    sprite.position.set(0, WALL_HEIGHT - 0.32, z);
    scene.add(sprite);
  }
  addLabel(-7.2, '01', 0x36dfff);
  addLabel(13.5, '02', 0x36dfff);
  addLabel(29, '03', 0xb163ff);

  // A central point of interest — time-core plinth (replaces old circular display).
  // Keep it minimal: just a low white pedestal with a cyan glow ring.
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xeef3f8, metalness: 0.0, roughness: 0.7 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 0.35, 24), plinthMat);
  plinth.position.set(0, 0.175, 8);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  scene.add(plinth);
  const plinthRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.03, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x36dfff, toneMapped: false, transparent: true, opacity: 0.5 }),
  );
  plinthRing.rotation.x = Math.PI / 2;
  plinthRing.position.set(0, 0.36, 8);
  scene.add(plinthRing);
  const plinthLight = new THREE.PointLight(0x36dfff, 1.5, 4, 2);
  plinthLight.position.set(0, 0.6, 8);
  scene.add(plinthLight);

  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer, handleResize };
}
