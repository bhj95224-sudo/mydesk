import * as THREE from 'three';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

// ---- grid ----------------------------------------------------------------
const PITCH = 5.0;
const GAP = 0.5;
const KEY_H = 2.5;

const ROWS = 6; // 0 = back (function row) .. 5 = front (spacebar row)
const MAIN_START = 0;
const MAIN_W = 15;
const NAV_START = MAIN_START + MAIN_W + 0.5;
const NAV_W = 3;
const PAD_START = NAV_START + NAV_W + 0.5;
const PAD_W = 4;
const KEY_AREA_W_KU = PAD_START + PAD_W; // 23

const MARGIN_X = 6;
const MARGIN_BACK = 5;
const MARGIN_FRONT = 8;
const BEVEL_Z = 6;

const CASE_W = MARGIN_X * 2 + KEY_AREA_W_KU * PITCH; // 127
const KEY_AREA_D = ROWS * PITCH; // 30
const CASE_D = MARGIN_BACK + KEY_AREA_D + MARGIN_FRONT; // 43
const BACK_H = 5.0;
const FRONT_H = 2.5;
const FRONT_LIP_H = 1.0;

// ---- palette ---------------------------------------------------------
const IVORY = '#ece6d9';
const LGRAY = '#c6c6c1';
const PINK = '#e2a8b3';
const DARK = '#222329';
const NAVY = '#2e3650';
const PLUM = '#552c46';

type KeyDef = { row: number; col: number; w: number; d: number; color: string };

function colToX(startCol: number, col: number, w: number): number {
  return -CASE_W / 2 + MARGIN_X + (startCol + col + w / 2) * PITCH;
}

function rowToZ(row: number, d: number): number {
  return -CASE_D / 2 + MARGIN_BACK + (row + d / 2) * PITCH;
}

function plateY(z: number): number {
  const zLocal = z + CASE_D / 2 - MARGIN_BACK; // 0 at back edge of key area
  const t = Math.min(1, Math.max(0, zLocal / KEY_AREA_D));
  return BACK_H + (FRONT_H - BACK_H) * t;
}

type RowItem = { w: number; color?: string; gap?: number };

function layoutRow(groupStart: number, row: number, items: RowItem[], out: KeyDef[]): void {
  let col = 0;
  for (const item of items) {
    col += item.gap ?? 0;
    if (item.color) {
      out.push({ row, col: groupStart + col, w: item.w, d: 1, color: item.color });
    }
    col += item.w;
  }
}

