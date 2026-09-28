import * as THREE from 'three';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

const OVERALL_W = 100;
const OVERALL_D = 55; // width:depth ~= 1.8:1
const THICKNESS = 3.0; // ~3% of width
const BEVEL_MARGIN = 2.5; // where the flat top cap begins, inset from the outer edge
const BEVEL_THICKNESS = 0.35;
const BEVEL_SIZE = 1.6;
const CORNER_RADIUS = OVERALL_D * 0.09; // quarter-circle corner radius, D x 0.08-0.10
const WORK_CORNER_RADIUS = CORNER_RADIUS * 0.65; // 60-70% of the outer radius
const CORNER_SEGMENTS = 16;

const FLAT_TOP_W = OVERALL_W - 2 * BEVEL_MARGIN; // 95
const FLAT_TOP_D = OVERALL_D - 2 * BEVEL_MARGIN; // 50
const WORK_W = OVERALL_W * 0.80; // 80
const WORK_D = OVERALL_D * 0.74; // ~40.7
const SIDE_PANEL_W = (FLAT_TOP_W - WORK_W) / 2; // 7.5

const CASE_COLOR = 0x101113;
const CONTROL_COLOR = 0x17181b;
const WORK_COLOR = 0x3d4148;
const BUTTON_COLOR = 0x2a2b2f;
const BUTTON_MARK_COLOR = 0xb8bac0;

// True quarter-circle corners (THREE.Shape.absarc), not a diagonal chamfer -- each
// corner is a real 90-degree arc of constant radius, tessellated by CORNER_SEGMENTS,
// with no vertex-angle kink where the straight edges meet the curve.
function roundedRectShape(w: number, d: number, radius: number): THREE.Shape {
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.min(radius, hw, hd);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hd - r);
  shape.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hd);
  shape.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hd + r);
  shape.absarc(-hw + r, -hd + r, r, Math.PI, 1.5 * Math.PI, false);
  shape.closePath();
  return shape;
}

