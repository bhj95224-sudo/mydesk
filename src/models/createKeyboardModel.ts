import * as THREE from 'three';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

// ---- grid ------------------------------------------------------------
const PITCH = 5.0;
const GAP = 0.5;
const KEY_H = 2.5;
export const PRESS_DEPTH = KEY_H * 0.22; // 20-25% of keycap height

const ROWS = 6; // 0 = back (function row) .. 5 = front (spacebar row)
const MAIN_START = 0;
const MAIN_W = 15;
const NAV_START = MAIN_START + MAIN_W + 0.5;
const NAV_W = 3;
const KEY_AREA_W_KU = NAV_START + NAV_W; // no numpad

const MARGIN_X = 6;
const MARGIN_BACK = 5;
const MARGIN_FRONT = 8;
const BEVEL_Z = 6;

const CASE_W = MARGIN_X * 2 + KEY_AREA_W_KU * PITCH;
const KEY_AREA_D = ROWS * PITCH;
const CASE_D = MARGIN_BACK + KEY_AREA_D + MARGIN_FRONT;
const BACK_H = 5.0;
const FRONT_H = 2.5;
const FRONT_LIP_H = 1.0;

// ---- palette -----------------------------------------------------------
const IVORY = '#e8ddc8';
const SALMON = '#dfa87b';
const DARKGRAY = '#3a3a3c';
const BLUEGRAY = '#474e57';
const PLUM = '#5c2f35';

const LIGHT_TEXT = '#5c3a2e';
const DARK_TEXT = '#e9e4d8';

export const PRESSABLE_KEYS = new Set(['C', 'V', 'N', 'F', 'G', 'I', 'P']);

type KeyDef = { row: number; col: number; w: number; d: number; color: string; label: string };

function colToX(col: number, w: number): number {
  return -CASE_W / 2 + MARGIN_X + (col + w / 2) * PITCH;
}

function rowToZ(row: number, d: number): number {
  return -CASE_D / 2 + MARGIN_BACK + (row + d / 2) * PITCH;
}

function plateY(z: number): number {
  const zLocal = z + CASE_D / 2 - MARGIN_BACK;
  const t = Math.min(1, Math.max(0, zLocal / KEY_AREA_D));
  return BACK_H + (FRONT_H - BACK_H) * t;
}

type RowItem = { w: number; color: string; label: string; gap?: number };

function layoutRow(groupStart: number, row: number, items: RowItem[], out: KeyDef[]): void {
  let col = 0;
  for (const item of items) {
    col += item.gap ?? 0;
    out.push({ row, col: groupStart + col, w: item.w, d: 1, color: item.color, label: item.label });
    col += item.w;
  }
}