function buildKeyList(): KeyDef[] {
  const keys: KeyDef[] = [];

  // ---- main block ----------------------------------------------------
  layoutRow(MAIN_START, 0, [
    { w: 1, color: DARK }, // Esc
    { w: 1, color: IVORY, gap: 1 }, { w: 1, color: IVORY },
    { w: 1, color: DARK }, { w: 1, color: DARK },
    { w: 1, color: IVORY, gap: 0.5 }, { w: 1, color: IVORY },
    { w: 1, color: NAVY }, { w: 1, color: NAVY },
    { w: 1, color: IVORY, gap: 0.5 }, { w: 1, color: IVORY },
    { w: 1, color: DARK }, { w: 1, color: DARK },
  ], keys);

  layoutRow(MAIN_START, 1, [
    { w: 1, color: DARK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: PINK }, { w: 1, color: PINK }, { w: 1, color: PINK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
    { w: 1, color: IVORY },
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
    { w: 2, color: DARK },
  ], keys);

  layoutRow(MAIN_START, 2, [
    { w: 1.5, color: DARK },
    { w: 1, color: DARK }, { w: 1, color: DARK },
    { w: 1, color: PINK }, { w: 1, color: PINK }, { w: 1, color: PINK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1.5, color: DARK },
  ], keys);

  layoutRow(MAIN_START, 3, [
    { w: 1.75, color: DARK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: PINK }, { w: 1, color: PINK }, { w: 1, color: PINK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 2.25, color: NAVY },
  ], keys);

  layoutRow(MAIN_START, 4, [
    { w: 2.25, color: DARK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: PINK }, { w: 1, color: PINK }, { w: 1, color: PINK },
    { w: 1, color: IVORY }, { w: 1, color: IVORY },
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY }, { w: 1, color: IVORY },
    { w: 2.75, color: DARK },
  ], keys);

  layoutRow(MAIN_START, 5, [
    { w: 1.25, color: DARK }, { w: 1.25, color: DARK }, { w: 1.25, color: DARK },
    { w: 6.25, color: PLUM },
    { w: 1.25, color: DARK }, { w: 1.25, color: DARK }, { w: 1.25, color: DARK }, { w: 1.25, color: DARK },
  ], keys);

  // ---- nav cluster -----------------------------------------------------
  layoutRow(NAV_START, 0, [
    { w: 1, color: DARK }, { w: 1, color: DARK }, { w: 1, color: DARK },
  ], keys);
  layoutRow(NAV_START, 2, [
    { w: 1, color: IVORY }, { w: 1, color: IVORY }, { w: 1, color: IVORY },
  ], keys);
  layoutRow(NAV_START, 3, [
    { w: 1, color: IVORY }, { w: 1, color: IVORY }, { w: 1, color: IVORY },
  ], keys);
  layoutRow(NAV_START, 4, [
    { w: 1, color: LGRAY, gap: 1 },
  ], keys);
  layoutRow(NAV_START, 5, [
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
  ], keys);

  // ---- numpad ------------------------------------------------------------
  layoutRow(PAD_START, 0, [
    { w: 1, color: DARK }, { w: 1, color: DARK }, { w: 1, color: DARK }, { w: 1, color: DARK },
  ], keys);
  layoutRow(PAD_START, 1, [
    { w: 1, color: LGRAY }, { w: 1, color: LGRAY }, { w: 1, color: PINK },
  ], keys);
  layoutRow(PAD_START, 2, [
    { w: 1, color: PINK }, { w: 1, color: LGRAY }, { w: 1, color: LGRAY },
  ], keys);
  layoutRow(PAD_START, 3, [
    { w: 1, color: LGRAY }, { w: 1, color: PINK }, { w: 1, color: LGRAY },
  ], keys);
  layoutRow(PAD_START, 4, [
    { w: 2, color: IVORY }, { w: 1, color: LGRAY },
  ], keys);
  // tall numpad keys
  keys.push({ row: 1, col: PAD_START + 3, w: 1, d: 2, color: DARK }); // +
  keys.push({ row: 3, col: PAD_START + 3, w: 1, d: 2, color: NAVY }); // Enter

  return keys;
}

