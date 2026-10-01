import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KEYBOARD_SKILLS, type KeyboardSkillKey } from '../data/keyboardSkills';

export type ProceduralModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
  // When false, the nav cluster (PrtSc/ScrLk/Ins/Home/Del/End/arrows) is left out of both
  // the key list and the case width, producing a narrower keyboard rather than one with a
  // blank case area where those keys used to be. Defaults to true so existing callers (the
  // desk-scene's small keyboard) are unaffected.
  includeNavCluster?: boolean;
  // When true, active skill keys get individual accent colors instead of
  // the normal IVORY -- see PRESSABLE_KEY_COLORS. Defaults to false so existing callers (the
  // desk-scene's small keyboard) are unaffected.
  highlightPressableKeys?: boolean;
  // When true, every keycap's label is drawn into one shared canvas atlas instead of each
  // key getting its own CanvasTexture (~80+ separate textures for a full board). The
  // individually-uploaded textures are what causes the visible pop-in on first render --
  // see the atlas helpers below. Defaults to false; only the desk-scene's small keyboard
  // opts in, since the interactive /keyboard page's key count is much smaller.
  atlasLabels?: boolean;
  // Extra height (model units) added to the PRESSABLE_KEYS' keycaps so they stand taller
  // than the rest -- the cap is stretched from the plate up, not floated. Defaults to 0.
  pressableKeyRaise?: number;
  // When true, every keycap can be pressed (motion only), not just the skill keys. The other
  // keys keep their normal height and colors. Defaults to false (the desk page's keyboard).
  pressAllKeys?: boolean;
};

const activeSkillKeys = (Object.keys(KEYBOARD_SKILLS) as KeyboardSkillKey[])
  .filter((key) => KEYBOARD_SKILLS[key].enabled !== false);
export const PRESSABLE_KEYS: ReadonlySet<string> = new Set(activeSkillKeys);

const PRESSABLE_KEY_COLORS: Record<string, string> = Object.fromEntries(
  activeSkillKeys.map((key) => [key, KEYBOARD_SKILLS[key].accent]),
);

// ---- grid ------------------------------------------------------------
const PITCH = 5.0;
// Keycaps nearly touch left to right (like a real board and the reference render); the rows
// stay a little apart front to back.
const GAP_X = 0.2;
const GAP_Z = 0.5;
const KEY_H = 2.5;
export const PRESS_DEPTH = KEY_H * 0.7; // 70% of keycap height (the raised skill keys)
// The plain keys are not raised, so the same travel looks much deeper on them: press less.
export const PLAIN_PRESS_DEPTH = KEY_H * 0.48;

const ROWS = 6; // 0 = back (function row) .. 5 = front (spacebar row)
const MAIN_START = 0;
const MAIN_W = 15;
const NAV_START = MAIN_START + MAIN_W + 0.5;
const NAV_W = 3;

const MARGIN_X = 6;
const MARGIN_BACK = 5;
const MARGIN_FRONT = 8;
const BEVEL_Z = 6;

function getCaseW(includeNavCluster: boolean): number {
  const keyAreaWKu = includeNavCluster ? NAV_START + NAV_W : MAIN_W;
  return MARGIN_X * 2 + keyAreaWKu * PITCH;
}
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

type KeyDef = { row: number; col: number; w: number; d: number; color: string; label: string; textColor?: string };