function buildKeyList(): KeyDef[] {
  const keys: KeyDef[] = [];

  layoutRow(MAIN_START, 0, [
    { w: 1, color: SALMON, label: 'Esc' },
    { w: 1, color: IVORY, label: 'F1', gap: 1 }, { w: 1, color: IVORY, label: 'F2' },
    { w: 1, color: IVORY, label: 'F3' }, { w: 1, color: IVORY, label: 'F4' },
    { w: 1, color: DARKGRAY, label: 'F5', gap: 0.5 }, { w: 1, color: DARKGRAY, label: 'F6' },
    { w: 1, color: DARKGRAY, label: 'F7' }, { w: 1, color: DARKGRAY, label: 'F8' },
    { w: 1, color: IVORY, label: 'F9', gap: 0.5 }, { w: 1, color: IVORY, label: 'F10' },
    { w: 1, color: IVORY, label: 'F11' }, { w: 1, color: IVORY, label: 'F12' },
  ], keys);

  layoutRow(MAIN_START, 1, [
    { w: 1, color: BLUEGRAY, label: '~' },
    { w: 1, color: IVORY, label: '1' }, { w: 1, color: IVORY, label: '2' },
    { w: 1, color: IVORY, label: '3' }, { w: 1, color: IVORY, label: '4' },
    { w: 1, color: IVORY, label: '5' }, { w: 1, color: IVORY, label: '6' },
    { w: 1, color: IVORY, label: '7' }, { w: 1, color: IVORY, label: '8' },
    { w: 1, color: IVORY, label: '9' }, { w: 1, color: IVORY, label: '0' },
    { w: 1, color: IVORY, label: '-' }, { w: 1, color: IVORY, label: '=' },
    { w: 2, color: BLUEGRAY, label: 'Backspace' },
  ], keys);

  layoutRow(MAIN_START, 2, [
    { w: 1.5, color: BLUEGRAY, label: 'Tab' },
    { w: 1, color: IVORY, label: 'Q' }, { w: 1, color: IVORY, label: 'W' },
    { w: 1, color: IVORY, label: 'E' }, { w: 1, color: IVORY, label: 'R' },
    { w: 1, color: IVORY, label: 'T' }, { w: 1, color: IVORY, label: 'Y' },
    { w: 1, color: IVORY, label: 'U' }, { w: 1, color: IVORY, label: 'I' },
    { w: 1, color: IVORY, label: 'O' }, { w: 1, color: IVORY, label: 'P' },
    { w: 1, color: IVORY, label: '[' }, { w: 1, color: IVORY, label: ']' },
    { w: 1.5, color: IVORY, label: '\\' },
  ], keys);

  layoutRow(MAIN_START, 3, [
    { w: 1.75, color: BLUEGRAY, label: 'Caps' },
    { w: 1, color: IVORY, label: 'A' }, { w: 1, color: IVORY, label: 'S' },
    { w: 1, color: IVORY, label: 'D' }, { w: 1, color: IVORY, label: 'F' },
    { w: 1, color: IVORY, label: 'G' }, { w: 1, color: IVORY, label: 'H' },
    { w: 1, color: IVORY, label: 'J' }, { w: 1, color: IVORY, label: 'K' },
    { w: 1, color: IVORY, label: 'L' },
    { w: 1, color: IVORY, label: ';' }, { w: 1, color: IVORY, label: '\'' },
    { w: 2.25, color: SALMON, label: 'Enter' },
  ], keys);

  layoutRow(MAIN_START, 4, [
    { w: 2.25, color: BLUEGRAY, label: 'Shift' },
    { w: 1, color: IVORY, label: 'Z' }, { w: 1, color: IVORY, label: 'X' },
    { w: 1, color: IVORY, label: 'C' }, { w: 1, color: IVORY, label: 'V' },
    { w: 1, color: IVORY, label: 'B' }, { w: 1, color: IVORY, label: 'N' },
    { w: 1, color: IVORY, label: 'M' },
    { w: 1, color: IVORY, label: ',' }, { w: 1, color: IVORY, label: '.' }, { w: 1, color: IVORY, label: '/' },
    { w: 2.75, color: BLUEGRAY, label: 'Shift' },
  ], keys);

  layoutRow(MAIN_START, 5, [
    { w: 1.25, color: BLUEGRAY, label: 'Ctrl' },
    { w: 1.25, color: BLUEGRAY, label: 'Win' },
    { w: 1.25, color: BLUEGRAY, label: 'Alt' },
    { w: 6.25, color: PLUM, label: '' },
    { w: 1.25, color: BLUEGRAY, label: 'Alt' },
    { w: 1.25, color: BLUEGRAY, label: 'Fn' },
    { w: 1.25, color: BLUEGRAY, label: 'Menu' },
    { w: 1.25, color: BLUEGRAY, label: 'Ctrl' },
  ], keys);

  // ---- nav cluster (no numpad) -------------------------------------------
  layoutRow(NAV_START, 0, [
    { w: 1, color: BLUEGRAY, label: 'PrtSc' }, { w: 1, color: BLUEGRAY, label: 'ScrLk' },
  ], keys);
  layoutRow(NAV_START, 1, [
    { w: 1, color: BLUEGRAY, label: 'Ins' }, { w: 1, color: BLUEGRAY, label: 'Home' },
  ], keys);
  layoutRow(NAV_START, 2, [
    { w: 1, color: BLUEGRAY, label: 'Del' }, { w: 1, color: BLUEGRAY, label: 'End' },
  ], keys);
  layoutRow(NAV_START, 4, [
    { w: 1, color: PLUM, label: '^', gap: 1 },
  ], keys);
  layoutRow(NAV_START, 5, [
    { w: 1, color: PLUM, label: '<' }, { w: 1, color: PLUM, label: 'v' }, { w: 1, color: PLUM, label: '>' },
  ], keys);

  return keys;
}