function buildCaseGeometry(): THREE.BufferGeometry {
  // side profile, back to front, in (z, y)
  const profile: [number, number][] = [
    [-CASE_D / 2, 0],
    [-CASE_D / 2, BACK_H],
    [CASE_D / 2 - BEVEL_Z, FRONT_H],
    [CASE_D / 2, FRONT_LIP_H],
    [CASE_D / 2, 0],
  ];
  const xLeft = -CASE_W / 2;
  const xRight = CASE_W / 2;

  const positions: number[] = [];
  const indices: number[] = [];

  const leftStart = 0;
  for (const [z, y] of profile) positions.push(xLeft, y, z);
  const rightStart = profile.length;
  for (const [z, y] of profile) positions.push(xRight, y, z);

  // side strips between consecutive profile points
  for (let i = 0; i < profile.length - 1; i += 1) {
    const a0 = leftStart + i;
    const a1 = leftStart + i + 1;
    const b0 = rightStart + i;
    const b1 = rightStart + i + 1;
    indices.push(a0, b1, b0, a0, a1, b1);
  }
  // end caps (fan from point 0)
  for (let i = 1; i < profile.length - 1; i += 1) {
    indices.push(leftStart, leftStart + i, leftStart + i + 1);
    indices.push(rightStart, rightStart + i + 1, rightStart + i);
  }
  // bottom face (close the underside): back-bottom(0) to front-bottom(last)
  indices.push(leftStart + 0, rightStart + profile.length - 1, rightStart + 0);
  indices.push(leftStart + 0, leftStart + profile.length - 1, rightStart + profile.length - 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildGlowPlane(): THREE.Mesh {
  const segX = 46;
  const segZ = 20;
  const geo = new THREE.PlaneGeometry(KEY_AREA_W_KU * PITCH * 0.98, KEY_AREA_D * 0.98, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = x / (KEY_AREA_W_KU * PITCH * 0.98) + 0.5;
    const v = z / (KEY_AREA_D * 0.98) + 0.5;
    const hue = (200 + 150 * u) / 360;
    const boost = 0.55 + 0.45 * v + (u > 0.62 ? 0.25 : 0);
    c.setHSL(hue % 1, 0.75, 0.5);
    colors[i * 3] = c.r * boost;
    colors[i * 3 + 1] = c.g * boost;
    colors[i * 3 + 2] = c.b * boost;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, FRONT_H - 0.15, (MARGIN_BACK - MARGIN_FRONT) * 0); // placeholder, fixed below
  mesh.position.y = 0; // set precisely by caller per-vertex via world Y offset trick not needed: plate tilts, so approximate with average height
  mesh.position.y = (BACK_H + FRONT_H) / 2 - 0.2;
  return mesh;
}

export function createKeyboardModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Mechanical Keyboard';

  const setShadow = (mesh: THREE.Mesh) => {
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
  };

  const caseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0d,
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const caseMesh = new THREE.Mesh(buildCaseGeometry(), caseMaterial);
  caseMesh.name = 'keyboardCase';
  setShadow(caseMesh);
  root.add(caseMesh);

  const glow = buildGlowPlane();
  glow.name = 'rgbGlow';
  root.add(glow);

  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const materialFor = (color: string): THREE.MeshStandardMaterial => {
    let mat = materialCache.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
      materialCache.set(color, mat);
    }
    return mat;
  };

  const keysGroup = new THREE.Group();
  keysGroup.name = 'keycaps';
  const keyGeoCache = new Map<string, THREE.BoxGeometry>();
  for (const key of buildKeyList()) {
    const w = key.w * PITCH - GAP;
    const d = key.d * PITCH - GAP;
    const geoKey = `${w.toFixed(3)}x${d.toFixed(3)}`;
    let geo = keyGeoCache.get(geoKey);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, KEY_H, d, 1, 1, 1);
      keyGeoCache.set(geoKey, geo);
    }
    const mesh = new THREE.Mesh(geo, materialFor(key.color));
    const x = colToX(0, key.col, key.w);
    const z = rowToZ(key.row, key.d);
    const y = plateY(z) + KEY_H / 2;
    mesh.position.set(x, y, z);
    setShadow(mesh);
    keysGroup.add(mesh);
  }
  root.add(keysGroup);

  return root;
}

export function createKeyboardLookDevLights(): THREE.Group {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(1.0, 2.0, 1.6);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-1.2, 1.0, 0.8);
  group.add(fill);
  const rim = new THREE.DirectionalLight(0xbcd0ff, 0.5);
  rim.position.set(-0.4, 1.4, -1.6);
  group.add(rim);
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  group.add(ambient);
  return group;
}

export function createKeyboardEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
  );
  scene.add(sphere);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return env;
}

export function frameKeyboardCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  opts: { azimuthDeg: number; elevationDeg: number; margin?: number },
): void {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z) * 0.5;
  const margin = opts.margin ?? 1.1;
  const fovRad = (camera.fov * Math.PI) / 180;
  const distance = (radius * margin) / Math.sin(fovRad / 2);

  const az = (opts.azimuthDeg * Math.PI) / 180;
  const el = (opts.elevationDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  camera.up.set(0, 1, 0);
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - radius * 2);
  camera.far = distance + radius * 4;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

export function configureKeyboardRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export { CASE_W, CASE_D };