function colToX(col: number, w: number, caseW: number): number {
  return -caseW / 2 + MARGIN_X + (col + w / 2) * PITCH;
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

function buildKeyList(includeNavCluster: boolean, highlightPressableKeys: boolean): KeyDef[] {
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
  if (includeNavCluster) {
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
  }

  if (highlightPressableKeys) {
    for (const key of keys) {
      const accent = PRESSABLE_KEY_COLORS[key.label];
      if (accent) {
        key.color = accent;
        key.textColor = '#FFFFFF';
      }
    }
  }

  return keys;
}

// Same wedge-profile solid as the standalone keyboard model: a single watertight
// ExtrudeGeometry, closed front/back/left/right/bottom, both ends geometrically
// symmetric by construction (one profile, extruded straight along width).
// Closed polygon outline with its corners rounded by quadratic curves (radius clamped to
// half of the shorter neighbouring edge).
function roundedPolygonShape(points: [number, number][], radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const count = points.length;
  for (let i = 0; i < count; i += 1) {
    const prev = points[(i + count - 1) % count];
    const current = points[i];
    const next = points[(i + 1) % count];
    const toPrev = new THREE.Vector2(prev[0] - current[0], prev[1] - current[1]);
    const toNext = new THREE.Vector2(next[0] - current[0], next[1] - current[1]);
    const r = Math.min(radius, toPrev.length() / 2, toNext.length() / 2);
    const start = current[0] === prev[0] && current[1] === prev[1] ? toPrev : toPrev.clone().setLength(r);
    const end = toNext.clone().setLength(r);
    if (i === 0) shape.moveTo(current[0] + start.x, current[1] + start.y);
    else shape.lineTo(current[0] + start.x, current[1] + start.y);
    shape.quadraticCurveTo(current[0], current[1], current[0] + end.x, current[1] + end.y);
  }
  shape.closePath();
  return shape;
}

const CASE_EDGE_RADIUS = 0.45;
const CASE_END_BEVEL = 0.3;

function buildCaseGeometry(caseW: number): THREE.BufferGeometry {
  const backZ = -CASE_D / 2;
  const frontZ = CASE_D / 2;
  const shoulderZ = CASE_D / 2 - BEVEL_Z;

  const shape = roundedPolygonShape([
    [backZ, 0],
    [backZ, BACK_H],
    [shoulderZ, FRONT_H],
    [frontZ, FRONT_LIP_H],
    [frontZ, 0],
  ], CASE_EDGE_RADIUS);

  // The end bevel is carved out of the extrusion depth (negative offset keeps the outer size),
  // so the case is still exactly caseW wide.
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: caseW - CASE_END_BEVEL * 2,
    bevelEnabled: true,
    bevelSize: CASE_END_BEVEL,
    bevelOffset: -CASE_END_BEVEL,
    bevelThickness: CASE_END_BEVEL,
    bevelSegments: 2,
    steps: 1,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  geometry.translate(-cx, 0, 0);
  return toCreasedNormals(geometry, Math.PI / 4);
}

function drawLabelCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  bgColor: string,
  textColor: string,
  // 'uniform': one size for every word label and one (bigger) for single characters,
  // regardless of key width -- used by the true-aspect per-key textures. 'legacy': the
  // width/length-based sizes the desk page's atlas cells were tuned with.
  sizing: 'legacy' | 'uniform' = 'legacy',
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  if (text === 'Menu') {
    // Hamburger icon instead of the word: three rounded bars, centered.
    const barW = h * 0.34;
    const barH = h * 0.05;
    const gap = h * 0.1;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = barH;
    ctx.lineCap = 'round';
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (const dy of [-gap, 0, gap]) {
      ctx.beginPath();
      ctx.moveTo(cx - barW / 2, cy + dy);
      ctx.lineTo(cx + barW / 2, cy + dy);
      ctx.stroke();
    }
    return;
  }
  if (text) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize: number;
    if (sizing === 'uniform') {
      fontSize = h * (text.length === 1 ? 0.42 : 0.3);
    } else {
      const wide = w > h * 1.5;
      // Ratios of the original 128px-tall cell (40/128, 52/128, 34/128, 30/128, 26/128) so
      // this scales correctly for the smaller atlas cells used on the desk page -- see
      // buildLabelAtlas's CELL_W/CELL_H.
      fontSize = h * (wide ? 0.3125 : 0.40625);
      if (text.length > 5) fontSize = h * (wide ? 0.265625 : 0.234375);
      if (text.length > 8) fontSize = h * 0.203125;
    }
    // Light text on the dark keycaps reads much heavier than the brown text on ivory ones
    // (which the lighting also lightens), so it uses the regular weight to look the same.
    // (DARK_TEXT is the cream text *for* dark keys -- see isLightColor's callers.)
    const fontWeight = sizing === 'uniform' && textColor === DARK_TEXT ? 400 : 600;
    ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;
    // Shrink (never stretch) words that would otherwise run past the keycap edge.
    const maxTextWidth = w * 0.84;
    const measured = ctx.measureText(text).width;
    if (measured > maxTextWidth) {
      fontSize *= maxTextWidth / measured;
      ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;
    }
    ctx.fillText(text, x + w / 2, y + h / 2 + h * 0.015625);
  }
}