function buildRoundedSlabGeometry(
  w: number,
  d: number,
  radius: number,
  thickness: number,
  bevelThickness: number,
  bevelSize: number,
): THREE.BufferGeometry {
  const shape = roundedRectShape(w, d, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevelThickness > 0 && bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments: 5,
    steps: 1,
    curveSegments: CORNER_SEGMENTS,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const cy = (bb.min.y + bb.max.y) / 2;
  geo.translate(0, -cy, 0);
  geo.computeVertexNormals();
  return geo;
}

function buildBaseGeometry(): THREE.BufferGeometry {
  return buildRoundedSlabGeometry(OVERALL_W, OVERALL_D, CORNER_RADIUS, THICKNESS, BEVEL_THICKNESS, BEVEL_SIZE);
}

// Cached module-wide so the desk-overlay thumbnail and any other caller reuse the same
// built group instead of rebuilding it on every mount. Callers must not dispose this
// group's geometry/materials since the same instance is shared.
const tabletModelCache = new Map<string, THREE.Group>();

export function createTabletModel(options: ProceduralModelOptions = {}): THREE.Group {
  const cacheKey = JSON.stringify(options);
  const cached = tabletModelCache.get(cacheKey);
  if (cached) return cached;
  const built = buildTabletModel(options);
  tabletModelCache.set(cacheKey, built);
  return built;
}

function buildTabletModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Graphics Tablet';

  const setShadow = (mesh: THREE.Mesh) => {
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
  };

  const baseMaterial = new THREE.MeshPhysicalMaterial({
    color: CASE_COLOR,
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.15,
    clearcoatRoughness: 0.6,
  });
  const base = new THREE.Mesh(buildBaseGeometry(), baseMaterial);
  base.name = 'tabletBase';
  setShadow(base);
  root.add(base);

  // The base is recentred vertically in buildBaseGeometry(). The top BEVEL CAP (the
  // fully-inset flat face the bevel tapers up to) sits at thickness/2 + bevelThickness
  // above the vertical centre -- keep these two numbers in sync with buildBaseGeometry().
  const flatTopY = THICKNESS / 2 + BEVEL_THICKNESS;

  // Panels and the work area are embedded DOWN into the base and just barely break its
  // top surface, instead of sitting on top of it -- that reads as one thin integrated
  // slab rather than a second stacked layer.
  const panelH = 0.9;
  const panelProud = 0.03;

  const controlMaterial = new THREE.MeshStandardMaterial({ color: CONTROL_COLOR, roughness: 0.6, metalness: 0.05 });
  const railD = FLAT_TOP_D - 3;
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(SIDE_PANEL_W, panelH, railD), controlMaterial);
  leftPanel.name = 'leftControlPanel';
  leftPanel.position.set(-(WORK_W / 2 + SIDE_PANEL_W / 2), flatTopY + panelProud - panelH / 2, 0);
  setShadow(leftPanel);
  root.add(leftPanel);

  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(SIDE_PANEL_W, panelH, railD), controlMaterial);
  rightPanel.name = 'rightControlPanel';
  rightPanel.position.set(WORK_W / 2 + SIDE_PANEL_W / 2, flatTopY + panelProud - panelH / 2, 0);
  setShadow(rightPanel);
  root.add(rightPanel);

  const workMaterial = new THREE.MeshStandardMaterial({ color: WORK_COLOR, roughness: 0.75, metalness: 0.0 });
  const workArea = new THREE.Mesh(
    buildRoundedSlabGeometry(WORK_W, WORK_D, WORK_CORNER_RADIUS, panelH, 0, 0),
    workMaterial,
  );
  workArea.name = 'workArea';
  // The base is a solid slab, not a hollow shell, so a panel embedded BELOW its top
  // surface is invisible -- flush-to-barely-proud (matching the side rails) is the only
  // way to keep the "same as or a hair lower" relationship visible.
  workArea.position.set(0, flatTopY + panelProud - panelH / 2, 0);
  setShadow(workArea);
  root.add(workArea);

  // small flat function buttons set into the left/right control rails (2 per side) --
  // dark bases with a small light-grey centre mark, not bright screw-like rings.
  const buttonGroup = new THREE.Group();
  buttonGroup.name = 'railButtons';
  const buttonMat = new THREE.MeshStandardMaterial({ color: BUTTON_COLOR, roughness: 0.5, metalness: 0.05 });
  const buttonMarkMat = new THREE.MeshStandardMaterial({ color: BUTTON_MARK_COLOR, roughness: 0.4, metalness: 0.1 });
  const btnRadius = 1.15;
  const btnHeight = 0.22;
  const btnGeo = new THREE.CylinderGeometry(btnRadius, btnRadius, btnHeight, 14);
  const btnMarkGeo = new THREE.CylinderGeometry(btnRadius * 0.35, btnRadius * 0.35, btnHeight * 1.05, 10);

  const railX = { left: -(WORK_W / 2 + SIDE_PANEL_W / 2), right: WORK_W / 2 + SIDE_PANEL_W / 2 };
  const railZ = railD * 0.22;
  const buttonSpots: [number, number][] = [
    [railX.left, -railZ], [railX.left, railZ],
    [railX.right, -railZ], [railX.right, railZ],
  ];
  for (const [x, z] of buttonSpots) {
    const topY = flatTopY + panelProud;
    const btn = new THREE.Mesh(btnGeo, buttonMat);
    btn.position.set(x, topY + btnHeight / 2, z);
    setShadow(btn);
    buttonGroup.add(btn);
    const mark = new THREE.Mesh(btnMarkGeo, buttonMarkMat);
    mark.position.set(x, topY + btnHeight, z);
    setShadow(mark);
    buttonGroup.add(mark);
  }
  root.add(buttonGroup);

  return root;
}

export function createTabletLookDevLights(): THREE.Group {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1.0, 2.2, 1.4);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-1.2, 1.2, 0.8);
  group.add(fill);
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  group.add(ambient);
  return group;
}

// NOT cached: a PMREMGenerator's output texture is tied to the WebGLRenderTarget of the
// renderer that built it and renders blank with any other renderer -- see
// createDeskSetupModel.ts's createCurvedBirchPlyDeskSetupEnvironment for the full story.
export function createTabletEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
  );
  scene.add(sphere);
  const env = pmrem.fromScene(scene, 0.06).texture;
  pmrem.dispose();
  return env;
}

// Matches the desk-setup model's frameCurvedBirchPlyDeskSetupCamera() formula exactly
// (max-dimension tangent fit, not a diagonal-sphere fit) so the same azimuth/elevation/
// FOV/margin numbers produce the same camera "feel" across every standalone model.
export function frameTabletCamera(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  opts: { azimuthDeg: number; elevationDeg: number; margin?: number },
): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = opts.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / 2) / Math.tan(fov / 2);

  const az = (opts.azimuthDeg * Math.PI) / 180;
  const el = (opts.elevationDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  camera.up.set(0, 1, 0);
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

export function configureTabletRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
