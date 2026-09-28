import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius: number,
  cylLength: number,
  capSegments: number,
  radialSegments: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom: number) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts: number[] = [];
  const ringV: number[] = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts: number[] = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts: number[] = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// The desk is the heaviest procedural build in the app (curved-edge geometry plus five
// 512x512 canvas-painted PBR maps), and DeskPage remounts it every time the user leaves
// and returns. Caching the built group means that cost is paid once per page load instead
// of once per visit -- callers must not dispose this group's geometry/materials since the
// same instance is handed out to every caller.
const deskSetupModelCache = new Map<string, THREE.Group>();

export function createCurvedBirchPlyDeskSetupModel(options: ProceduralModelOptions = {}): THREE.Group {
  const cacheKey = JSON.stringify(options);
  const cached = deskSetupModelCache.get(cacheKey);
  if (cached) return cached;
  const built = buildCurvedBirchPlyDeskSetupModel(options);
  deskSetupModelCache.set(cacheKey, built);
  return built;
}

// Generated from ObjectSculptSpec target: Curved Birch Ply Desk Setup
// Sculpt build pass: optimization-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
function buildCurvedBirchPlyDeskSetupModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Curved Birch Ply Desk Setup";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["plywoodBirch"] = createSculptMaterial(
    "plywoodBirch",
    {"id": "plywoodBirch", "name": "Birch plywood laminate (satin)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#E4D4AE", "color": "#E4D4AE", "albedo": {"dominant": "#E4D4AE", "secondary": ["#D8C69A", "#C9B383"], "samplingNotes": "Pale warm birch tone sampled from the tabletop top face; slightly deeper tone in the reveal/seam shadows."}, "colorVariation": {"palette": ["#E4D4AE", "#D8C69A", "#C9B383"], "pattern": "linear-grain-streaks", "amplitude": 0.08, "heightCorrelation": 0.1}, "textureResolution": 2048, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world-scale grain density across tabletop, leg, and pedestal so grain does not stretch differently per part."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.1, "role": "broad panel-to-panel tone variation"}, {"id": "meso", "frequency": 18.0, "amplitude": 0.12, "role": "linear wood-grain streaks"}, {"id": "micro", "frequency": 90.0, "amplitude": 0.04, "role": "satin-finish micro-roughness breakup"}], "roughness": {"base": 0.55, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "slightly lower roughness on the worn front-center edge of the tabletop"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.25, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "linear-grain", "amplitude": 0.008, "scale": 18.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.3, "contactShadowBias": 0.4, "notes": "Darken the drawer reveal gaps, the pedestal top-inset line, and the desk's floor contact lines."}, "wear": {"edgeWear": 0.1, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "edge-band-lamination", "appliesTo": ["tabletop", "leftLegPanel"], "zone": "cut-edge UV strip", "description": "Alternating thin light (#E4D4AE) and dark (#8A6A3E) horizontal bands simulating visible plywood ply lines on every exposed cut edge.", "evidenceRefs": ["tabletop-thickness-edge-band"]}, {"id": "reveal-line-darkening", "appliesTo": ["pedestalCarcass", "drawerFront0", "drawerFront1", "drawerFront2"], "zone": "reveal gap faces", "description": "Reveal gaps and the pedestal-to-tabletop seam read near-black (#1A1712) in the crevice, not the base albedo.", "evidenceRefs": ["pedestal-drawer-reveal-gaps", "pedestal-top-inset-line"]}], "shaderNotes": ["MeshStandardMaterial is sufficient; no clearcoat/transmission observed on this finish.", "Bake the edge-band lamination as a separate material index / UV region rather than a full-surface texture so the top/bottom faces stay a clean solid-ish tone.", "Keep roughness in the 0.45-0.65 range; this reads as satin/low-sheen laminate, not gloss lacquer and not raw unfinished wood."], "notes": "Shared by tabletop, leftLegPanel, pedestalCarcass, and all three drawerFronts so the whole carcass reads as one continuous material family."},
    options
  );
  materialMap["metalHardware"] = createSculptMaterial(
    "metalHardware",
    {"id": "metalHardware", "name": "Brushed champagne-silver hardware", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#C9C2B0", "color": "#C9C2B0", "albedo": {"dominant": "#C9C2B0", "secondary": ["#A8A190", "#E0DBCB"], "samplingNotes": "Warm-toned brushed metal, not pure chrome; picks up a slight champagne cast."}, "colorVariation": {"palette": ["#C9C2B0", "#A8A190", "#E0DBCB"], "pattern": "anisotropic-brushed-streaks", "amplitude": 0.12, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [4.0, 1.0], "anisotropy": 8, "texelDensityIntent": "Brush streaks run along the bar's long axis at a fixed world-scale frequency."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.15, "role": "broad highlight roll-off along the bar"}, {"id": "meso", "frequency": 40.0, "amplitude": 0.1, "role": "brushed-metal linear streaks"}, {"id": "micro", "frequency": 140.0, "amplitude": 0.05, "role": "fine anisotropic highlight breakup"}], "roughness": {"base": 0.32, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "lower roughness along the brushed-streak direction, higher across it (anisotropic)"}, "metalness": {"base": 0.9, "variation": 0.05}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.2, "scale": 40.0, "space": "tangent"}, "bump": {"pattern": "anisotropic-brushed-streaks", "amplitude": 0.003, "scale": 40.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "Contact shadow where each standoff meets the drawer face."}, "wear": {"edgeWear": 0.05, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Use MeshStandardMaterial with high metalness and an environment map for reflections; no procedural env is generated by this pipeline, so document that the runtime scene should supply one.", "Keep roughness anisotropic-looking via the brushed streak bump/normal, not a uniform low value, or the bar reads as chrome rather than brushed metal."], "notes": "Shared by all three drawer handles."},
    options
  );
  materialMap["deskMatRubber"] = createSculptMaterial(
    "deskMatRubber",
    {"id": "deskMatRubber", "name": "Matte black desk mat surface", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#161616", "color": "#161616", "albedo": {"dominant": "#161616", "secondary": ["#1E1E1E", "#0D0D0D"], "samplingNotes": "Near-black, very low value range; avoid pure #000000 which loses all shading."}, "colorVariation": {"palette": ["#161616", "#1E1E1E", "#0D0D0D"], "pattern": "fine-woven-noise", "amplitude": 0.05, "heightCorrelation": 0.05}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [3.0, 3.0], "anisotropy": 4, "texelDensityIntent": "Fine fabric/rubber weave repeats at a small, consistent world-scale frequency."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.03, "role": "very subtle overall tone breakup"}, {"id": "meso", "frequency": 60.0, "amplitude": 0.05, "role": "woven-fabric/rubber micro-texture"}, {"id": "micro", "frequency": 200.0, "amplitude": 0.02, "role": "fine matte speckle breaking up specular"}], "roughness": {"base": 0.9, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "uniformly high roughness; this is a deliberately non-reflective surface"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.15, "scale": 60.0, "space": "tangent"}, "bump": {"pattern": "fine-woven-noise", "amplitude": 0.001, "scale": 60.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.15, "contactShadowBias": 0.25, "notes": "Soft contact shadow under the raised perimeter lip."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Keep roughness high (>=0.85) across the whole surface; this is the pipeline's #1 failure mode for mats -- reading as glossy plastic instead of matte fabric/rubber.", "No metalness, no clearcoat."], "notes": ""},
    options
  );
  materialMap["glassClear"] = createSculptMaterial(
    "glassClear",
    {"id": "glassClear", "name": "Clear tempered glass (green-cyan edge tint)", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#F4FAF8", "color": "#F4FAF8", "albedo": {"dominant": "#F4FAF8", "secondary": ["#BFE8DD", "#9FDFD0"], "samplingNotes": "The body of the glass must read as near-transparent (you can see through it), not an opaque colored plate. Only the thin cut edge concentrates a teal/dark-green tempered-glass tint -- see the edge-tint-band localOverride."}, "colorVariation": {"palette": ["#F2F7F5", "#BFE8DD", "#9FDFD0"], "pattern": "edge-concentrated-tint", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Not detail-critical; transmission carries most of the read."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.05, "role": "overall transmission tint falloff toward edges"}, {"id": "meso", "frequency": 4.0, "amplitude": 0.02, "role": "faint edge-band tint concentration"}, {"id": "micro", "frequency": 20.0, "amplitude": 0.01, "role": "negligible; glass is optically flat at this scale"}], "roughness": {"base": 0.03, "variation": 0.01, "map": "independent-procedural-field", "localResponse": "uniformly low; specular highlights should stay sharp"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.0, "contactShadowBias": 0.1, "notes": "Minimal AO; transmissive material does not read typical occlusion."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "edge-tint-band", "appliesTo": ["glassPlatform"], "zone": "cut-edge faces", "description": "Green-cyan/teal tint concentrated on the thin edge-facing (cut) faces of the glass shelf; the top and bottom faces stay transmissive/near-clear.", "evidenceRefs": ["glass-riser-tinted-edge"]}], "shaderNotes": ["MeshPhysicalMaterial with transmission ~0.92, ior 1.5, roughness ~0.03 -- this is what makes the shelf read as see-through glass instead of an opaque slab.", "The edge-tint local override is the only place a strong color should show; top/bottom/large faces stay clear.", "Requires an environment map for believable refraction highlights; documented as a runtime-scene dependency since this pipeline does not generate HDRIs."], "notes": "Used only by glassPlatform now (the old glass legs were replaced by white plastic + silver metal parts).", "transmission": {"base": 0.92, "variation": 0.02}, "ior": {"base": 1.5}, "opacity": {"base": 1.0}},
    options
  );
  materialMap["riserPlastic"] = createSculptMaterial(
    "riserPlastic",
    {"id": "riserPlastic", "name": "White plastic support leg (USB-hub housing)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#F2F2EF", "color": "#F2F2EF", "albedo": {"dominant": "#F2F2EF", "secondary": ["#E6E6E2", "#FAFAF8"], "samplingNotes": "Off-white/cream plastic housing, slightly warmer than pure white; picks up soft ambient shading on its rounded top edge."}, "colorVariation": {"palette": ["#F2F2EF", "#E6E6E2", "#FAFAF8"], "pattern": "smooth-plastic-gradient", "amplitude": 0.04, "heightCorrelation": 0.1}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Not detail-critical; smooth injection-molded plastic reads mostly from roughness/AO, not albedo texture."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.05, "role": "broad panel-to-panel tone/shading variation"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.03, "role": "faint seam line where the two shell halves meet"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.015, "role": "fine plastic micro-roughness breaking up specular"}], "roughness": {"base": 0.35, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "slightly lower roughness on the rounded top edge where light catches it"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.1, "scale": 8.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "Darken the seam line and the foot contact edge."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "shell-seam-line", "appliesTo": ["riserLegLeft", "riserLegRight"], "zone": "horizontal seam partway down the housing", "description": "Faint horizontal seam line where the housing's upper and lower shell halves meet, visible as a thin shadow line.", "evidenceRefs": ["riser-leg-usb-hub-detail"]}], "shaderNotes": ["Semi-gloss injection-molded plastic; keep roughness low-mid (0.3-0.4), not matte and not mirror-gloss."], "notes": "Shared by both support-leg housings (riserLegLeft, riserLegRight)."},
    options
  );
  materialMap["riserFoot"] = createSculptMaterial(
    "riserFoot",
    {"id": "riserFoot", "name": "Support-leg foot pad (light silver-gray)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#C7C7C2", "color": "#C7C7C2", "albedo": {"dominant": "#C7C7C2", "secondary": ["#B4B4AE", "#D6D6D1"], "samplingNotes": "Light warm-gray foot pad, visibly distinct in tone from the white housing above it."}, "colorVariation": {"palette": ["#C7C7C2", "#B4B4AE", "#D6D6D1"], "pattern": "smooth-plastic-gradient", "amplitude": 0.05, "heightCorrelation": 0.1}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Small part; texture detail not critical."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.04, "role": "broad tone read"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.02, "role": "subtle rim highlight"}, {"id": "micro", "frequency": 30.0, "amplitude": 0.01, "role": "fine plastic micro-roughness"}], "roughness": {"base": 0.4, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "uniform"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Contact shadow where the foot meets the desktop."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Slightly lower gloss than the main housing so it reads as a separate rubber/plastic foot part, not the same shell."], "notes": "Shared by both feet."},
    options
  );
  materialMap["metalSilver"] = createSculptMaterial(
    "metalSilver",
    {"id": "metalSilver", "name": "Brushed silver aluminum support leg", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#C8C8CA", "color": "#C8C8CA", "albedo": {"dominant": "#C8C8CA", "secondary": ["#AAAAAE", "#E4E4E6"], "samplingNotes": "Semi-gloss silver aluminum, distinctly metallic and cooler-toned than the white plastic housing above it."}, "colorVariation": {"palette": ["#C8C8CA", "#AAAAAE", "#E4E4E6"], "pattern": "anisotropic-brushed-streaks", "amplitude": 0.12, "heightCorrelation": 0.15}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 1.0], "anisotropy": 8, "texelDensityIntent": "Brush streaks run along the leg's long axis at a fixed world-scale frequency."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.12, "role": "broad highlight roll-off along the leg/runner"}, {"id": "meso", "frequency": 30.0, "amplitude": 0.08, "role": "brushed-metal linear streaks"}, {"id": "micro", "frequency": 120.0, "amplitude": 0.04, "role": "fine anisotropic highlight breakup"}], "roughness": {"base": 0.4, "variation": 0.08, "map": "independent-procedural-field", "localResponse": "lower roughness along the brush direction, higher across it"}, "metalness": {"base": 0.85, "variation": 0.05}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.15, "scale": 30.0, "space": "tangent"}, "bump": {"pattern": "anisotropic-brushed-streaks", "amplitude": 0.002, "scale": 30.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "Contact shadow where the runner meets the desk and where the vertical leg meets the housing above."}, "wear": {"edgeWear": 0.05, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial, high metalness, moderate roughness -- semi-gloss brushed aluminum, not a mirror chrome finish."], "notes": "Shared by all four leg/runner parts (left+right, vertical+runner)."},
    options
  );
  materialMap["portPanelDark"] = createSculptMaterial(
    "portPanelDark",
    {"id": "portPanelDark", "name": "Recessed light-gray port panel background", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#D8D8D5", "color": "#D8D8D5", "albedo": {"dominant": "#D8D8D5", "secondary": ["#CACAC6", "#E4E4E1"], "samplingNotes": "Light warm-gray recessed panel background, slightly darker than the white housing (#F2F2EF) but NOT black; black is reserved for the USB slot interiors only."}, "colorVariation": {"palette": ["#D8D8D5", "#CACAC6", "#E4E4E1"], "pattern": "flat-with-print-labels", "amplitude": 0.06, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Small inset panel; the printed 'USB 2.0' label and jack-ring colors (red mic ring, green headphone ring) are albedo-only detail, not geometry."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.05, "role": "panel vs housing tone contrast"}, {"id": "meso", "frequency": 10.0, "amplitude": 0.03, "role": "jack-ring and USB-slot silhouette breakup (albedo only)"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.01, "role": "fine plastic micro-roughness"}], "roughness": {"base": 0.5, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "uniform"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.3, "contactShadowBias": 0.4, "notes": "Recessed relative to the housing face, so its border reads a soft AO line."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "jack-and-usb-icons", "appliesTo": ["portPanel"], "zone": "full panel face", "description": "Pink mic jack, green headphone jack, and 3 black vertical USB-2.0 slot icons sit on top of this light-gray panel background as separate small proud components.", "evidenceRefs": ["riser-side-and-front-detail"]}], "shaderNotes": ["Flat matte-ish dark panel; the port icons/label are an albedo pattern, not geometry, at this quality tier."], "notes": "Background only; the mic/headphone/USB icons are separate materials (micPink/headphoneGreen/usbSlotGray)."},
    options
  );
  materialMap["micPink"] = createSculptMaterial(
    "micPink",
    {"id": "micPink", "name": "Mic jack ring (pink)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#E67896", "color": "#E67896", "albedo": {"dominant": "#E67896", "secondary": ["#E67896", "#E67896"], "samplingNotes": "Small printed/anodized icon color on the port panel."}, "colorVariation": {"palette": ["#E67896"], "pattern": "flat", "amplitude": 0.02, "heightCorrelation": 0.0}, "roughness": {"base": 0.5, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "uniform"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.15, "contactShadowBias": 0.2, "notes": ""}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Small flat-colored icon, mic jack ring (pink)."], "notes": "", "textureless": {"declared": true, "evidence": ["Small flat-colored plastic ring, no visible texture detail at this scale."]}},
    options
  );
  materialMap["headphoneGreen"] = createSculptMaterial(
    "headphoneGreen",
    {"id": "headphoneGreen", "name": "Headphone jack ring (green)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#78C88C", "color": "#78C88C", "albedo": {"dominant": "#78C88C", "secondary": ["#78C88C", "#78C88C"], "samplingNotes": "Small printed/anodized icon color on the port panel."}, "colorVariation": {"palette": ["#78C88C"], "pattern": "flat", "amplitude": 0.02, "heightCorrelation": 0.0}, "roughness": {"base": 0.5, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "uniform"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.15, "contactShadowBias": 0.2, "notes": ""}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Small flat-colored icon, headphone jack ring (green)."], "notes": "", "textureless": {"declared": true, "evidence": ["Small flat-colored plastic ring, no visible texture detail at this scale."]}},
    options
  );
  materialMap["usbSlotGray"] = createSculptMaterial(
    "usbSlotGray",
    {"id": "usbSlotGray", "name": "USB-2.0 slot interior (black)", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#1A1A1B", "color": "#1A1A1B", "albedo": {"dominant": "#1A1A1B", "secondary": ["#0F0F10", "#232324"], "samplingNotes": "Small printed/anodized icon color on the port panel."}, "colorVariation": {"palette": ["#D2D2D4"], "pattern": "flat", "amplitude": 0.02, "heightCorrelation": 0.0}, "roughness": {"base": 0.55, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "uniform"}, "metalness": {"base": 0.1, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.15, "contactShadowBias": 0.2, "notes": ""}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Small flat-colored icon, usb-2.0 slot (metallic gray)."], "notes": "", "textureless": {"declared": true, "evidence": ["Small flat-black recessed slot interior, no visible texture detail at this scale."]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_tabletop_0 = makeAttachmentEndpoint(null);
  const node_tabletop_0 = new THREE.Group();
  node_tabletop_0.name = "Tabletop slab__pivot";
  node_tabletop_0.scale.set(1, 1, 1);
  if (endpoint_tabletop_0) {
    node_tabletop_0.position.copy(endpoint_tabletop_0.start);
    node_tabletop_0.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_tabletop_0.position.set(0.0, 0.685, 0.39);
    node_tabletop_0.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_tabletop_0.userData.sculptComponent = {"id": "tabletop", "name": "Tabletop slab", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "The front edge is a continuous concave-then-convex S-curve (wave/kidney silhouette), authored as an extruded 2D top-down profile (Shape + ExtrudeGeometry). The component is rotated -90 degrees about X so the extrude's sweep axis (thickness) becomes world-up: profile X maps to world width (dimensions.width), profile Y maps to world depth/front-back (dimensions.height, reused post-rotation as the depth scale field), and the extrude sweep maps to world height/thickness (dimensions.depth, reused post-rotation as the thickness scale field). Verified in the browser viewer from a top-down angle: the wave lands on the front edge as intended, with the mat and glass riser correctly resting on top.", "geometryDescriptor": {"topologyIntent": "flat slab of constant thickness extruded from a 2D top-down outline whose front edge carries the wave curve, then rotated so the extrude axis becomes vertical", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.003, "segments": 2}, "deformationStack": [], "uvStrategy": "planar-projected from top, edge faces use a separate strip UV for the lamination bands", "normalStrategy": "vertex normals from generated geometry, flat-shaded on top/bottom faces", "profile2D": {"points": [[-0.5, -0.5], [-0.375, -0.46], [-0.25, -0.4], [-0.125, -0.36], [0.0, -0.38], [0.125, -0.44], [0.25, -0.49], [0.375, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 1.7, "height": 0.78, "depth": 0.035, "units": "meters", "confidence": 0.7}, "transform": {"position": [0, 0.685, 0.39], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.685, 0.39], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.7, 0.035, 0.78], "isTrigger": false, "notes": "Flat box proxy; the wave edge is cosmetic and does not need physical accuracy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel", "tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-leftLegPanel", "withComponent": "leftLegPanel", "overlap": 0.02}, {"id": "tabletop-to-pedestalCarcass", "withComponent": "pedestalCarcass", "overlap": 0.02}], "localFeatures": [{"id": "tabletop-front-wave-edge", "kind": "silhouette-curve", "description": "Front-facing outline edge is a cubic-bezier S-curve, not straight or single-radius; author as the extrusion profile's front boundary.", "evidenceRefs": ["full-object"]}, {"id": "tabletop-thickness-edge-band", "kind": "material-local-override", "description": "Visible cut edge shows alternating light/dark plywood lamination lines; realized as a localOverride on plywoodBirch restricted to the edge-facing UV strip.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.01, "normalPattern": "subtle wood-grain directional streaks along the long axis", "displacementPattern": "none", "occlusionPattern": "slight darkening at the underside near the leg/pedestal seams", "edgeWearPattern": "very light sheen wear at the front-center edge where hands rest", "notes": "Top face reads satin/low-gloss, not glossy lacquer."}, "evidenceRefs": ["full-object"], "details": ["tabletop-front-wave-edge", "tabletop-thickness-edge-band"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_tabletop_0.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.685, 0.39], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.7, 0.035, 0.78], "isTrigger": false, "notes": "Flat box proxy; the wave edge is cosmetic and does not need physical accuracy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel", "tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["root"] ?? root).add(node_tabletop_0);
  nodes["tabletop"] = node_tabletop_0;
  const mesh_tabletop_0Geometry = endpoint_tabletop_0
    ? new THREE.CylinderGeometry(endpoint_tabletop_0.endRadius, endpoint_tabletop_0.baseRadius, endpoint_tabletop_0.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.5, -0.5], [-0.375, -0.46], [-0.25, -0.4], [-0.125, -0.36], [0.0, -0.38], [0.125, -0.44], [0.25, -0.49], [0.375, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], "depth": 1.0});
  if (!endpoint_tabletop_0) {
    mesh_tabletop_0Geometry.scale(1.7, 0.78, 0.035);
  }
  const mesh_tabletop_0 = new THREE.Mesh(
    mesh_tabletop_0Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tabletop_0.name = "Tabletop slab";
  if (endpoint_tabletop_0) {
    mesh_tabletop_0.position.copy(endpoint_tabletop_0.midpoint);
    mesh_tabletop_0.quaternion.copy(endpoint_tabletop_0.quaternion);
  }
  mesh_tabletop_0.castShadow = options.castShadow ?? true;
  mesh_tabletop_0.receiveShadow = options.receiveShadow ?? true;
  mesh_tabletop_0.userData.sculptComponent = {"id": "tabletop", "name": "Tabletop slab", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "The front edge is a continuous concave-then-convex S-curve (wave/kidney silhouette), authored as an extruded 2D top-down profile (Shape + ExtrudeGeometry). The component is rotated -90 degrees about X so the extrude's sweep axis (thickness) becomes world-up: profile X maps to world width (dimensions.width), profile Y maps to world depth/front-back (dimensions.height, reused post-rotation as the depth scale field), and the extrude sweep maps to world height/thickness (dimensions.depth, reused post-rotation as the thickness scale field). Verified in the browser viewer from a top-down angle: the wave lands on the front edge as intended, with the mat and glass riser correctly resting on top.", "geometryDescriptor": {"topologyIntent": "flat slab of constant thickness extruded from a 2D top-down outline whose front edge carries the wave curve, then rotated so the extrude axis becomes vertical", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.003, "segments": 2}, "deformationStack": [], "uvStrategy": "planar-projected from top, edge faces use a separate strip UV for the lamination bands", "normalStrategy": "vertex normals from generated geometry, flat-shaded on top/bottom faces", "profile2D": {"points": [[-0.5, -0.5], [-0.375, -0.46], [-0.25, -0.4], [-0.125, -0.36], [0.0, -0.38], [0.125, -0.44], [0.25, -0.49], [0.375, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 1.7, "height": 0.78, "depth": 0.035, "units": "meters", "confidence": 0.7}, "transform": {"position": [0, 0.685, 0.39], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.685, 0.39], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.7, 0.035, 0.78], "isTrigger": false, "notes": "Flat box proxy; the wave edge is cosmetic and does not need physical accuracy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel", "tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-leftLegPanel", "withComponent": "leftLegPanel", "overlap": 0.02}, {"id": "tabletop-to-pedestalCarcass", "withComponent": "pedestalCarcass", "overlap": 0.02}], "localFeatures": [{"id": "tabletop-front-wave-edge", "kind": "silhouette-curve", "description": "Front-facing outline edge is a cubic-bezier S-curve, not straight or single-radius; author as the extrusion profile's front boundary.", "evidenceRefs": ["full-object"]}, {"id": "tabletop-thickness-edge-band", "kind": "material-local-override", "description": "Visible cut edge shows alternating light/dark plywood lamination lines; realized as a localOverride on plywoodBirch restricted to the edge-facing UV strip.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.01, "normalPattern": "subtle wood-grain directional streaks along the long axis", "displacementPattern": "none", "occlusionPattern": "slight darkening at the underside near the leg/pedestal seams", "edgeWearPattern": "very light sheen wear at the front-center edge where hands rest", "notes": "Top face reads satin/low-gloss, not glossy lacquer."}, "evidenceRefs": ["full-object"], "details": ["tabletop-front-wave-edge", "tabletop-thickness-edge-band"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_tabletop_0.add(mesh_tabletop_0);
  meshes["tabletop"] = mesh_tabletop_0;
  colliders["tabletop"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.7, 0.035, 0.78], "isTrigger": false, "notes": "Flat box proxy; the wave edge is cosmetic and does not need physical accuracy."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_tabletop_0);

  const endpoint_leftLegPanel_1 = makeAttachmentEndpoint(null);
  const node_leftLegPanel_1 = new THREE.Group();
  node_leftLegPanel_1.name = "Left solid leg panel__pivot";
  node_leftLegPanel_1.scale.set(1, 1, 1);
  if (endpoint_leftLegPanel_1) {
    node_leftLegPanel_1.position.copy(endpoint_leftLegPanel_1.start);
    node_leftLegPanel_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leftLegPanel_1.position.set(-0.64, 0.3425, 0.39);
    node_leftLegPanel_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_leftLegPanel_1.userData.sculptComponent = {"id": "leftLegPanel", "name": "Left solid leg panel", "level": "meso", "role": "body", "importance": 0.8, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Simplified to a plain rectangular slab: same 'extrude' axis-mapping limitation as the tabletop. The rounded front-bottom corner from the reference photo is not present in the generated mesh.", "geometryDescriptor": {"topologyIntent": "plain rectangular slab (see topologyRationale for the documented approximation)", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.05, "segments": 6}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-underside-left", "localStart": [0, 0.685, 0], "localEnd": [0, 0.685, 0.78], "contactType": "surface-glued", "embedDepth": 0.01, "overlap": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.685, "depth": 0.78, "units": "meters", "confidence": 0.65}, "transform": {"position": [-0.64, 0.3425, 0.39], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [-0.64, 0, 0.39], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.685, 0.78], "isTrigger": false, "notes": "Box proxy; rounded corner is cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-leftLegPanel", "withComponent": "tabletop", "overlap": 0.02}], "localFeatures": [{"id": "left-leg-rounded-front-corner", "kind": "geometry-fillet", "description": "Front-bottom vertical corner is filleted to echo the tabletop's curve language; all other corners stay sharp.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.008, "normalPattern": "faint vertical grain", "displacementPattern": "none", "occlusionPattern": "slight AO at the floor contact line", "edgeWearPattern": "none", "notes": "Same finish family as the tabletop."}, "evidenceRefs": ["full-object"], "details": ["left-leg-rounded-front-corner"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_leftLegPanel_1.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [-0.64, 0, 0.39], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.685, 0.78], "isTrigger": false, "notes": "Box proxy; rounded corner is cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["root"] ?? root).add(node_leftLegPanel_1);
  nodes["leftLegPanel"] = node_leftLegPanel_1;
  const mesh_leftLegPanel_1Geometry = endpoint_leftLegPanel_1
    ? new THREE.CylinderGeometry(endpoint_leftLegPanel_1.endRadius, endpoint_leftLegPanel_1.baseRadius, endpoint_leftLegPanel_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leftLegPanel_1) {
    mesh_leftLegPanel_1Geometry.scale(0.42, 0.685, 0.78);
  }
  const mesh_leftLegPanel_1 = new THREE.Mesh(
    mesh_leftLegPanel_1Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leftLegPanel_1.name = "Left solid leg panel";
  if (endpoint_leftLegPanel_1) {
    mesh_leftLegPanel_1.position.copy(endpoint_leftLegPanel_1.midpoint);
    mesh_leftLegPanel_1.quaternion.copy(endpoint_leftLegPanel_1.quaternion);
  }
  mesh_leftLegPanel_1.castShadow = options.castShadow ?? true;
  mesh_leftLegPanel_1.receiveShadow = options.receiveShadow ?? true;
  mesh_leftLegPanel_1.userData.sculptComponent = {"id": "leftLegPanel", "name": "Left solid leg panel", "level": "meso", "role": "body", "importance": 0.8, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Simplified to a plain rectangular slab: same 'extrude' axis-mapping limitation as the tabletop. The rounded front-bottom corner from the reference photo is not present in the generated mesh.", "geometryDescriptor": {"topologyIntent": "plain rectangular slab (see topologyRationale for the documented approximation)", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.05, "segments": 6}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-underside-left", "localStart": [0, 0.685, 0], "localEnd": [0, 0.685, 0.78], "contactType": "surface-glued", "embedDepth": 0.01, "overlap": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.685, "depth": 0.78, "units": "meters", "confidence": 0.65}, "transform": {"position": [-0.64, 0.3425, 0.39], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [-0.64, 0, 0.39], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.685, 0.78], "isTrigger": false, "notes": "Box proxy; rounded corner is cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-leftLegPanel"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-leftLegPanel", "withComponent": "tabletop", "overlap": 0.02}], "localFeatures": [{"id": "left-leg-rounded-front-corner", "kind": "geometry-fillet", "description": "Front-bottom vertical corner is filleted to echo the tabletop's curve language; all other corners stay sharp.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.008, "normalPattern": "faint vertical grain", "displacementPattern": "none", "occlusionPattern": "slight AO at the floor contact line", "edgeWearPattern": "none", "notes": "Same finish family as the tabletop."}, "evidenceRefs": ["full-object"], "details": ["left-leg-rounded-front-corner"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_leftLegPanel_1.add(mesh_leftLegPanel_1);
  meshes["leftLegPanel"] = mesh_leftLegPanel_1;
  colliders["leftLegPanel"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.685, 0.78], "isTrigger": false, "notes": "Box proxy; rounded corner is cosmetic only."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_leftLegPanel_1);

  const endpoint_pedestalCarcass_2 = makeAttachmentEndpoint(null);
  const node_pedestalCarcass_2 = new THREE.Group();
  node_pedestalCarcass_2.name = "Right drawer pedestal carcass__pivot";
  node_pedestalCarcass_2.scale.set(1, 1, 1);
  if (endpoint_pedestalCarcass_2) {
    node_pedestalCarcass_2.position.copy(endpoint_pedestalCarcass_2.start);
    node_pedestalCarcass_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pedestalCarcass_2.position.set(0.62, 0.3425, 0.36);
    node_pedestalCarcass_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_pedestalCarcass_2.userData.sculptComponent = {"id": "pedestalCarcass", "name": "Right drawer pedestal carcass", "level": "meso", "role": "body", "importance": 0.85, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rectilinear floor-standing cabinet box; no curved edges observed on the carcass itself (curves are limited to the tabletop and mat).", "geometryDescriptor": {"topologyIntent": "simple rectangular carcass box", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-underside-right", "localStart": [0.62, 0.685, 0.06], "localEnd": [0.62, 0.685, 0.66], "contactType": "surface-glued", "embedDepth": 0.01, "overlap": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 0.46, "height": 0.685, "depth": 0.6, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.3425, 0.36], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [0.62, 0, 0.36], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "drawer-slot-0", "localPosition": [0.0, -0.218, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-1", "localPosition": [0.0, 0.002, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-2", "localPosition": [0.0, 0.222, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.685, 0.6], "isTrigger": false, "notes": "Box proxy for the whole pedestal, drawers included."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-pedestalCarcass", "withComponent": "tabletop", "overlap": 0.02}], "localFeatures": [{"id": "pedestal-top-inset-line", "kind": "material-local-override", "description": "Thin dark reveal/seam line at the top edge where the carcass meets the tabletop underside overhang.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.008, "normalPattern": "faint grain matching tabletop", "displacementPattern": "none", "occlusionPattern": "darkened reveal line at the top edge and between drawers", "edgeWearPattern": "none", "notes": "Same finish family as the tabletop and left leg."}, "evidenceRefs": ["full-object"], "details": ["pedestal-top-inset-line"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_pedestalCarcass_2.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [0.62, 0, 0.36], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "drawer-slot-0", "localPosition": [0.0, -0.218, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-1", "localPosition": [0.0, 0.002, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-2", "localPosition": [0.0, 0.222, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.685, 0.6], "isTrigger": false, "notes": "Box proxy for the whole pedestal, drawers included."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["root"] ?? root).add(node_pedestalCarcass_2);
  nodes["pedestalCarcass"] = node_pedestalCarcass_2;
  const mesh_pedestalCarcass_2Geometry = endpoint_pedestalCarcass_2
    ? new THREE.CylinderGeometry(endpoint_pedestalCarcass_2.endRadius, endpoint_pedestalCarcass_2.baseRadius, endpoint_pedestalCarcass_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pedestalCarcass_2) {
    mesh_pedestalCarcass_2Geometry.scale(0.46, 0.685, 0.6);
  }
  const mesh_pedestalCarcass_2 = new THREE.Mesh(
    mesh_pedestalCarcass_2Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pedestalCarcass_2.name = "Right drawer pedestal carcass";
  if (endpoint_pedestalCarcass_2) {
    mesh_pedestalCarcass_2.position.copy(endpoint_pedestalCarcass_2.midpoint);
    mesh_pedestalCarcass_2.quaternion.copy(endpoint_pedestalCarcass_2.quaternion);
  }
  mesh_pedestalCarcass_2.castShadow = options.castShadow ?? true;
  mesh_pedestalCarcass_2.receiveShadow = options.receiveShadow ?? true;
  mesh_pedestalCarcass_2.userData.sculptComponent = {"id": "pedestalCarcass", "name": "Right drawer pedestal carcass", "level": "meso", "role": "body", "importance": 0.85, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rectilinear floor-standing cabinet box; no curved edges observed on the carcass itself (curves are limited to the tabletop and mat).", "geometryDescriptor": {"topologyIntent": "simple rectangular carcass box", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-underside-right", "localStart": [0.62, 0.685, 0.06], "localEnd": [0.62, 0.685, 0.66], "contactType": "surface-glued", "embedDepth": 0.01, "overlap": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 0.46, "height": 0.685, "depth": 0.6, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.3425, 0.36], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "custom", "localPosition": [0.62, 0, 0.36], "axis": [0, 1, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "drawer-slot-0", "localPosition": [0.0, -0.218, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-1", "localPosition": [0.0, 0.002, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}, {"id": "drawer-slot-2", "localPosition": [0.0, 0.222, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.685, 0.6], "isTrigger": false, "notes": "Box proxy for the whole pedestal, drawers included."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": ["tabletop-to-pedestalCarcass"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [{"id": "tabletop-to-pedestalCarcass", "withComponent": "tabletop", "overlap": 0.02}], "localFeatures": [{"id": "pedestal-top-inset-line", "kind": "material-local-override", "description": "Thin dark reveal/seam line at the top edge where the carcass meets the tabletop underside overhang.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.008, "normalPattern": "faint grain matching tabletop", "displacementPattern": "none", "occlusionPattern": "darkened reveal line at the top edge and between drawers", "edgeWearPattern": "none", "notes": "Same finish family as the tabletop and left leg."}, "evidenceRefs": ["full-object"], "details": ["pedestal-top-inset-line"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_pedestalCarcass_2.add(mesh_pedestalCarcass_2);
  meshes["pedestalCarcass"] = mesh_pedestalCarcass_2;
  colliders["pedestalCarcass"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.685, 0.6], "isTrigger": false, "notes": "Box proxy for the whole pedestal, drawers included."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_pedestalCarcass_2);
  const socket_pedestalCarcass_drawer_slot_0_0 = new THREE.Object3D();
  socket_pedestalCarcass_drawer_slot_0_0.name = "drawer-slot-0";
  socket_pedestalCarcass_drawer_slot_0_0.position.set(0.0, -0.218, 0.3);
  socket_pedestalCarcass_drawer_slot_0_0.rotation.set(0.0, 0.0, 0.0);
  socket_pedestalCarcass_drawer_slot_0_0.userData.socket = {"id": "drawer-slot-0", "localPosition": [0.0, -0.218, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]};
  node_pedestalCarcass_2.add(socket_pedestalCarcass_drawer_slot_0_0);
  sockets["pedestalCarcass:drawer-slot-0"] = socket_pedestalCarcass_drawer_slot_0_0;
  const socket_pedestalCarcass_drawer_slot_1_1 = new THREE.Object3D();
  socket_pedestalCarcass_drawer_slot_1_1.name = "drawer-slot-1";
  socket_pedestalCarcass_drawer_slot_1_1.position.set(0.0, 0.002, 0.3);
  socket_pedestalCarcass_drawer_slot_1_1.rotation.set(0.0, 0.0, 0.0);
  socket_pedestalCarcass_drawer_slot_1_1.userData.socket = {"id": "drawer-slot-1", "localPosition": [0.0, 0.002, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]};
  node_pedestalCarcass_2.add(socket_pedestalCarcass_drawer_slot_1_1);
  sockets["pedestalCarcass:drawer-slot-1"] = socket_pedestalCarcass_drawer_slot_1_1;
  const socket_pedestalCarcass_drawer_slot_2_2 = new THREE.Object3D();
  socket_pedestalCarcass_drawer_slot_2_2.name = "drawer-slot-2";
  socket_pedestalCarcass_drawer_slot_2_2.position.set(0.0, 0.222, 0.3);
  socket_pedestalCarcass_drawer_slot_2_2.rotation.set(0.0, 0.0, 0.0);
  socket_pedestalCarcass_drawer_slot_2_2.userData.socket = {"id": "drawer-slot-2", "localPosition": [0.0, 0.222, 0.3], "localRotation": [0, 0, 0], "acceptsTags": ["drawerFront"]};
  node_pedestalCarcass_2.add(socket_pedestalCarcass_drawer_slot_2_2);
  sockets["pedestalCarcass:drawer-slot-2"] = socket_pedestalCarcass_drawer_slot_2_2;

  const endpoint_drawerFront0_3 = makeAttachmentEndpoint(null);
  const node_drawerFront0_3 = new THREE.Group();
  node_drawerFront0_3.name = "Drawer front (bottom)__pivot";
  node_drawerFront0_3.scale.set(1, 1, 1);
  if (endpoint_drawerFront0_3) {
    node_drawerFront0_3.position.copy(endpoint_drawerFront0_3.start);
    node_drawerFront0_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerFront0_3.position.set(0.0, -0.218, 0.31);
    node_drawerFront0_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerFront0_3.userData.sculptComponent = {"id": "drawerFront0", "name": "Drawer front (bottom)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-0", "localStart": [0.0, -0.323, 0.3], "localEnd": [0.0, -0.113, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, -0.218, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, -0.218, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-0", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gap above this drawer separating it from the drawer above.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the top and bottom reveal edges", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront0_3.userData.actionProfile = {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, -0.218, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-0", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["pedestalCarcass"] ?? root).add(node_drawerFront0_3);
  nodes["drawerFront0"] = node_drawerFront0_3;
  const mesh_drawerFront0_3Geometry = endpoint_drawerFront0_3
    ? new THREE.CylinderGeometry(endpoint_drawerFront0_3.endRadius, endpoint_drawerFront0_3.baseRadius, endpoint_drawerFront0_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_drawerFront0_3) {
    mesh_drawerFront0_3Geometry.scale(0.42, 0.21, 0.02);
  }
  const mesh_drawerFront0_3 = new THREE.Mesh(
    mesh_drawerFront0_3Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerFront0_3.name = "Drawer front (bottom)";
  if (endpoint_drawerFront0_3) {
    mesh_drawerFront0_3.position.copy(endpoint_drawerFront0_3.midpoint);
    mesh_drawerFront0_3.quaternion.copy(endpoint_drawerFront0_3.quaternion);
  }
  mesh_drawerFront0_3.castShadow = options.castShadow ?? true;
  mesh_drawerFront0_3.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerFront0_3.userData.sculptComponent = {"id": "drawerFront0", "name": "Drawer front (bottom)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-0", "localStart": [0.0, -0.323, 0.3], "localEnd": [0.0, -0.113, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, -0.218, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, -0.218, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-0", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gap above this drawer separating it from the drawer above.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the top and bottom reveal edges", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront0_3.add(mesh_drawerFront0_3);
  meshes["drawerFront0"] = mesh_drawerFront0_3;
  colliders["drawerFront0"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerFront0_3);
  const socket_drawerFront0_handle_mount_0_0 = new THREE.Object3D();
  socket_drawerFront0_handle_mount_0_0.name = "handle-mount-0";
  socket_drawerFront0_handle_mount_0_0.position.set(0.0, 0.06, 0.015);
  socket_drawerFront0_handle_mount_0_0.rotation.set(0.0, 0.0, 0.0);
  socket_drawerFront0_handle_mount_0_0.userData.socket = {"id": "handle-mount-0", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]};
  node_drawerFront0_3.add(socket_drawerFront0_handle_mount_0_0);
  sockets["drawerFront0:handle-mount-0"] = socket_drawerFront0_handle_mount_0_0;

  const endpoint_drawerFront1_4 = makeAttachmentEndpoint(null);
  const node_drawerFront1_4 = new THREE.Group();
  node_drawerFront1_4.name = "Drawer front (middle)__pivot";
  node_drawerFront1_4.scale.set(1, 1, 1);
  if (endpoint_drawerFront1_4) {
    node_drawerFront1_4.position.copy(endpoint_drawerFront1_4.start);
    node_drawerFront1_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerFront1_4.position.set(0.0, 0.002, 0.31);
    node_drawerFront1_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerFront1_4.userData.sculptComponent = {"id": "drawerFront1", "name": "Drawer front (middle)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-1", "localStart": [0.0, -0.103, 0.3], "localEnd": [0.0, 0.107, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, 0.002, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.002, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-1", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gaps above and below this drawer.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the top and bottom reveal edges", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront1_4.userData.actionProfile = {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.002, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-1", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["pedestalCarcass"] ?? root).add(node_drawerFront1_4);
  nodes["drawerFront1"] = node_drawerFront1_4;
  const mesh_drawerFront1_4Geometry = endpoint_drawerFront1_4
    ? new THREE.CylinderGeometry(endpoint_drawerFront1_4.endRadius, endpoint_drawerFront1_4.baseRadius, endpoint_drawerFront1_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_drawerFront1_4) {
    mesh_drawerFront1_4Geometry.scale(0.42, 0.21, 0.02);
  }
  const mesh_drawerFront1_4 = new THREE.Mesh(
    mesh_drawerFront1_4Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerFront1_4.name = "Drawer front (middle)";
  if (endpoint_drawerFront1_4) {
    mesh_drawerFront1_4.position.copy(endpoint_drawerFront1_4.midpoint);
    mesh_drawerFront1_4.quaternion.copy(endpoint_drawerFront1_4.quaternion);
  }
  mesh_drawerFront1_4.castShadow = options.castShadow ?? true;
  mesh_drawerFront1_4.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerFront1_4.userData.sculptComponent = {"id": "drawerFront1", "name": "Drawer front (middle)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-1", "localStart": [0.0, -0.103, 0.3], "localEnd": [0.0, 0.107, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, 0.002, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.002, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-1", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gaps above and below this drawer.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the top and bottom reveal edges", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront1_4.add(mesh_drawerFront1_4);
  meshes["drawerFront1"] = mesh_drawerFront1_4;
  colliders["drawerFront1"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerFront1_4);
  const socket_drawerFront1_handle_mount_1_0 = new THREE.Object3D();
  socket_drawerFront1_handle_mount_1_0.name = "handle-mount-1";
  socket_drawerFront1_handle_mount_1_0.position.set(0.0, 0.06, 0.015);
  socket_drawerFront1_handle_mount_1_0.rotation.set(0.0, 0.0, 0.0);
  socket_drawerFront1_handle_mount_1_0.userData.socket = {"id": "handle-mount-1", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]};
  node_drawerFront1_4.add(socket_drawerFront1_handle_mount_1_0);
  sockets["drawerFront1:handle-mount-1"] = socket_drawerFront1_handle_mount_1_0;

  const endpoint_drawerFront2_5 = makeAttachmentEndpoint(null);
  const node_drawerFront2_5 = new THREE.Group();
  node_drawerFront2_5.name = "Drawer front (top)__pivot";
  node_drawerFront2_5.scale.set(1, 1, 1);
  if (endpoint_drawerFront2_5) {
    node_drawerFront2_5.position.copy(endpoint_drawerFront2_5.start);
    node_drawerFront2_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerFront2_5.position.set(0.0, 0.222, 0.31);
    node_drawerFront2_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerFront2_5.userData.sculptComponent = {"id": "drawerFront2", "name": "Drawer front (top)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-2", "localStart": [0.0, 0.117, 0.3], "localEnd": [0.0, 0.327, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, 0.222, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.222, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-2", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gap below this drawer.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the bottom reveal edge", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront2_5.userData.actionProfile = {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.222, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-2", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}};
  (nodes["pedestalCarcass"] ?? root).add(node_drawerFront2_5);
  nodes["drawerFront2"] = node_drawerFront2_5;
  const mesh_drawerFront2_5Geometry = endpoint_drawerFront2_5
    ? new THREE.CylinderGeometry(endpoint_drawerFront2_5.endRadius, endpoint_drawerFront2_5.baseRadius, endpoint_drawerFront2_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_drawerFront2_5) {
    mesh_drawerFront2_5Geometry.scale(0.42, 0.21, 0.02);
  }
  const mesh_drawerFront2_5 = new THREE.Mesh(
    mesh_drawerFront2_5Geometry,
    materialMap["plywoodBirch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerFront2_5.name = "Drawer front (top)";
  if (endpoint_drawerFront2_5) {
    mesh_drawerFront2_5.position.copy(endpoint_drawerFront2_5.midpoint);
    mesh_drawerFront2_5.quaternion.copy(endpoint_drawerFront2_5.quaternion);
  }
  mesh_drawerFront2_5.castShadow = options.castShadow ?? true;
  mesh_drawerFront2_5.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerFront2_5.userData.sculptComponent = {"id": "drawerFront2", "name": "Drawer front (top)", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Flat rectangular panel; part of the drawerFronts repetition system.", "geometryDescriptor": {"topologyIntent": "thin flat panel", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.002, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected", "normalStrategy": "vertex normals from generated geometry"}, "parent": "pedestalCarcass", "attachment": {"parentSocket": "drawer-slot-2", "localStart": [0.0, 0.117, 0.3], "localEnd": [0.0, 0.327, 0.32], "contactType": "surface-flush", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.002}, "dimensions": {"width": 0.42, "height": 0.21, "depth": 0.02, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.0, 0.222, 0.31], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "moving-part", "pivot": {"mode": "custom", "localPosition": [0.0, 0.222, 0.31], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [{"id": "handle-mount-2", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."}, "constraints": [{"type": "slide", "axis": [0, 0, 1], "min": 0.0, "max": 0.35}], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plywoodBirch"}}, "material": "plywoodBirch", "materialLayers": ["plywoodBirch"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-drawer-reveal-gaps", "kind": "geometry-gap", "description": "0.01m reveal gap below this drawer.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.15, "bumpAmplitude": 0.006, "normalPattern": "faint grain", "displacementPattern": "none", "occlusionPattern": "darkened at the bottom reveal edge", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-drawer-reveal-gaps"], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(228, 212, 174, 1.0)", "secondaryAlbedo": "rgba(216, 198, 154, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8}};
  node_drawerFront2_5.add(mesh_drawerFront2_5);
  meshes["drawerFront2"] = mesh_drawerFront2_5;
  colliders["drawerFront2"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.42, 0.21, 0.02], "isTrigger": false, "notes": "Slide-out drawer proxy for future interaction."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerFront2_5);
  const socket_drawerFront2_handle_mount_2_0 = new THREE.Object3D();
  socket_drawerFront2_handle_mount_2_0.name = "handle-mount-2";
  socket_drawerFront2_handle_mount_2_0.position.set(0.0, 0.06, 0.015);
  socket_drawerFront2_handle_mount_2_0.rotation.set(0.0, 0.0, 0.0);
  socket_drawerFront2_handle_mount_2_0.userData.socket = {"id": "handle-mount-2", "localPosition": [0.0, 0.06, 0.015], "localRotation": [0, 0, 0], "acceptsTags": ["handle"]};
  node_drawerFront2_5.add(socket_drawerFront2_handle_mount_2_0);
  sockets["drawerFront2:handle-mount-2"] = socket_drawerFront2_handle_mount_2_0;

  const attachment_drawerHandle0_6 = {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront0"};
  const endpoint_drawerHandle0_6 = makeAttachmentEndpoint(attachment_drawerHandle0_6);
  const node_drawerHandle0_6 = new THREE.Group();
  node_drawerHandle0_6.name = "Drawer handle (bottom)__pivot";
  node_drawerHandle0_6.scale.set(1, 1, 1);
  if (endpoint_drawerHandle0_6) {
    node_drawerHandle0_6.position.copy(endpoint_drawerHandle0_6.start);
    node_drawerHandle0_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerHandle0_6.position.set(0.62, 0.185, 0.695);
    node_drawerHandle0_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerHandle0_6.userData.sculptComponent = {"id": "drawerHandle0", "name": "Drawer handle (bottom)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront0", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront0"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.185, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.185, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle0_6.userData.actionProfile = {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.185, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}};
  (nodes["drawerFront0"] ?? root).add(node_drawerHandle0_6);
  nodes["drawerHandle0"] = node_drawerHandle0_6;
  const mesh_drawerHandle0_6Geometry = endpoint_drawerHandle0_6
    ? new THREE.CylinderGeometry(endpoint_drawerHandle0_6.endRadius, endpoint_drawerHandle0_6.baseRadius, endpoint_drawerHandle0_6.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_drawerHandle0_6) {
    mesh_drawerHandle0_6Geometry.scale(0.28, 0.02, 0.03);
  }
  const mesh_drawerHandle0_6 = new THREE.Mesh(
    mesh_drawerHandle0_6Geometry,
    materialMap["metalHardware"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerHandle0_6.name = "Drawer handle (bottom)";
  if (endpoint_drawerHandle0_6) {
    mesh_drawerHandle0_6.position.copy(endpoint_drawerHandle0_6.midpoint);
    mesh_drawerHandle0_6.quaternion.copy(endpoint_drawerHandle0_6.quaternion);
  }
  mesh_drawerHandle0_6.castShadow = options.castShadow ?? true;
  mesh_drawerHandle0_6.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerHandle0_6.userData.sculptComponent = {"id": "drawerHandle0", "name": "Drawer handle (bottom)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront0", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront0"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.185, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.185, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle0_6.add(mesh_drawerHandle0_6);
  meshes["drawerHandle0"] = mesh_drawerHandle0_6;
  colliders["drawerHandle0"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerHandle0_6);

  const attachment_drawerHandle1_7 = {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront1"};
  const endpoint_drawerHandle1_7 = makeAttachmentEndpoint(attachment_drawerHandle1_7);
  const node_drawerHandle1_7 = new THREE.Group();
  node_drawerHandle1_7.name = "Drawer handle (middle)__pivot";
  node_drawerHandle1_7.scale.set(1, 1, 1);
  if (endpoint_drawerHandle1_7) {
    node_drawerHandle1_7.position.copy(endpoint_drawerHandle1_7.start);
    node_drawerHandle1_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerHandle1_7.position.set(0.62, 0.405, 0.695);
    node_drawerHandle1_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerHandle1_7.userData.sculptComponent = {"id": "drawerHandle1", "name": "Drawer handle (middle)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront1", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront1"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.405, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.405, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle1_7.userData.actionProfile = {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.405, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}};
  (nodes["drawerFront1"] ?? root).add(node_drawerHandle1_7);
  nodes["drawerHandle1"] = node_drawerHandle1_7;
  const mesh_drawerHandle1_7Geometry = endpoint_drawerHandle1_7
    ? new THREE.CylinderGeometry(endpoint_drawerHandle1_7.endRadius, endpoint_drawerHandle1_7.baseRadius, endpoint_drawerHandle1_7.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_drawerHandle1_7) {
    mesh_drawerHandle1_7Geometry.scale(0.28, 0.02, 0.03);
  }
  const mesh_drawerHandle1_7 = new THREE.Mesh(
    mesh_drawerHandle1_7Geometry,
    materialMap["metalHardware"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerHandle1_7.name = "Drawer handle (middle)";
  if (endpoint_drawerHandle1_7) {
    mesh_drawerHandle1_7.position.copy(endpoint_drawerHandle1_7.midpoint);
    mesh_drawerHandle1_7.quaternion.copy(endpoint_drawerHandle1_7.quaternion);
  }
  mesh_drawerHandle1_7.castShadow = options.castShadow ?? true;
  mesh_drawerHandle1_7.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerHandle1_7.userData.sculptComponent = {"id": "drawerHandle1", "name": "Drawer handle (middle)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront1", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront1"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.405, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.405, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle1_7.add(mesh_drawerHandle1_7);
  meshes["drawerHandle1"] = mesh_drawerHandle1_7;
  colliders["drawerHandle1"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerHandle1_7);

  const attachment_drawerHandle2_8 = {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront2"};
  const endpoint_drawerHandle2_8 = makeAttachmentEndpoint(attachment_drawerHandle2_8);
  const node_drawerHandle2_8 = new THREE.Group();
  node_drawerHandle2_8.name = "Drawer handle (top)__pivot";
  node_drawerHandle2_8.scale.set(1, 1, 1);
  if (endpoint_drawerHandle2_8) {
    node_drawerHandle2_8.position.copy(endpoint_drawerHandle2_8.start);
    node_drawerHandle2_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawerHandle2_8.position.set(0.62, 0.625, 0.695);
    node_drawerHandle2_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawerHandle2_8.userData.sculptComponent = {"id": "drawerHandle2", "name": "Drawer handle (top)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront2", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront2"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.625, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.625, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle2_8.userData.actionProfile = {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.625, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}};
  (nodes["drawerFront2"] ?? root).add(node_drawerHandle2_8);
  nodes["drawerHandle2"] = node_drawerHandle2_8;
  const mesh_drawerHandle2_8Geometry = endpoint_drawerHandle2_8
    ? new THREE.CylinderGeometry(endpoint_drawerHandle2_8.endRadius, endpoint_drawerHandle2_8.baseRadius, endpoint_drawerHandle2_8.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_drawerHandle2_8) {
    mesh_drawerHandle2_8Geometry.scale(0.28, 0.02, 0.03);
  }
  const mesh_drawerHandle2_8 = new THREE.Mesh(
    mesh_drawerHandle2_8Geometry,
    materialMap["metalHardware"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawerHandle2_8.name = "Drawer handle (top)";
  if (endpoint_drawerHandle2_8) {
    mesh_drawerHandle2_8.position.copy(endpoint_drawerHandle2_8.midpoint);
    mesh_drawerHandle2_8.quaternion.copy(endpoint_drawerHandle2_8.quaternion);
  }
  mesh_drawerHandle2_8.castShadow = options.castShadow ?? true;
  mesh_drawerHandle2_8.receiveShadow = options.receiveShadow ?? true;
  mesh_drawerHandle2_8.userData.sculptComponent = {"id": "drawerHandle2", "name": "Drawer handle (top)", "level": "micro", "role": "attachment", "importance": 0.5, "confidence": 0.75, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Bar-plus-two-standoffs hardware; a compound of a capsule bar and two short cylinders rooted at its mounting sockets, not a single primitive.", "geometryDescriptor": {"topologyIntent": "horizontal capsule bar on two cylindrical standoffs", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 8}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "drawerFront2", "attachment": {"parentSocket": null, "localStart": [-0.14, 0.06, 0.025], "localEnd": [0.14, 0.06, 0.025], "contactType": "standoff-mounted", "embedDepth": 0.001, "overlap": 0.0, "gapTolerance": 0.001, "baseRadius": 0.009, "endRadius": 0.009, "parentId": "drawerFront2"}, "dimensions": {"width": 0.28, "height": 0.02, "depth": 0.03, "units": "meters", "confidence": 0.65}, "transform": {"position": [0.62, 0.625, 0.695], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "attached-decoration", "pivot": {"mode": "custom", "localPosition": [0.62, 0.625, 0.685], "axis": [1, 0, 0], "confidence": 0.65}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "desk", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalHardware"}}, "material": "metalHardware", "materialLayers": ["metalHardware"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pedestal-handle-standoffs", "kind": "attached-hardware", "description": "Bar handle stands proud of the drawer face on two cylindrical metal standoffs.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "fine brushed-metal linear anisotropy", "displacementPattern": "none", "occlusionPattern": "contact shadow where standoffs meet the drawer face", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["full-object"], "details": ["pedestal-handle-standoffs"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(201, 194, 176, 1.0)", "secondaryAlbedo": "rgba(168, 161, 144, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_drawerHandle2_8.add(mesh_drawerHandle2_8);
  meshes["drawerHandle2"] = mesh_drawerHandle2_8;
  colliders["drawerHandle2"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.28, 0.02, 0.03], "isTrigger": false, "notes": "Thin proxy; grip target for future interaction hookup."};
  destructionGroups["desk"] ??= [];
  destructionGroups["desk"].push(node_drawerHandle2_8);

  const endpoint_deskMat_9 = makeAttachmentEndpoint(null);
  const node_deskMat_9 = new THREE.Group();
  node_deskMat_9.name = "Black desk mat__pivot";
  node_deskMat_9.scale.set(1, 1, 1);
  if (endpoint_deskMat_9) {
    node_deskMat_9.position.copy(endpoint_deskMat_9.start);
    node_deskMat_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_deskMat_9.position.set(-0.05, 0.7245, 0.48);
    node_deskMat_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_deskMat_9.userData.sculptComponent = {"id": "deskMat", "name": "Black desk mat", "level": "macro", "role": "body", "importance": 0.6, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Simplified to a plain rectangular slab: same 'extrude' axis-mapping limitation as the tabletop. The filleted corners from the reference photo are not present in the generated mesh.", "geometryDescriptor": {"topologyIntent": "plain rectangular slab (see topologyRationale for the documented approximation)", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.03, "segments": 6}, "deformationStack": [], "uvStrategy": "planar-projected from top", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-surface", "localStart": [-0.475, 0.724, 0.305], "localEnd": [0.375, 0.724, 0.655], "contactType": "surface-resting", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.001}, "dimensions": {"width": 0.85, "height": 0.008, "depth": 0.35, "units": "meters", "confidence": 0.7}, "transform": {"position": [-0.05, 0.7245, 0.48], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.05, 0.7245, 0.48], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.85, 0.008, 0.35], "isTrigger": false, "notes": "Flat proxy; rounded corners are cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deskMat", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "deskMatRubber"}}, "material": "deskMatRubber", "materialLayers": ["deskMatRubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "mat-rounded-corners", "kind": "geometry-fillet", "description": "All four corners are uniformly filleted; a slight raised edge lip runs the perimeter.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.85, "microRoughness": 0.35, "bumpAmplitude": 0.002, "normalPattern": "fine fabric/rubber micro-weave", "displacementPattern": "none", "occlusionPattern": "AO along the perimeter lip", "edgeWearPattern": "none", "notes": "Matte, non-reflective; near-zero specular highlight."}, "evidenceRefs": ["full-object"], "details": ["mat-rounded-corners"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(22, 22, 22, 1.0)", "secondaryAlbedo": "rgba(30, 30, 30, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8}};
  node_deskMat_9.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.05, 0.7245, 0.48], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.85, 0.008, 0.35], "isTrigger": false, "notes": "Flat proxy; rounded corners are cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deskMat", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "deskMatRubber"}};
  (nodes["root"] ?? root).add(node_deskMat_9);
  nodes["deskMat"] = node_deskMat_9;
  const mesh_deskMat_9Geometry = endpoint_deskMat_9
    ? new THREE.CylinderGeometry(endpoint_deskMat_9.endRadius, endpoint_deskMat_9.baseRadius, endpoint_deskMat_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_deskMat_9) {
    mesh_deskMat_9Geometry.scale(0.85, 0.008, 0.35);
  }
  const mesh_deskMat_9 = new THREE.Mesh(
    mesh_deskMat_9Geometry,
    materialMap["deskMatRubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deskMat_9.name = "Black desk mat";
  if (endpoint_deskMat_9) {
    mesh_deskMat_9.position.copy(endpoint_deskMat_9.midpoint);
    mesh_deskMat_9.quaternion.copy(endpoint_deskMat_9.quaternion);
  }
  mesh_deskMat_9.castShadow = options.castShadow ?? true;
  mesh_deskMat_9.receiveShadow = options.receiveShadow ?? true;
  mesh_deskMat_9.userData.sculptComponent = {"id": "deskMat", "name": "Black desk mat", "level": "macro", "role": "body", "importance": 0.6, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Simplified to a plain rectangular slab: same 'extrude' axis-mapping limitation as the tabletop. The filleted corners from the reference photo are not present in the generated mesh.", "geometryDescriptor": {"topologyIntent": "plain rectangular slab (see topologyRationale for the documented approximation)", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.03, "segments": 6}, "deformationStack": [], "uvStrategy": "planar-projected from top", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": {"parentSocket": "desktop-surface", "localStart": [-0.475, 0.724, 0.305], "localEnd": [0.375, 0.724, 0.655], "contactType": "surface-resting", "embedDepth": 0.0, "overlap": 0.0, "gapTolerance": 0.001}, "dimensions": {"width": 0.85, "height": 0.008, "depth": 0.35, "units": "meters", "confidence": 0.7}, "transform": {"position": [-0.05, 0.7245, 0.48], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.05, 0.7245, 0.48], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.85, 0.008, 0.35], "isTrigger": false, "notes": "Flat proxy; rounded corners are cosmetic only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deskMat", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "deskMatRubber"}}, "material": "deskMatRubber", "materialLayers": ["deskMatRubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "mat-rounded-corners", "kind": "geometry-fillet", "description": "All four corners are uniformly filleted; a slight raised edge lip runs the perimeter.", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.85, "microRoughness": 0.35, "bumpAmplitude": 0.002, "normalPattern": "fine fabric/rubber micro-weave", "displacementPattern": "none", "occlusionPattern": "AO along the perimeter lip", "edgeWearPattern": "none", "notes": "Matte, non-reflective; near-zero specular highlight."}, "evidenceRefs": ["full-object"], "details": ["mat-rounded-corners"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(22, 22, 22, 1.0)", "secondaryAlbedo": "rgba(30, 30, 30, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8}};
  node_deskMat_9.add(mesh_deskMat_9);
  meshes["deskMat"] = mesh_deskMat_9;
  colliders["deskMat"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.85, 0.008, 0.35], "isTrigger": false, "notes": "Flat proxy; rounded corners are cosmetic only."};
  destructionGroups["deskMat"] ??= [];
  destructionGroups["deskMat"].push(node_deskMat_9);

  const endpoint_glassPlatform_10 = makeAttachmentEndpoint(null);
  const node_glassPlatform_10 = new THREE.Group();
  node_glassPlatform_10.name = "Glass shelf (thin transparent tempered glass)__pivot";
  node_glassPlatform_10.scale.set(1, 1, 1);
  if (endpoint_glassPlatform_10) {
    node_glassPlatform_10.position.copy(endpoint_glassPlatform_10.start);
    node_glassPlatform_10.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_glassPlatform_10.position.set(0.0, 0.8499999999999999, 0.2);
    node_glassPlatform_10.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_glassPlatform_10.userData.sculptComponent = {"id": "glassPlatform", "name": "Glass shelf (thin transparent tempered glass)", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin near-transparent glass shelf (3% of total riser height); bottom face flush on the white housings' top faces.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46471], [0.49909, 0.47821], [0.49649, 0.48966], [0.49259, 0.49731], [0.488, 0.5], [-0.488, 0.5], [-0.49259, 0.49731], [-0.49649, 0.48966], [-0.49909, 0.47821], [-0.5, 0.46471], [-0.5, -0.46471], [-0.49909, -0.47821], [-0.49649, -0.48966], [-0.49259, -0.49731], [-0.488, -0.5], [0.488, -0.5], [0.49259, -0.49731], [0.49649, -0.48966], [0.49909, -0.47821], [0.5, -0.46471]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.5, "height": 0.17, "depth": 0.0075, "units": "meters", "confidence": 0.7}, "transform": {"position": [0, 0.8499999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.8499999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.5, 0.0075, 0.17], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glassClear"}}, "material": "glassClear", "materialLayers": ["glassClear"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glass-shelf-rounded-corners", "kind": "geometry-fillet", "description": "Very slightly rounded corners on the thin glass shelf.", "evidenceRefs": ["riser-side-and-front-detail"]}, {"id": "glass-shelf-transmissive", "kind": "material-local-override", "description": "The shelf itself must read as near-transparent glass, not an opaque mint slab; only the thin cut edge shows a teal/dark-green tint.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["glass-shelf-rounded-corners", "glass-shelf-transmissive"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(230, 240, 238, 1.0)", "secondaryAlbedo": "rgba(190, 225, 215, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.75}};
  node_glassPlatform_10.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.8499999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.5, 0.0075, 0.17], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glassClear"}};
  (nodes["root"] ?? root).add(node_glassPlatform_10);
  nodes["glassPlatform"] = node_glassPlatform_10;
  const mesh_glassPlatform_10Geometry = endpoint_glassPlatform_10
    ? new THREE.CylinderGeometry(endpoint_glassPlatform_10.endRadius, endpoint_glassPlatform_10.baseRadius, endpoint_glassPlatform_10.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.5, 0.46471], [0.49909, 0.47821], [0.49649, 0.48966], [0.49259, 0.49731], [0.488, 0.5], [-0.488, 0.5], [-0.49259, 0.49731], [-0.49649, 0.48966], [-0.49909, 0.47821], [-0.5, 0.46471], [-0.5, -0.46471], [-0.49909, -0.47821], [-0.49649, -0.48966], [-0.49259, -0.49731], [-0.488, -0.5], [0.488, -0.5], [0.49259, -0.49731], [0.49649, -0.48966], [0.49909, -0.47821], [0.5, -0.46471]], "depth": 1.0});
  if (!endpoint_glassPlatform_10) {
    mesh_glassPlatform_10Geometry.scale(0.5, 0.17, 0.0075);
  }
  const mesh_glassPlatform_10 = new THREE.Mesh(
    mesh_glassPlatform_10Geometry,
    materialMap["glassClear"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_glassPlatform_10.name = "Glass shelf (thin transparent tempered glass)";
  if (endpoint_glassPlatform_10) {
    mesh_glassPlatform_10.position.copy(endpoint_glassPlatform_10.midpoint);
    mesh_glassPlatform_10.quaternion.copy(endpoint_glassPlatform_10.quaternion);
  }
  mesh_glassPlatform_10.castShadow = options.castShadow ?? true;
  mesh_glassPlatform_10.receiveShadow = options.receiveShadow ?? true;
  mesh_glassPlatform_10.userData.sculptComponent = {"id": "glassPlatform", "name": "Glass shelf (thin transparent tempered glass)", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin near-transparent glass shelf (3% of total riser height); bottom face flush on the white housings' top faces.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46471], [0.49909, 0.47821], [0.49649, 0.48966], [0.49259, 0.49731], [0.488, 0.5], [-0.488, 0.5], [-0.49259, 0.49731], [-0.49649, 0.48966], [-0.49909, 0.47821], [-0.5, 0.46471], [-0.5, -0.46471], [-0.49909, -0.47821], [-0.49649, -0.48966], [-0.49259, -0.49731], [-0.488, -0.5], [0.488, -0.5], [0.49259, -0.49731], [0.49649, -0.48966], [0.49909, -0.47821], [0.5, -0.46471]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.5, "height": 0.17, "depth": 0.0075, "units": "meters", "confidence": 0.7}, "transform": {"position": [0, 0.8499999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0, 0.8499999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.5, 0.0075, 0.17], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glassClear"}}, "material": "glassClear", "materialLayers": ["glassClear"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glass-shelf-rounded-corners", "kind": "geometry-fillet", "description": "Very slightly rounded corners on the thin glass shelf.", "evidenceRefs": ["riser-side-and-front-detail"]}, {"id": "glass-shelf-transmissive", "kind": "material-local-override", "description": "The shelf itself must read as near-transparent glass, not an opaque mint slab; only the thin cut edge shows a teal/dark-green tint.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["glass-shelf-rounded-corners", "glass-shelf-transmissive"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(230, 240, 238, 1.0)", "secondaryAlbedo": "rgba(190, 225, 215, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.75}};
  node_glassPlatform_10.add(mesh_glassPlatform_10);
  meshes["glassPlatform"] = mesh_glassPlatform_10;
  colliders["glassPlatform"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.5, 0.0075, 0.17], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_glassPlatform_10);

  const endpoint_leftBody_11 = makeAttachmentEndpoint(null);
  const node_leftBody_11 = new THREE.Group();
  node_leftBody_11.name = "Left white plastic housing (voluminous case)__pivot";
  node_leftBody_11.scale.set(1, 1, 1);
  if (endpoint_leftBody_11) {
    node_leftBody_11.position.copy(endpoint_leftBody_11.start);
    node_leftBody_11.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_leftBody_11.position.set(-0.216, 0.7599999999999999, 0.2);
    node_leftBody_11.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_leftBody_11.userData.sculptComponent = {"id": "leftBody", "name": "Left white plastic housing (voluminous case)", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Large, thick plastic housing that is the DOMINANT volume of the support structure (65% of total riser height, vs 32% for the silver bar frame below it and 3% for the glass above it). Small corner-fillet radius only. Entirely below the glass, flush at housingTopY == glassBottomY.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.048, "height": 0.15, "depth": 0.09, "units": "meters", "confidence": 0.7}, "transform": {"position": [-0.216, 0.7599999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}}, "material": "riserPlastic", "materialLayers": ["riserPlastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-rounded-corners", "kind": "geometry-fillet", "description": "Softly rounded vertical corners, not sharp right angles.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["body-rounded-corners"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 242, 239, 1.0)", "secondaryAlbedo": "rgba(230, 230, 226, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leftBody_11.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}};
  (nodes["root"] ?? root).add(node_leftBody_11);
  nodes["leftBody"] = node_leftBody_11;
  const mesh_leftBody_11Geometry = endpoint_leftBody_11
    ? new THREE.CylinderGeometry(endpoint_leftBody_11.endRadius, endpoint_leftBody_11.baseRadius, endpoint_leftBody_11.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0});
  if (!endpoint_leftBody_11) {
    mesh_leftBody_11Geometry.scale(0.048, 0.15, 0.09);
  }
  const mesh_leftBody_11 = new THREE.Mesh(
    mesh_leftBody_11Geometry,
    materialMap["riserPlastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leftBody_11.name = "Left white plastic housing (voluminous case)";
  if (endpoint_leftBody_11) {
    mesh_leftBody_11.position.copy(endpoint_leftBody_11.midpoint);
    mesh_leftBody_11.quaternion.copy(endpoint_leftBody_11.quaternion);
  }
  mesh_leftBody_11.castShadow = options.castShadow ?? true;
  mesh_leftBody_11.receiveShadow = options.receiveShadow ?? true;
  mesh_leftBody_11.userData.sculptComponent = {"id": "leftBody", "name": "Left white plastic housing (voluminous case)", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Large, thick plastic housing that is the DOMINANT volume of the support structure (65% of total riser height, vs 32% for the silver bar frame below it and 3% for the glass above it). Small corner-fillet radius only. Entirely below the glass, flush at housingTopY == glassBottomY.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.048, "height": 0.15, "depth": 0.09, "units": "meters", "confidence": 0.7}, "transform": {"position": [-0.216, 0.7599999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}}, "material": "riserPlastic", "materialLayers": ["riserPlastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-rounded-corners", "kind": "geometry-fillet", "description": "Softly rounded vertical corners, not sharp right angles.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["body-rounded-corners"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 242, 239, 1.0)", "secondaryAlbedo": "rgba(230, 230, 226, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_leftBody_11.add(mesh_leftBody_11);
  meshes["leftBody"] = mesh_leftBody_11;
  colliders["leftBody"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_leftBody_11);

  const endpoint_rightBody_12 = makeAttachmentEndpoint(null);
  const node_rightBody_12 = new THREE.Group();
  node_rightBody_12.name = "Right white plastic housing (voluminous case, USB hub)__pivot";
  node_rightBody_12.scale.set(1, 1, 1);
  if (endpoint_rightBody_12) {
    node_rightBody_12.position.copy(endpoint_rightBody_12.start);
    node_rightBody_12.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_rightBody_12.position.set(0.216, 0.7599999999999999, 0.2);
    node_rightBody_12.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_rightBody_12.userData.sculptComponent = {"id": "rightBody", "name": "Right white plastic housing (voluminous case, USB hub)", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Large, thick plastic housing that is the DOMINANT volume of the support structure (65% of total riser height, vs 32% for the silver bar frame below it and 3% for the glass above it). Small corner-fillet radius only. Entirely below the glass, flush at housingTopY == glassBottomY.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.048, "height": 0.15, "depth": 0.09, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.216, 0.7599999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}}, "material": "riserPlastic", "materialLayers": ["riserPlastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-rounded-corners", "kind": "geometry-fillet", "description": "Softly rounded vertical corners, not sharp right angles.", "evidenceRefs": ["riser-side-and-front-detail"]}, {"id": "right-body-port-panel", "kind": "attached-hardware", "description": "Front-facing (relative to the body's own wide outer side) recessed dark panel with a mic jack, headphone jack, and 3 USB-2.0 slots.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["body-rounded-corners", "right-body-port-panel"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 242, 239, 1.0)", "secondaryAlbedo": "rgba(230, 230, 226, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_rightBody_12.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}};
  (nodes["root"] ?? root).add(node_rightBody_12);
  nodes["rightBody"] = node_rightBody_12;
  const mesh_rightBody_12Geometry = endpoint_rightBody_12
    ? new THREE.CylinderGeometry(endpoint_rightBody_12.endRadius, endpoint_rightBody_12.baseRadius, endpoint_rightBody_12.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0});
  if (!endpoint_rightBody_12) {
    mesh_rightBody_12Geometry.scale(0.048, 0.15, 0.09);
  }
  const mesh_rightBody_12 = new THREE.Mesh(
    mesh_rightBody_12Geometry,
    materialMap["riserPlastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rightBody_12.name = "Right white plastic housing (voluminous case, USB hub)";
  if (endpoint_rightBody_12) {
    mesh_rightBody_12.position.copy(endpoint_rightBody_12.midpoint);
    mesh_rightBody_12.quaternion.copy(endpoint_rightBody_12.quaternion);
  }
  mesh_rightBody_12.castShadow = options.castShadow ?? true;
  mesh_rightBody_12.receiveShadow = options.receiveShadow ?? true;
  mesh_rightBody_12.userData.sculptComponent = {"id": "rightBody", "name": "Right white plastic housing (voluminous case, USB hub)", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Large, thick plastic housing that is the DOMINANT volume of the support structure (65% of total riser height, vs 32% for the silver bar frame below it and 3% for the glass above it). Small corner-fillet radius only. Entirely below the glass, flush at housingTopY == glassBottomY.", "geometryDescriptor": {"topologyIntent": "vertically-extruded rounded-rectangle prism, rotated so the extrude axis is vertical", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.006, "segments": 4}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.5, 0.46], [0.49048, 0.47531], [0.46339, 0.48828], [0.42284, 0.49696], [0.375, 0.5], [-0.375, 0.5], [-0.42284, 0.49696], [-0.46339, 0.48828], [-0.49048, 0.47531], [-0.5, 0.46], [-0.5, -0.46], [-0.49048, -0.47531], [-0.46339, -0.48828], [-0.42284, -0.49696], [-0.375, -0.5], [0.375, -0.5], [0.42284, -0.49696], [0.46339, -0.48828], [0.49048, -0.47531], [0.5, -0.46]], "depth": 1.0}}, "parent": null, "attachment": null, "dimensions": {"width": 0.048, "height": 0.15, "depth": 0.09, "units": "meters", "confidence": 0.7}, "transform": {"position": [0.216, 0.7599999999999999, 0.2], "rotation": [-1.5707963267948966, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.216, 0.7599999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "riserPlastic"}}, "material": "riserPlastic", "materialLayers": ["riserPlastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-rounded-corners", "kind": "geometry-fillet", "description": "Softly rounded vertical corners, not sharp right angles.", "evidenceRefs": ["riser-side-and-front-detail"]}, {"id": "right-body-port-panel", "kind": "attached-hardware", "description": "Front-facing (relative to the body's own wide outer side) recessed dark panel with a mic jack, headphone jack, and 3 USB-2.0 slots.", "evidenceRefs": ["riser-side-and-front-detail"]}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": ["body-rounded-corners", "right-body-port-panel"], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 242, 239, 1.0)", "secondaryAlbedo": "rgba(230, 230, 226, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.75}};
  node_rightBody_12.add(mesh_rightBody_12);
  meshes["rightBody"] = mesh_rightBody_12;
  colliders["rightBody"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.048, 0.09, 0.15], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_rightBody_12);

  const endpoint_leftBarFront_13 = makeAttachmentEndpoint(null);
  const node_leftBarFront_13 = new THREE.Group();
  node_leftBarFront_13.name = "Left silver support bar (front)__pivot";
  node_leftBarFront_13.scale.set(1, 1, 1);
  if (endpoint_leftBarFront_13) {
    node_leftBarFront_13.position.copy(endpoint_leftBarFront_13.start);
    node_leftBarFront_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leftBarFront_13.position.set(-0.224, 0.7437499999999999, 0.2625);
    node_leftBarFront_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_leftBarFront_13.userData.sculptComponent = {"id": "leftBarFront", "name": "Left silver support bar (front)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin front vertical bar (not a wall/panel) -- only 40-50% of the housing's own height, and thin in cross-section (8-12% of housing height).", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.7437499999999999, 0.2625], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarFront_13.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_leftBarFront_13);
  nodes["leftBarFront"] = node_leftBarFront_13;
  const mesh_leftBarFront_13Geometry = endpoint_leftBarFront_13
    ? new THREE.CylinderGeometry(endpoint_leftBarFront_13.endRadius, endpoint_leftBarFront_13.baseRadius, endpoint_leftBarFront_13.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leftBarFront_13) {
    mesh_leftBarFront_13Geometry.scale(0.032, 0.0325, 0.01);
  }
  const mesh_leftBarFront_13 = new THREE.Mesh(
    mesh_leftBarFront_13Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leftBarFront_13.name = "Left silver support bar (front)";
  if (endpoint_leftBarFront_13) {
    mesh_leftBarFront_13.position.copy(endpoint_leftBarFront_13.midpoint);
    mesh_leftBarFront_13.quaternion.copy(endpoint_leftBarFront_13.quaternion);
  }
  mesh_leftBarFront_13.castShadow = options.castShadow ?? true;
  mesh_leftBarFront_13.receiveShadow = options.receiveShadow ?? true;
  mesh_leftBarFront_13.userData.sculptComponent = {"id": "leftBarFront", "name": "Left silver support bar (front)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin front vertical bar (not a wall/panel) -- only 40-50% of the housing's own height, and thin in cross-section (8-12% of housing height).", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.7437499999999999, 0.2625], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarFront_13.add(mesh_leftBarFront_13);
  meshes["leftBarFront"] = mesh_leftBarFront_13;
  colliders["leftBarFront"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_leftBarFront_13);

  const endpoint_leftBarBack_14 = makeAttachmentEndpoint(null);
  const node_leftBarBack_14 = new THREE.Group();
  node_leftBarBack_14.name = "Left silver support bar (back)__pivot";
  node_leftBarBack_14.scale.set(1, 1, 1);
  if (endpoint_leftBarBack_14) {
    node_leftBarBack_14.position.copy(endpoint_leftBarBack_14.start);
    node_leftBarBack_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leftBarBack_14.position.set(-0.224, 0.7437499999999999, 0.1375);
    node_leftBarBack_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_leftBarBack_14.userData.sculptComponent = {"id": "leftBarBack", "name": "Left silver support bar (back)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin back vertical bar, mirrors the front bar. The space between the two bars is fully open -- this is a bar frame, not a solid wall.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.7437499999999999, 0.1375], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarBack_14.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_leftBarBack_14);
  nodes["leftBarBack"] = node_leftBarBack_14;
  const mesh_leftBarBack_14Geometry = endpoint_leftBarBack_14
    ? new THREE.CylinderGeometry(endpoint_leftBarBack_14.endRadius, endpoint_leftBarBack_14.baseRadius, endpoint_leftBarBack_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leftBarBack_14) {
    mesh_leftBarBack_14Geometry.scale(0.032, 0.0325, 0.01);
  }
  const mesh_leftBarBack_14 = new THREE.Mesh(
    mesh_leftBarBack_14Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leftBarBack_14.name = "Left silver support bar (back)";
  if (endpoint_leftBarBack_14) {
    mesh_leftBarBack_14.position.copy(endpoint_leftBarBack_14.midpoint);
    mesh_leftBarBack_14.quaternion.copy(endpoint_leftBarBack_14.quaternion);
  }
  mesh_leftBarBack_14.castShadow = options.castShadow ?? true;
  mesh_leftBarBack_14.receiveShadow = options.receiveShadow ?? true;
  mesh_leftBarBack_14.userData.sculptComponent = {"id": "leftBarBack", "name": "Left silver support bar (back)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin back vertical bar, mirrors the front bar. The space between the two bars is fully open -- this is a bar frame, not a solid wall.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.7437499999999999, 0.1375], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarBack_14.add(mesh_leftBarBack_14);
  meshes["leftBarBack"] = mesh_leftBarBack_14;
  colliders["leftBarBack"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_leftBarBack_14);

  const endpoint_leftBarBottom_15 = makeAttachmentEndpoint(null);
  const node_leftBarBottom_15 = new THREE.Group();
  node_leftBarBottom_15.name = "Left silver bottom bar__pivot";
  node_leftBarBottom_15.scale.set(1, 1, 1);
  if (endpoint_leftBarBottom_15) {
    node_leftBarBottom_15.position.copy(endpoint_leftBarBottom_15.start);
    node_leftBarBottom_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leftBarBottom_15.position.set(-0.224, 0.72375, 0.2);
    node_leftBarBottom_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_leftBarBottom_15.userData.sculptComponent = {"id": "leftBarBottom", "name": "Left silver bottom bar", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin horizontal bar connecting the front and back bars near the floor -- a slim U-profile in side view, not a flat foot pad or plate.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0075, "depth": 0.135, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.72375, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarBottom_15.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_leftBarBottom_15);
  nodes["leftBarBottom"] = node_leftBarBottom_15;
  const mesh_leftBarBottom_15Geometry = endpoint_leftBarBottom_15
    ? new THREE.CylinderGeometry(endpoint_leftBarBottom_15.endRadius, endpoint_leftBarBottom_15.baseRadius, endpoint_leftBarBottom_15.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leftBarBottom_15) {
    mesh_leftBarBottom_15Geometry.scale(0.032, 0.0075, 0.135);
  }
  const mesh_leftBarBottom_15 = new THREE.Mesh(
    mesh_leftBarBottom_15Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leftBarBottom_15.name = "Left silver bottom bar";
  if (endpoint_leftBarBottom_15) {
    mesh_leftBarBottom_15.position.copy(endpoint_leftBarBottom_15.midpoint);
    mesh_leftBarBottom_15.quaternion.copy(endpoint_leftBarBottom_15.quaternion);
  }
  mesh_leftBarBottom_15.castShadow = options.castShadow ?? true;
  mesh_leftBarBottom_15.receiveShadow = options.receiveShadow ?? true;
  mesh_leftBarBottom_15.userData.sculptComponent = {"id": "leftBarBottom", "name": "Left silver bottom bar", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin horizontal bar connecting the front and back bars near the floor -- a slim U-profile in side view, not a flat foot pad or plate.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0075, "depth": 0.135, "units": "meters", "confidence": 0.6}, "transform": {"position": [-0.224, 0.72375, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [-0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_leftBarBottom_15.add(mesh_leftBarBottom_15);
  meshes["leftBarBottom"] = mesh_leftBarBottom_15;
  colliders["leftBarBottom"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_leftBarBottom_15);

  const endpoint_rightBarFront_16 = makeAttachmentEndpoint(null);
  const node_rightBarFront_16 = new THREE.Group();
  node_rightBarFront_16.name = "Right silver support bar (front)__pivot";
  node_rightBarFront_16.scale.set(1, 1, 1);
  if (endpoint_rightBarFront_16) {
    node_rightBarFront_16.position.copy(endpoint_rightBarFront_16.start);
    node_rightBarFront_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rightBarFront_16.position.set(0.224, 0.7437499999999999, 0.2625);
    node_rightBarFront_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_rightBarFront_16.userData.sculptComponent = {"id": "rightBarFront", "name": "Right silver support bar (front)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin front vertical bar (not a wall/panel) -- only 40-50% of the housing's own height, and thin in cross-section (8-12% of housing height).", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.7437499999999999, 0.2625], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarFront_16.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_rightBarFront_16);
  nodes["rightBarFront"] = node_rightBarFront_16;
  const mesh_rightBarFront_16Geometry = endpoint_rightBarFront_16
    ? new THREE.CylinderGeometry(endpoint_rightBarFront_16.endRadius, endpoint_rightBarFront_16.baseRadius, endpoint_rightBarFront_16.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_rightBarFront_16) {
    mesh_rightBarFront_16Geometry.scale(0.032, 0.0325, 0.01);
  }
  const mesh_rightBarFront_16 = new THREE.Mesh(
    mesh_rightBarFront_16Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rightBarFront_16.name = "Right silver support bar (front)";
  if (endpoint_rightBarFront_16) {
    mesh_rightBarFront_16.position.copy(endpoint_rightBarFront_16.midpoint);
    mesh_rightBarFront_16.quaternion.copy(endpoint_rightBarFront_16.quaternion);
  }
  mesh_rightBarFront_16.castShadow = options.castShadow ?? true;
  mesh_rightBarFront_16.receiveShadow = options.receiveShadow ?? true;
  mesh_rightBarFront_16.userData.sculptComponent = {"id": "rightBarFront", "name": "Right silver support bar (front)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin front vertical bar (not a wall/panel) -- only 40-50% of the housing's own height, and thin in cross-section (8-12% of housing height).", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.7437499999999999, 0.2625], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.2625], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarFront_16.add(mesh_rightBarFront_16);
  meshes["rightBarFront"] = mesh_rightBarFront_16;
  colliders["rightBarFront"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_rightBarFront_16);

  const endpoint_rightBarBack_17 = makeAttachmentEndpoint(null);
  const node_rightBarBack_17 = new THREE.Group();
  node_rightBarBack_17.name = "Right silver support bar (back)__pivot";
  node_rightBarBack_17.scale.set(1, 1, 1);
  if (endpoint_rightBarBack_17) {
    node_rightBarBack_17.position.copy(endpoint_rightBarBack_17.start);
    node_rightBarBack_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rightBarBack_17.position.set(0.224, 0.7437499999999999, 0.1375);
    node_rightBarBack_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_rightBarBack_17.userData.sculptComponent = {"id": "rightBarBack", "name": "Right silver support bar (back)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin back vertical bar, mirrors the front bar. The space between the two bars is fully open -- this is a bar frame, not a solid wall.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.7437499999999999, 0.1375], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarBack_17.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_rightBarBack_17);
  nodes["rightBarBack"] = node_rightBarBack_17;
  const mesh_rightBarBack_17Geometry = endpoint_rightBarBack_17
    ? new THREE.CylinderGeometry(endpoint_rightBarBack_17.endRadius, endpoint_rightBarBack_17.baseRadius, endpoint_rightBarBack_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_rightBarBack_17) {
    mesh_rightBarBack_17Geometry.scale(0.032, 0.0325, 0.01);
  }
  const mesh_rightBarBack_17 = new THREE.Mesh(
    mesh_rightBarBack_17Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rightBarBack_17.name = "Right silver support bar (back)";
  if (endpoint_rightBarBack_17) {
    mesh_rightBarBack_17.position.copy(endpoint_rightBarBack_17.midpoint);
    mesh_rightBarBack_17.quaternion.copy(endpoint_rightBarBack_17.quaternion);
  }
  mesh_rightBarBack_17.castShadow = options.castShadow ?? true;
  mesh_rightBarBack_17.receiveShadow = options.receiveShadow ?? true;
  mesh_rightBarBack_17.userData.sculptComponent = {"id": "rightBarBack", "name": "Right silver support bar (back)", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin back vertical bar, mirrors the front bar. The space between the two bars is fully open -- this is a bar frame, not a solid wall.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0325, "depth": 0.01, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.7437499999999999, 0.1375], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.7437499999999999, 0.1375], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarBack_17.add(mesh_rightBarBack_17);
  meshes["rightBarBack"] = mesh_rightBarBack_17;
  colliders["rightBarBack"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0325, 0.01], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_rightBarBack_17);

  const endpoint_rightBarBottom_18 = makeAttachmentEndpoint(null);
  const node_rightBarBottom_18 = new THREE.Group();
  node_rightBarBottom_18.name = "Right silver bottom bar__pivot";
  node_rightBarBottom_18.scale.set(1, 1, 1);
  if (endpoint_rightBarBottom_18) {
    node_rightBarBottom_18.position.copy(endpoint_rightBarBottom_18.start);
    node_rightBarBottom_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rightBarBottom_18.position.set(0.224, 0.72375, 0.2);
    node_rightBarBottom_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_rightBarBottom_18.userData.sculptComponent = {"id": "rightBarBottom", "name": "Right silver bottom bar", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin horizontal bar connecting the front and back bars near the floor -- a slim U-profile in side view, not a flat foot pad or plate.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0075, "depth": 0.135, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.72375, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarBottom_18.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}};
  (nodes["root"] ?? root).add(node_rightBarBottom_18);
  nodes["rightBarBottom"] = node_rightBarBottom_18;
  const mesh_rightBarBottom_18Geometry = endpoint_rightBarBottom_18
    ? new THREE.CylinderGeometry(endpoint_rightBarBottom_18.endRadius, endpoint_rightBarBottom_18.baseRadius, endpoint_rightBarBottom_18.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_rightBarBottom_18) {
    mesh_rightBarBottom_18Geometry.scale(0.032, 0.0075, 0.135);
  }
  const mesh_rightBarBottom_18 = new THREE.Mesh(
    mesh_rightBarBottom_18Geometry,
    materialMap["metalSilver"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rightBarBottom_18.name = "Right silver bottom bar";
  if (endpoint_rightBarBottom_18) {
    mesh_rightBarBottom_18.position.copy(endpoint_rightBarBottom_18.midpoint);
    mesh_rightBarBottom_18.quaternion.copy(endpoint_rightBarBottom_18.quaternion);
  }
  mesh_rightBarBottom_18.castShadow = options.castShadow ?? true;
  mesh_rightBarBottom_18.receiveShadow = options.receiveShadow ?? true;
  mesh_rightBarBottom_18.userData.sculptComponent = {"id": "rightBarBottom", "name": "Right silver bottom bar", "level": "meso", "role": "attachment", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Thin horizontal bar connecting the front and back bars near the floor -- a slim U-profile in side view, not a flat foot pad or plate.", "geometryDescriptor": {"topologyIntent": "simple rectangular block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.001, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.032, "height": 0.0075, "depth": 0.135, "units": "meters", "confidence": 0.6}, "transform": {"position": [0.224, 0.72375, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.224, 0.72375, 0.2], "axis": [0, 1, 0], "confidence": 0.6}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "metalSilver"}}, "material": "metalSilver", "materialLayers": ["metalSilver"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 200, 202, 1.0)", "secondaryAlbedo": "rgba(170, 170, 174, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.65}};
  node_rightBarBottom_18.add(mesh_rightBarBottom_18);
  meshes["rightBarBottom"] = mesh_rightBarBottom_18;
  colliders["rightBarBottom"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.032, 0.0075, 0.135], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_rightBarBottom_18);

  const endpoint_portPanel_19 = makeAttachmentEndpoint(null);
  const node_portPanel_19 = new THREE.Group();
  node_portPanel_19.name = "Port panel backing plate (light gray)__pivot";
  node_portPanel_19.scale.set(1, 1, 1);
  if (endpoint_portPanel_19) {
    node_portPanel_19.position.copy(endpoint_portPanel_19.start);
    node_portPanel_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_portPanel_19.position.set(0.24150000000000002, 0.8049999999999999, 0.2);
    node_portPanel_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_portPanel_19.userData.sculptComponent = {"id": "portPanel", "name": "Port panel backing plate (light gray)", "level": "micro", "role": "attachment", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Shallow shallow inset-look panel sized to ~60% of the housing's outer-face area, with ample plain housing visible around its border. Background is light warm-gray (matching the housing family, not black) -- black is reserved for the USB slot interiors only.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.003, "height": 0.07, "depth": 0.115, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24150000000000002, 0.8049999999999999, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24150000000000002, 0.8049999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.003, 0.07, 0.115], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "portPanelDark"}}, "material": "portPanelDark", "materialLayers": ["portPanelDark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_portPanel_19.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24150000000000002, 0.8049999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.003, 0.07, 0.115], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "portPanelDark"}};
  (nodes["root"] ?? root).add(node_portPanel_19);
  nodes["portPanel"] = node_portPanel_19;
  const mesh_portPanel_19Geometry = endpoint_portPanel_19
    ? new THREE.CylinderGeometry(endpoint_portPanel_19.endRadius, endpoint_portPanel_19.baseRadius, endpoint_portPanel_19.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_portPanel_19) {
    mesh_portPanel_19Geometry.scale(0.003, 0.07, 0.115);
  }
  const mesh_portPanel_19 = new THREE.Mesh(
    mesh_portPanel_19Geometry,
    materialMap["portPanelDark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_portPanel_19.name = "Port panel backing plate (light gray)";
  if (endpoint_portPanel_19) {
    mesh_portPanel_19.position.copy(endpoint_portPanel_19.midpoint);
    mesh_portPanel_19.quaternion.copy(endpoint_portPanel_19.quaternion);
  }
  mesh_portPanel_19.castShadow = options.castShadow ?? true;
  mesh_portPanel_19.receiveShadow = options.receiveShadow ?? true;
  mesh_portPanel_19.userData.sculptComponent = {"id": "portPanel", "name": "Port panel backing plate (light gray)", "level": "micro", "role": "attachment", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Shallow shallow inset-look panel sized to ~60% of the housing's outer-face area, with ample plain housing visible around its border. Background is light warm-gray (matching the housing family, not black) -- black is reserved for the USB slot interiors only.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.003, "height": 0.07, "depth": 0.115, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24150000000000002, 0.8049999999999999, 0.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24150000000000002, 0.8049999999999999, 0.2], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.003, 0.07, 0.115], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "portPanelDark"}}, "material": "portPanelDark", "materialLayers": ["portPanelDark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_portPanel_19.add(mesh_portPanel_19);
  meshes["portPanel"] = mesh_portPanel_19;
  colliders["portPanel"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.003, 0.07, 0.115], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_portPanel_19);

  const endpoint_micJack_20 = makeAttachmentEndpoint(null);
  const node_micJack_20 = new THREE.Group();
  node_micJack_20.name = "Mic jack (pink)__pivot";
  node_micJack_20.scale.set(1, 1, 1);
  if (endpoint_micJack_20) {
    node_micJack_20.position.copy(endpoint_micJack_20.start);
    node_micJack_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_micJack_20.position.set(0.24400000000000002, 0.8049999999999999, 0.16);
    node_micJack_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_micJack_20.userData.sculptComponent = {"id": "micJack", "name": "Mic jack (pink)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud pink icon on the panel representing the microphone jack; approximated as a flat colored block rather than a true circular jack cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.002, "height": 0.012, "depth": 0.012, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.16], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.16], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "micPink"}}, "material": "micPink", "materialLayers": ["micPink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_micJack_20.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.16], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "micPink"}};
  (nodes["root"] ?? root).add(node_micJack_20);
  nodes["micJack"] = node_micJack_20;
  const mesh_micJack_20Geometry = endpoint_micJack_20
    ? new THREE.CylinderGeometry(endpoint_micJack_20.endRadius, endpoint_micJack_20.baseRadius, endpoint_micJack_20.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_micJack_20) {
    mesh_micJack_20Geometry.scale(0.002, 0.012, 0.012);
  }
  const mesh_micJack_20 = new THREE.Mesh(
    mesh_micJack_20Geometry,
    materialMap["micPink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_micJack_20.name = "Mic jack (pink)";
  if (endpoint_micJack_20) {
    mesh_micJack_20.position.copy(endpoint_micJack_20.midpoint);
    mesh_micJack_20.quaternion.copy(endpoint_micJack_20.quaternion);
  }
  mesh_micJack_20.castShadow = options.castShadow ?? true;
  mesh_micJack_20.receiveShadow = options.receiveShadow ?? true;
  mesh_micJack_20.userData.sculptComponent = {"id": "micJack", "name": "Mic jack (pink)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud pink icon on the panel representing the microphone jack; approximated as a flat colored block rather than a true circular jack cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.002, "height": 0.012, "depth": 0.012, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.16], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.16], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "micPink"}}, "material": "micPink", "materialLayers": ["micPink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_micJack_20.add(mesh_micJack_20);
  meshes["micJack"] = mesh_micJack_20;
  colliders["micJack"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_micJack_20);

  const endpoint_headphoneJack_21 = makeAttachmentEndpoint(null);
  const node_headphoneJack_21 = new THREE.Group();
  node_headphoneJack_21.name = "Headphone jack (green)__pivot";
  node_headphoneJack_21.scale.set(1, 1, 1);
  if (endpoint_headphoneJack_21) {
    node_headphoneJack_21.position.copy(endpoint_headphoneJack_21.start);
    node_headphoneJack_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_headphoneJack_21.position.set(0.24400000000000002, 0.8049999999999999, 0.18000000000000002);
    node_headphoneJack_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_headphoneJack_21.userData.sculptComponent = {"id": "headphoneJack", "name": "Headphone jack (green)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud green icon on the panel representing the headphone jack; approximated as a flat colored block rather than a true circular jack cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.002, "height": 0.012, "depth": 0.012, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.18000000000000002], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.18000000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "headphoneGreen"}}, "material": "headphoneGreen", "materialLayers": ["headphoneGreen"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_headphoneJack_21.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.18000000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "headphoneGreen"}};
  (nodes["root"] ?? root).add(node_headphoneJack_21);
  nodes["headphoneJack"] = node_headphoneJack_21;
  const mesh_headphoneJack_21Geometry = endpoint_headphoneJack_21
    ? new THREE.CylinderGeometry(endpoint_headphoneJack_21.endRadius, endpoint_headphoneJack_21.baseRadius, endpoint_headphoneJack_21.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_headphoneJack_21) {
    mesh_headphoneJack_21Geometry.scale(0.002, 0.012, 0.012);
  }
  const mesh_headphoneJack_21 = new THREE.Mesh(
    mesh_headphoneJack_21Geometry,
    materialMap["headphoneGreen"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_headphoneJack_21.name = "Headphone jack (green)";
  if (endpoint_headphoneJack_21) {
    mesh_headphoneJack_21.position.copy(endpoint_headphoneJack_21.midpoint);
    mesh_headphoneJack_21.quaternion.copy(endpoint_headphoneJack_21.quaternion);
  }
  mesh_headphoneJack_21.castShadow = options.castShadow ?? true;
  mesh_headphoneJack_21.receiveShadow = options.receiveShadow ?? true;
  mesh_headphoneJack_21.userData.sculptComponent = {"id": "headphoneJack", "name": "Headphone jack (green)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud green icon on the panel representing the headphone jack; approximated as a flat colored block rather than a true circular jack cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.002, "height": 0.012, "depth": 0.012, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.18000000000000002], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.18000000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "headphoneGreen"}}, "material": "headphoneGreen", "materialLayers": ["headphoneGreen"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_headphoneJack_21.add(mesh_headphoneJack_21);
  meshes["headphoneJack"] = mesh_headphoneJack_21;
  colliders["headphoneJack"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.002, 0.012, 0.012], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_headphoneJack_21);

  const endpoint_usbSlot1_22 = makeAttachmentEndpoint(null);
  const node_usbSlot1_22 = new THREE.Group();
  node_usbSlot1_22.name = "USB-2.0 slot 1 (black)__pivot";
  node_usbSlot1_22.scale.set(1, 1, 1);
  if (endpoint_usbSlot1_22) {
    node_usbSlot1_22.position.copy(endpoint_usbSlot1_22.start);
    node_usbSlot1_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_usbSlot1_22.position.set(0.24400000000000002, 0.8049999999999999, 0.21200000000000002);
    node_usbSlot1_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_usbSlot1_22.userData.sculptComponent = {"id": "usbSlot1", "name": "USB-2.0 slot 1 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.21200000000000002], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.21200000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot1_22.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.21200000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}};
  (nodes["root"] ?? root).add(node_usbSlot1_22);
  nodes["usbSlot1"] = node_usbSlot1_22;
  const mesh_usbSlot1_22Geometry = endpoint_usbSlot1_22
    ? new THREE.CylinderGeometry(endpoint_usbSlot1_22.endRadius, endpoint_usbSlot1_22.baseRadius, endpoint_usbSlot1_22.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_usbSlot1_22) {
    mesh_usbSlot1_22Geometry.scale(0.0015, 0.02, 0.007);
  }
  const mesh_usbSlot1_22 = new THREE.Mesh(
    mesh_usbSlot1_22Geometry,
    materialMap["usbSlotGray"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_usbSlot1_22.name = "USB-2.0 slot 1 (black)";
  if (endpoint_usbSlot1_22) {
    mesh_usbSlot1_22.position.copy(endpoint_usbSlot1_22.midpoint);
    mesh_usbSlot1_22.quaternion.copy(endpoint_usbSlot1_22.quaternion);
  }
  mesh_usbSlot1_22.castShadow = options.castShadow ?? true;
  mesh_usbSlot1_22.receiveShadow = options.receiveShadow ?? true;
  mesh_usbSlot1_22.userData.sculptComponent = {"id": "usbSlot1", "name": "USB-2.0 slot 1 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.21200000000000002], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.21200000000000002], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot1_22.add(mesh_usbSlot1_22);
  meshes["usbSlot1"] = mesh_usbSlot1_22;
  colliders["usbSlot1"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_usbSlot1_22);

  const endpoint_usbSlot2_23 = makeAttachmentEndpoint(null);
  const node_usbSlot2_23 = new THREE.Group();
  node_usbSlot2_23.name = "USB-2.0 slot 2 (black)__pivot";
  node_usbSlot2_23.scale.set(1, 1, 1);
  if (endpoint_usbSlot2_23) {
    node_usbSlot2_23.position.copy(endpoint_usbSlot2_23.start);
    node_usbSlot2_23.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_usbSlot2_23.position.set(0.24400000000000002, 0.8049999999999999, 0.228);
    node_usbSlot2_23.rotation.set(0.0, 0.0, 0.0);
  }
  node_usbSlot2_23.userData.sculptComponent = {"id": "usbSlot2", "name": "USB-2.0 slot 2 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.228], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.228], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot2_23.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.228], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}};
  (nodes["root"] ?? root).add(node_usbSlot2_23);
  nodes["usbSlot2"] = node_usbSlot2_23;
  const mesh_usbSlot2_23Geometry = endpoint_usbSlot2_23
    ? new THREE.CylinderGeometry(endpoint_usbSlot2_23.endRadius, endpoint_usbSlot2_23.baseRadius, endpoint_usbSlot2_23.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_usbSlot2_23) {
    mesh_usbSlot2_23Geometry.scale(0.0015, 0.02, 0.007);
  }
  const mesh_usbSlot2_23 = new THREE.Mesh(
    mesh_usbSlot2_23Geometry,
    materialMap["usbSlotGray"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_usbSlot2_23.name = "USB-2.0 slot 2 (black)";
  if (endpoint_usbSlot2_23) {
    mesh_usbSlot2_23.position.copy(endpoint_usbSlot2_23.midpoint);
    mesh_usbSlot2_23.quaternion.copy(endpoint_usbSlot2_23.quaternion);
  }
  mesh_usbSlot2_23.castShadow = options.castShadow ?? true;
  mesh_usbSlot2_23.receiveShadow = options.receiveShadow ?? true;
  mesh_usbSlot2_23.userData.sculptComponent = {"id": "usbSlot2", "name": "USB-2.0 slot 2 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.228], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.228], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot2_23.add(mesh_usbSlot2_23);
  meshes["usbSlot2"] = mesh_usbSlot2_23;
  colliders["usbSlot2"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_usbSlot2_23);

  const endpoint_usbSlot3_24 = makeAttachmentEndpoint(null);
  const node_usbSlot3_24 = new THREE.Group();
  node_usbSlot3_24.name = "USB-2.0 slot 3 (black)__pivot";
  node_usbSlot3_24.scale.set(1, 1, 1);
  if (endpoint_usbSlot3_24) {
    node_usbSlot3_24.position.copy(endpoint_usbSlot3_24.start);
    node_usbSlot3_24.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_usbSlot3_24.position.set(0.24400000000000002, 0.8049999999999999, 0.244);
    node_usbSlot3_24.rotation.set(0.0, 0.0, 0.0);
  }
  node_usbSlot3_24.userData.sculptComponent = {"id": "usbSlot3", "name": "USB-2.0 slot 3 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.244], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.244], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot3_24.userData.actionProfile = {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.244], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}};
  (nodes["root"] ?? root).add(node_usbSlot3_24);
  nodes["usbSlot3"] = node_usbSlot3_24;
  const mesh_usbSlot3_24Geometry = endpoint_usbSlot3_24
    ? new THREE.CylinderGeometry(endpoint_usbSlot3_24.endRadius, endpoint_usbSlot3_24.baseRadius, endpoint_usbSlot3_24.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_usbSlot3_24) {
    mesh_usbSlot3_24Geometry.scale(0.0015, 0.02, 0.007);
  }
  const mesh_usbSlot3_24 = new THREE.Mesh(
    mesh_usbSlot3_24Geometry,
    materialMap["usbSlotGray"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_usbSlot3_24.name = "USB-2.0 slot 3 (black)";
  if (endpoint_usbSlot3_24) {
    mesh_usbSlot3_24.position.copy(endpoint_usbSlot3_24.midpoint);
    mesh_usbSlot3_24.quaternion.copy(endpoint_usbSlot3_24.quaternion);
  }
  mesh_usbSlot3_24.castShadow = options.castShadow ?? true;
  mesh_usbSlot3_24.receiveShadow = options.receiveShadow ?? true;
  mesh_usbSlot3_24.userData.sculptComponent = {"id": "usbSlot3", "name": "USB-2.0 slot 3 (black)", "level": "micro", "role": "attachment", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small proud black icon on the panel representing one vertical USB-2.0 slot; approximated as a flat block rather than a true slot cutout at this quality tier.", "geometryDescriptor": {"topologyIntent": "flat panel/icon block", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.0005, "segments": 1}, "deformationStack": [], "uvStrategy": "planar-projected per face", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0015, "height": 0.02, "depth": 0.007, "units": "meters", "confidence": 0.55}, "transform": {"position": [0.24400000000000002, 0.8049999999999999, 0.244], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-prop", "pivot": {"mode": "center", "localPosition": [0.24400000000000002, 0.8049999999999999, 0.244], "axis": [0, 1, 0], "confidence": 0.55}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glassRiser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "usbSlotGray"}}, "material": "usbSlotGray", "materialLayers": ["usbSlotGray"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.1, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "none", "occlusionPattern": "", "edgeWearPattern": "none", "notes": ""}, "evidenceRefs": ["riser-side-and-front-detail"], "details": [], "fidelityTier": "form-refined", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 216, 213, 1.0)", "secondaryAlbedo": "rgba(200, 200, 197, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6}};
  node_usbSlot3_24.add(mesh_usbSlot3_24);
  meshes["usbSlot3"] = mesh_usbSlot3_24;
  colliders["usbSlot3"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.0015, 0.02, 0.007], "isTrigger": false, "notes": ""};
  destructionGroups["glassRiser"] ??= [];
  destructionGroups["glassRiser"].push(node_usbSlot3_24);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "The single reference photo is one elevated three-quarter shot of the whole desk, with no close-up material crops. extract_pbr_evidence.py needs a crop tight enough on one material's visible footprint to extract a usable per-material palette/roughness/height estimate; run against the whole-scene photo it would be sampling four different materials' pixels at once, which is not usable evidence for any one of them. Per-material albedo/roughness/normal parameters in this spec are instead hand-authored from direct visual inspection of the reference (documented in each material's albedo.samplingNotes), not from pixel extraction. If closer material crops become available, re-run extraction and flip this back to true."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createCurvedBirchPlyDeskSetupLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Curved Birch Ply Desk Setup look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Key light: soft diffuse daylight from upper-left (through the frame-left window visible in the source photo), broad and low-contrast -- treat as a large-area directional/rect light rather than a hard point source.", "Fill light: neutral low-intensity ambient/hemisphere fill from the room's white walls, keeping shadow-side falloff gentle rather than crushed to black.", "Rim/environment: no strong rim light observed; use a plain neutral-gray environment reflection on the glass riser only, since the opaque plywood/rubber/metal materials do not show environment reflections in the reference.", "Exposure and tone mapping: neutral exposure, ACES filmic tone mapping, to keep the pale birch tabletop from clipping to white while the black mat still reads as a distinct near-black rather than crushed pure black.", "Background: plain neutral mid-gray background/no environment backdrop, since the room is explicitly out of scope for this reconstruction.", "Contact shadow: soft, tight contact shadow/ambient occlusion under the desk's floor contact lines, under the mat's perimeter lip, and under the glass riser's two legs, to ground each object against the (unmodeled) floor plane."];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "The single reference photo is one elevated three-quarter shot of the whole desk, with no close-up material crops. extract_pbr_evidence.py needs a crop tight enough on one material's visible footprint to extract a usable per-material palette/roughness/height estimate; run against the whole-scene photo it would be sampling four different materials' pixels at once, which is not usable evidence for any one of them. Per-material albedo/roughness/normal parameters in this spec are instead hand-authored from direct visual inspection of the reference (documented in each material's albedo.samplingNotes), not from pixel extraction. If closer material crops become available, re-run extraction and flip this back to true."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
// NOT cached: a PMREMGenerator's output texture is backed by a WebGLRenderTarget owned by
// the renderer that built it, so reusing it with a later, different WebGLRenderer instance
// (each mount creates a fresh renderer) renders as a dead/blank environment -- the exact
// "flat, washed-out" look this renderer's ACES+sRGB setup exists to avoid. Must build fresh
// per renderer.
export function createCurvedBirchPlyDeskSetupEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameCurvedBirchPlyDeskSetupCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createCurvedBirchPlyDeskSetupPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureCurvedBirchPlyDeskSetupRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createCurvedBirchPlyDeskSetupInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