// `aspect` is the keycap top face's width/depth. The canvas matches it exactly so the label
// maps onto the face 1:1 -- a fixed square/2:1 canvas got stretched sideways on 1.25u-2.75u
// keys (Ctrl/Alt/Tab/Caps/Enter/Shift...), making their text look wide and squashed.
function makeLabelTexture(text: string, bgColor: string, textColor: string, aspect: number): THREE.CanvasTexture {
  const h = 192;
  const w = Math.round(h * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  drawLabelCell(ctx, 0, 0, w, h, text, bgColor, textColor, 'uniform');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

type UVRect = { u0: number; v0: number; u1: number; v1: number };

// Draws every key's label into one shared canvas instead of each key getting its own
// CanvasTexture. A full board is ~80+ keys, and uploading that many separate textures on
// first render is what causes the visible pop-in -- see ProceduralModelOptions.atlasLabels.
function buildLabelAtlas(keys: KeyDef[]): { texture: THREE.CanvasTexture; uvRects: UVRect[] } {
  // Quarter the per-key resolution of the non-atlas texture (256x128): this atlas is only
  // ever used for the desk-page's small, distant decorative keyboard (see
  // ProceduralModelOptions.atlasLabels), where the extra sharpness isn't visible but a
  // ~2.5MP canvas full of fillText calls plus its one-time GPU upload is real, measurable
  // synchronous cost on first render -- the same pop-in this atlas was built to avoid.
  const cellW = 128;
  const cellH = 64;
  const cols = Math.ceil(Math.sqrt(keys.length));
  const rows = Math.ceil(keys.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d')!;

  const uvRects = keys.map((key, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    const textColor = key.textColor ?? (isLightColor(key.color) ? LIGHT_TEXT : DARK_TEXT);
    drawLabelCell(ctx, x, y, cellW, cellH, key.label, key.color, textColor);
    return {
      u0: x / canvas.width,
      u1: (x + cellW) / canvas.width,
      // Canvas y grows downward; UV v grows upward -- flip.
      v0: 1 - (y + cellH) / canvas.height,
      v1: 1 - y / canvas.height,
    };
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // The atlas has no padding between cells, so a generated mip level would blend each
  // label into its neighbor. Mipmaps aren't needed for a UI-like texture viewed at a
  // roughly fixed distance, so just turn them off instead of adding padding.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { texture: tex, uvRects };
}

function remapTopFaceUV(geo: THREE.BufferGeometry, rect: UVRect): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // The rounded box keeps BoxGeometry's 6 material groups in the order
  // [+x, -x, +y(top), -y(bottom), +z, -z] (see buildKeycapMesh) -- the top face is group 2.
  const top = geo.groups[2];
  for (let i = top.start; i < top.start + top.count; i++) {
    uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
  }
  uv.needsUpdate = true;
}

// A real keycap instead of a plain box: edges rounded, the top narrower than the base (the
// taper that lets light catch each side differently) and a faint dish in the top face, with
// smooth shading across the round-overs. Same 6 material groups as BoxGeometry.
const KEYCAP_RADIUS = 0.7;
const KEYCAP_TAPER = 0.3; // how far the top face is pulled in on each side
const KEYCAP_DISH = 0.03;
function createKeycapGeometry(w: number, d: number, segments = 3): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(w, KEY_H, d, segments, KEYCAP_RADIUS);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const halfH = KEY_H / 2;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (y + halfH) / KEY_H; // 0 at the base, 1 at the top
    let ny = y;
    if (y > halfH - 0.02) {
      const dx = x / (w / 2);
      const dz = z / (d / 2);
      ny -= KEYCAP_DISH * Math.max(0, 1 - (dx * dx + dz * dz));
    }
    position.setXYZ(i, x * (1 - (2 * KEYCAP_TAPER * t) / w), ny, z * (1 - (2 * KEYCAP_TAPER * t) / d));
  }
  position.needsUpdate = true;
  return toCreasedNormals(geometry, Math.PI / 3);
}

function isLightColor(hex: string): boolean {
  return hex === IVORY || hex === SALMON;
}

// sideMaterials: when given, keys of the same color share one side material (atlas mode,
// i.e. the desk page's small keyboard) -- ~80 per-key materials down to a handful, which is
// much less first-frame work. The interactive /keyboard page doesn't pass it, since its
// per-key hover highlight tints a key's own materials.
type AtlasBinding = { material: THREE.MeshStandardMaterial; uv: UVRect; sideMaterials: Map<string, THREE.MeshStandardMaterial> };

function buildKeycapMesh(
  key: KeyDef,
  geometryCache: Map<string, THREE.BufferGeometry>,
  atlas?: AtlasBinding,
): THREE.Mesh {
  const w = key.w * PITCH - GAP_X;
  const d = key.d * PITCH - GAP_Z;

  let geo: THREE.BufferGeometry;
  let topMat: THREE.MeshStandardMaterial;
  if (atlas) {
    // Each atlas key needs its own top-face UV, so unlike the non-atlas path it can't share
    // a cached geometry across same-size keys.
    geo = createKeycapGeometry(w, d, 2);
    remapTopFaceUV(geo, atlas.uv);
    topMat = atlas.material;
  } else {
    const geoKey = `${w.toFixed(3)}x${d.toFixed(3)}`;
    let cached = geometryCache.get(geoKey);
    if (!cached) {
      cached = createKeycapGeometry(w, d);
      geometryCache.set(geoKey, cached);
    }
    geo = cached;
    const textColor = key.textColor ?? (isLightColor(key.color) ? LIGHT_TEXT : DARK_TEXT);
    const labelTex = makeLabelTexture(key.label, key.color, textColor, w / d);
    topMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.6, metalness: 0.05 });
  }

  let sideMat = atlas?.sideMaterials.get(key.color);
  if (!sideMat) {
    sideMat = new THREE.MeshStandardMaterial({ color: key.color, roughness: 0.62, metalness: 0.05 });
    atlas?.sideMaterials.set(key.color, sideMat);
  }
  // BoxGeometry face material order: [+x, -x, +y(top), -y(bottom), +z, -z]
  const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = key.label || 'Spacebar';
  return mesh;
}

