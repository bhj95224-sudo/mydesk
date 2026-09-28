import * as THREE from 'three';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

// ---- dimensions (relative units; monitor width = 1.0) --------------------
const W = 1.0;
const H = 0.56;
const T = 0.035;
const CURVE_R = 3.0;
const TOP_SIDE_BEZEL = 0.006;
const BOTTOM_BEZEL = 0.025;

const NECK_EXPOSED_H = 0.11;
const NECK_W = 0.05;
const NECK_T = 0.02;

const HUB_SIZE = 0.03;

const LEG_LEN = 0.40;
const LEG_THICK = 0.018;
const LEG_TIP_THICK = 0.012;
const LEG_TIP_HALF_SPREAD = 0.35; // half of ~70% of W

const SCREEN_BOTTOM_Y = NECK_EXPOSED_H; // 0.11
const SCREEN_CENTER_Y = SCREEN_BOTTOM_Y + H / 2;

function curvedPanelGeometry(width: number, height: number, thickness: number, radius: number): THREE.BufferGeometry {
  const halfW = width / 2;
  const thetaMax = Math.asin(Math.min(0.999, halfW / radius));
  const segments = 24;

  const shape = new THREE.Shape();
  // front curve: x = R sin(theta), z = R (1 - cos(theta)) -- center bows away
  // from the viewer (smaller z), edges come toward the viewer (larger z).
  for (let i = 0; i <= segments; i += 1) {
    const t = -thetaMax + (2 * thetaMax * i) / segments;
    const x = radius * Math.sin(t);
    const z = radius * (1 - Math.cos(t));
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  // back curve (same shape, pushed back by `thickness`), traversed in reverse
  for (let i = segments; i >= 0; i -= 1) {
    const t = -thetaMax + (2 * thetaMax * i) / segments;
    const x = radius * Math.sin(t);
    const z = radius * (1 - Math.cos(t)) - thickness;
    shape.lineTo(x, z);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  // shape's local (x, y) -> world (x, z); extrude depth (local z) -> world y (height).
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, 0);
  // after rotateX(-90deg): local (x, y_shape, z_extrude) -> (x, z_extrude, -y_shape)
  // so world Y currently holds the extrude axis (0..height) and world Z holds -shapeY.
  // Flip Z back to positive-forward and center Y on [-height/2, height/2].
  geometry.scale(1, 1, -1);
  geometry.translate(0, -height / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function alignedCylinder(from: THREE.Vector3, to: THREE.Vector3, radiusStart: number, radiusEnd: number, segments = 8): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geometry = new THREE.CylinderGeometry(radiusEnd, radiusStart, length, segments);
  geometry.translate(0, length / 2, 0);
  const mesh = new THREE.Mesh(geometry);
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

// Cached module-wide so the desk-overlay thumbnail reuses the same built group instead of
// rebuilding it on every mount. Callers must not dispose this group's geometry/materials
// since the same instance is shared.
const monitorModelCache = new Map<string, THREE.Group>();

export function createCurvedAllInOneMonitorModel(options: ProceduralModelOptions = {}): THREE.Group {
  const cacheKey = JSON.stringify(options);
  const cached = monitorModelCache.get(cacheKey);
  if (cached) return cached;
  const built = buildCurvedAllInOneMonitorModel(options);
  monitorModelCache.set(cacheKey, built);
  return built;
}

function buildCurvedAllInOneMonitorModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Curved All-in-One Monitor';

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0e,
    roughness: 0.45,
    metalness: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
  });
  const screenMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x05050a,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    sheen: 0.6,
    sheenColor: new THREE.Color(0x2a1a55),
    sheenRoughness: 0.6,
  });
  const standMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9cbce,
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 0.1,
  });
  const bottomBezelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd6d8da,
    roughness: 0.35,
    metalness: 0.4,
  });

  const setShadow = (mesh: THREE.Mesh) => {
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
  };

  // ---- 1) curved monitor body -------------------------------------------
  const bodyGeo = curvedPanelGeometry(W, H, T, CURVE_R);
  const body = new THREE.Mesh(bodyGeo, bodyMaterial);
  body.name = 'monitorBody';
  body.position.set(0, SCREEN_CENTER_Y, 0);
  setShadow(body);
  root.add(body);

  const screenW = W - 2 * TOP_SIDE_BEZEL;
  const screenH = H - TOP_SIDE_BEZEL - BOTTOM_BEZEL;
  const screenGeo = curvedPanelGeometry(screenW, screenH, T * 0.3, CURVE_R);
  const screen = new THREE.Mesh(screenGeo, screenMaterial);
  screen.name = 'screenGlass';
  const screenCenterY = SCREEN_BOTTOM_Y + BOTTOM_BEZEL + screenH / 2;
  screen.position.set(0, screenCenterY, 0.0015);
  setShadow(screen);
  root.add(screen);

  const bezelGeo = new THREE.BoxGeometry(W - 0.05, BOTTOM_BEZEL, T * 0.9);
  const bottomBezel = new THREE.Mesh(bezelGeo, bottomBezelMaterial);
  bottomBezel.name = 'bottomBezelStrip';
  bottomBezel.position.set(0, SCREEN_BOTTOM_Y + BOTTOM_BEZEL / 2, T * 0.06);
  setShadow(bottomBezel);
  root.add(bottomBezel);

  // ---- 2) short stand neck + hub -----------------------------------------
  const neckGeo = new THREE.BoxGeometry(NECK_W, NECK_EXPOSED_H, NECK_T);
  const neck = new THREE.Mesh(neckGeo, standMaterial);
  neck.name = 'standNeck';
  neck.position.set(0, NECK_EXPOSED_H / 2, -T / 2 - NECK_T / 2 + 0.004);
  setShadow(neck);
  root.add(neck);

  const hubGeo = new THREE.SphereGeometry(HUB_SIZE, 16, 12);
  hubGeo.scale(1.3, 0.6, 1.1);
  const hub = new THREE.Mesh(hubGeo, standMaterial);
  hub.name = 'standHub';
  const hubPos = new THREE.Vector3(0, 0.012, -T / 2 - NECK_T / 2 + 0.004);
  hub.position.copy(hubPos);
  setShadow(hub);
  root.add(hub);

  // ---- 3) V-shaped splayed legs ------------------------------------------
  const legTipZOffset = Math.sqrt(Math.max(0, LEG_LEN * LEG_LEN - LEG_TIP_HALF_SPREAD * LEG_TIP_HALF_SPREAD));
  const legTipL = new THREE.Vector3(-LEG_TIP_HALF_SPREAD, 0, hubPos.z + legTipZOffset);
  const legTipR = new THREE.Vector3(LEG_TIP_HALF_SPREAD, 0, hubPos.z + legTipZOffset);
  const hubGround = new THREE.Vector3(0, 0.006, hubPos.z);

  const legL = alignedCylinder(hubGround, legTipL, LEG_THICK, LEG_TIP_THICK, 8);
  legL.name = 'legFrontLeft';
  legL.material = standMaterial;
  setShadow(legL);
  root.add(legL);

  const legR = alignedCylinder(hubGround, legTipR, LEG_THICK, LEG_TIP_THICK, 8);
  legR.name = 'legFrontRight';
  legR.material = standMaterial;
  setShadow(legR);
  root.add(legR);

  const tipCapGeo = new THREE.SphereGeometry(LEG_TIP_THICK, 10, 8);
  const tipCapL = new THREE.Mesh(tipCapGeo, standMaterial);
  tipCapL.position.copy(legTipL);
  setShadow(tipCapL);
  root.add(tipCapL);
  const tipCapR = new THREE.Mesh(tipCapGeo, standMaterial);
  tipCapR.position.copy(legTipR);
  setShadow(tipCapR);
  root.add(tipCapR);

  return root;
}

export function createCurvedAllInOneMonitorLookDevLights(): THREE.Group {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.2, 1.8, 1.4);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-1.4, 0.8, 1.0);
  group.add(fill);
  const rim = new THREE.DirectionalLight(0xccddff, 0.6);
  rim.position.set(-0.5, 1.2, -1.6);
  group.add(rim);
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  group.add(ambient);
  return group;
}

// NOT cached: a PMREMGenerator's output texture is tied to the WebGLRenderTarget of the
// renderer that built it and renders blank with any other renderer -- see
// createDeskSetupModel.ts's createCurvedBirchPlyDeskSetupEnvironment for the full story.
export function createCurvedAllInOneMonitorEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2f2f2);
  const light1 = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
  );
  scene.add(light1);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return env;
}

export function frameCurvedAllInOneMonitorCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  opts: { azimuthDeg: number; elevationDeg: number; margin?: number },
): void {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const margin = opts.margin ?? 1.3;
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

export function configureCurvedAllInOneMonitorRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