// Same wedge-profile solid as the standalone keyboard model: a single watertight
// ExtrudeGeometry, closed front/back/left/right/bottom, both ends geometrically
// symmetric by construction (one profile, extruded straight along width).
function buildCaseGeometry(): THREE.BufferGeometry {
  const backZ = -CASE_D / 2;
  const frontZ = CASE_D / 2;
  const shoulderZ = CASE_D / 2 - BEVEL_Z;

  const shape = new THREE.Shape();
  shape.moveTo(backZ, 0);
  shape.lineTo(backZ, BACK_H);
  shape.lineTo(shoulderZ, FRONT_H);
  shape.lineTo(frontZ, FRONT_LIP_H);
  shape.lineTo(frontZ, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: CASE_W, bevelEnabled: false, steps: 1 });
  geometry.rotateY(-Math.PI / 2);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  geometry.translate(-cx, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLabelTexture(text: string, bgColor: string, textColor: string, wide: boolean): THREE.CanvasTexture {
  const w = wide ? 256 : 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  if (text) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = wide ? 40 : 52;
    if (text.length > 5) fontSize = wide ? 34 : 30;
    if (text.length > 8) fontSize = 26;
    ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    ctx.fillText(text, w / 2, h / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function isLightColor(hex: string): boolean {
  return hex === IVORY || hex === SALMON;
}

function buildKeycapMesh(key: KeyDef, geometryCache: Map<string, THREE.BoxGeometry>): THREE.Mesh {
  const w = key.w * PITCH - GAP;
  const d = key.d * PITCH - GAP;
  const geoKey = `${w.toFixed(3)}x${d.toFixed(3)}`;
  let geo = geometryCache.get(geoKey);
  if (!geo) {
    geo = new THREE.BoxGeometry(w, KEY_H, d, 1, 1, 1);
    geometryCache.set(geoKey, geo);
  }
  const textColor = isLightColor(key.color) ? LIGHT_TEXT : DARK_TEXT;
  const labelTex = makeLabelTexture(key.label, key.color, textColor, key.w >= 2);
  const sideMat = new THREE.MeshStandardMaterial({ color: key.color, roughness: 0.55, metalness: 0.05 });
  const topMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.5, metalness: 0.05 });
  // BoxGeometry face material order: [+x, -x, +y(top), -y(bottom), +z, -z]
  const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = key.label || 'Spacebar';
  return mesh;
}

export type PressableKey = THREE.Group & {
  userData: { key: string; pressable: true; restY: number };
};

export function createKeyboardModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TKL Keyboard';

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
    side: THREE.DoubleSide,
  });
  const caseMesh = new THREE.Mesh(buildCaseGeometry(), caseMaterial);
  caseMesh.name = 'keyboardCase';
  setShadow(caseMesh);
  root.add(caseMesh);

  const keysGroup = new THREE.Group();
  keysGroup.name = 'keycaps';
  root.add(keysGroup);

  const pressableGroup = new THREE.Group();
  pressableGroup.name = 'pressableKeys';
  root.add(pressableGroup);

  const pressableKeys: PressableKey[] = [];
  const geometryCache = new Map<string, THREE.BoxGeometry>();

  for (const key of buildKeyList()) {
    const x = colToX(key.col, key.w);
    const z = rowToZ(key.row, key.d);
    const y = plateY(z) + KEY_H / 2;
    const mesh = buildKeycapMesh(key, geometryCache);
    setShadow(mesh);

    if (PRESSABLE_KEYS.has(key.label)) {
      const group = new THREE.Group() as PressableKey;
      group.name = `pressable-${key.label}`;
      group.position.set(x, y, z);
      mesh.position.set(0, 0, 0);
      group.add(mesh);
      group.userData = { key: key.label, pressable: true, restY: y };
      pressableGroup.add(group);
      pressableKeys.push(group);
    } else {
      mesh.position.set(x, y, z);
      mesh.userData.pressable = false;
      keysGroup.add(mesh);
    }
  }

  root.userData.pressableKeys = pressableKeys;
  return root;
}

export function createKeyboardLookDevLights(): THREE.Group {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(0.8, 2.0, 1.4);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(-1.0, 1.4, 1.0);
  group.add(fill);
  const rim = new THREE.DirectionalLight(0xd8dcff, 0.4);
  rim.position.set(-0.3, 1.2, -1.6);
  group.add(rim);
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  group.add(ambient);
  return group;
}

// NOT cached: a PMREMGenerator's output texture is tied to the WebGLRenderTarget of the
// renderer that built it and renders blank with any other renderer -- see
// createDeskSetupModel.ts's createCurvedBirchPlyDeskSetupEnvironment for the full story.
// (createKeyboardModel() itself is also not cached, for a separate reason: the interactive
// /keyboard page mutates its key meshes' transforms during press animations -- see
// keyboardInteractions.ts -- so sharing that instance would let a key get stuck visually
// "pressed" the next time the model is built.)
export function createKeyboardEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
  );
  scene.add(sphere);
  const env = pmrem.fromScene(scene, 0.05).texture;
  pmrem.dispose();
  return env;
}

export function frameKeyboardCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  opts: { azimuthDeg: number; elevationDeg: number; margin?: number },
): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = opts.margin ?? 1.1;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

  const az = (opts.azimuthDeg * Math.PI) / 180;
  const el = (opts.elevationDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  // Near-vertical elevation makes `dir` nearly parallel to the default (0,1,0) up vector,
  // which degenerates the camera's right-vector cross product (a near-top-down shot
  // stretches/skews instead of framing cleanly). Swap to a horizontal up reference
  // whenever dir is close to straight up/down.
  camera.up.set(0, Math.abs(dir.y) > 0.999 ? 0 : 1, Math.abs(dir.y) > 0.999 ? -1 : 0);

  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  const screenUp = new THREE.Vector3().crossVectors(right, dir).normalize();
  const halfSize = size.multiplyScalar(0.5);
  const halfWidth =
    Math.abs(right.x) * halfSize.x +
    Math.abs(right.y) * halfSize.y +
    Math.abs(right.z) * halfSize.z;
  const halfHeight =
    Math.abs(screenUp.x) * halfSize.x +
    Math.abs(screenUp.y) * halfSize.y +
    Math.abs(screenUp.z) * halfSize.z;
  const halfDepth =
    Math.abs(dir.x) * halfSize.x +
    Math.abs(dir.y) * halfSize.y +
    Math.abs(dir.z) * halfSize.z;
  const distance = Math.max(
    halfWidth / Math.tan(hFov / 2),
    halfHeight / Math.tan(vFov / 2),
  ) * margin;

  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - halfDepth * 2);
  camera.far = distance + halfDepth * 4;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

export function configureKeyboardRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