// `skill`: one of the colored, raised skill keys (the only ones that open a card).
export type PressableKey = THREE.Group & {
  userData: { key: string; pressable: true; skill: boolean; restY: number; pressDepth: number };
};

export function createKeyboardModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TKL Keyboard';

  const includeNavCluster = options.includeNavCluster ?? true;
  const highlightPressableKeys = options.highlightPressableKeys ?? false;
  const useLabelAtlas = options.atlasLabels ?? false;
  const pressableKeyRaise = options.pressableKeyRaise ?? 0;
  const pressAllKeys = options.pressAllKeys ?? false;
  const caseW = getCaseW(includeNavCluster);

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
  const caseMesh = new THREE.Mesh(buildCaseGeometry(caseW), caseMaterial);
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
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const keyList = buildKeyList(includeNavCluster, highlightPressableKeys);

  let atlasMaterial: THREE.MeshStandardMaterial | null = null;
  let atlasUvRects: UVRect[] | null = null;
  if (useLabelAtlas) {
    const atlas = buildLabelAtlas(keyList);
    atlasMaterial = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, metalness: 0.05 });
    atlasUvRects = atlas.uvRects;
  }

  const sideMaterials = new Map<string, THREE.MeshStandardMaterial>();
  for (const [index, key] of keyList.entries()) {
    const x = colToX(key.col, key.w, caseW);
    const z = rowToZ(key.row, key.d);
    const y = plateY(z) + KEY_H / 2;
    const mesh = buildKeycapMesh(
      key,
      geometryCache,
      atlasMaterial && atlasUvRects ? { material: atlasMaterial, uv: atlasUvRects[index], sideMaterials } : undefined,
    );
    setShadow(mesh);

    const isSkillKey = PRESSABLE_KEYS.has(key.label);
    if (isSkillKey || pressAllKeys) {
      const group = new THREE.Group() as PressableKey;
      group.name = `pressable-${key.label || 'Space'}`;
      group.position.set(x, y, z);
      if (isSkillKey) {
        // Geometry is shared through geometryCache, so stretch the mesh instead: bottom stays
        // on the plate, top rises by pressableKeyRaise.
        mesh.scale.y = (KEY_H + pressableKeyRaise) / KEY_H;
        mesh.position.set(0, pressableKeyRaise / 2, 0);
      }
      group.add(mesh);
      group.userData = { key: key.label, pressable: true, skill: isSkillKey, restY: y, pressDepth: isSkillKey ? PRESS_DEPTH : PLAIN_PRESS_DEPTH };
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
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(0.8, 2.0, 1.4);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.85);
  fill.position.set(-1.0, 1.4, 1.0);
  group.add(fill);
  const rim = new THREE.DirectionalLight(0xd8dcff, 0.4);
  rim.position.set(-0.3, 1.2, -1.6);
  group.add(rim);
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
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
  // `up`: optional fixed up reference. Without it the up vector is swapped near straight-
  // down (see below), which changes the fit distance abruptly at that elevation -- an
  // animated camera passing through it visibly jolts, so animated callers pass one that is
  // continuous across elevations.
  opts: { azimuthDeg: number; elevationDeg: number; margin?: number; up?: THREE.Vector3; smoothFit?: number },
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
  if (opts.up) camera.up.copy(opts.up);
  else camera.up.set(0, Math.abs(dir.y) > 0.999 ? 0 : 1, Math.abs(dir.y) > 0.999 ? -1 : 0);

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
  const widthFit = halfWidth / Math.tan(hFov / 2);
  const heightFit = halfHeight / Math.tan(vFov / 2);
  // A hard max has a corner where the binding side switches from width to height, so a
  // camera animated through that point suddenly changes its dolly speed. smoothFit rounds
  // the corner (a fraction of the fit distance); far from the crossover it equals the max.
  const smoothK = (opts.smoothFit ?? 0) * Math.max(widthFit, heightFit);
  const fit = smoothK > 0
    ? (widthFit + heightFit + Math.sqrt((widthFit - heightFit) ** 2 + smoothK ** 2)) / 2
    : Math.max(widthFit, heightFit);
  const distance = fit * margin;

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
