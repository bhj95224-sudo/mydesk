import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedBirchPlyDeskSetupModel,
  createCurvedBirchPlyDeskSetupLookDevLights,
  configureCurvedBirchPlyDeskSetupRenderer,
  createCurvedBirchPlyDeskSetupEnvironment,
  type ProceduralModelRuntime,
} from '../models/createDeskSetupModel';
import {
  CURVED_MONITOR_SCREEN_ASPECT,
  createCurvedAllInOneMonitorModel,
  createCurvedMonitorScreenSurface,
} from '../models/createCurvedMonitorModel';
import { createKeyboardModel } from '../models/createKeyboardModel';
import { createTabletModel } from '../models/createTabletModel';

export type DeskObjectDestination = '/keyboard' | '/projects' | '/tablet';

type DeskSetupSceneProps = {
  className?: string;
  introActive?: boolean;
  introComplete?: boolean;
  onReady?: () => void;
  onIntroComplete?: () => void;
  onObjectActivate?: (destination: DeskObjectDestination) => void;
  onDrawerActivate?: () => void;
  // Drawer clicked while its note is open -- the page should close the note.
  onDrawerClose?: () => void;
  // Whether the note the drawer file opened is currently showing; when it goes back to
  // false the file slides back into the drawer.
  drawerFileOut?: boolean;
  // Off by default so the real desk page keeps its current (baked contact-shadow) look --
  // see #/lab's shadow toggle, which is the only current caller that opts in. Live-checked
  // each frame (not baked at setup) so a lab checkbox can flip it without remounting.
  enableShadows?: boolean;
  // The real scene has no floor mesh (its contact shadows are baked into the desk texture
  // instead -- see createCurvedBirchPlyDeskSetupLookDevLights's userData notes), so with only
  // enableShadows on, the desk's own legs/pedestal have nothing to cast a shadow onto -- only
  // the objects sitting ON the desk surface show moving shadows. This adds an invisible
  // shadow-catcher plane under the model so the desk itself casts one too. Lab-only, like
  // enableShadows.
  showShadowFloor?: boolean;
  // Zeroes the desk's own baked aoMap so only the real dynamic shadow (above) shows, for an
  // apples-to-apples comparison. Desk only. Lab-only.
  hideBakedAO?: boolean;
  // Live-updated key light position (world space) -- moves the shadow direction/position.
  // Lab-only; the real page uses the light's built-in default position.
  keyLightPosition?: THREE.Vector3Tuple;
  // Live-updated tint for the shadow-catcher floor's ShadowMaterial (only meaningful with
  // showShadowFloor). Lab-only.
  shadowColor?: string;
  // Live-updated color multiplied against each desk material's own base color (hue AND
  // lightness both move, since it's a real multiply, not a hue-rotate) -- desk only, not
  // monitor/keyboard/tablet. Lab-only.
  deskTintColor?: string;
  // Live-updated HSL adjustments applied to each desk material's own color (after
  // deskTintColor) -- desk only, not monitor/keyboard/tablet. Replaces a whole-screen CSS
  // filter that used to also hit the other objects. Percent/percent/degrees, defaults
  // 100/100/0 (no change). Lab-only.
  deskBrightness?: number;
  deskSaturate?: number;
  deskHue?: number;
  // Live-updated flat color laid over the desk plywood with a NORMAL blend (not a multiply):
  // at deskSolidAmount 1 the wood's albedo is replaced outright by this color, so the picked
  // swatch is what the desk is painted with (lighting/AO still shade it). Lower amounts fade
  // back toward the regular tinted wood underneath. Must be defined at mount to install the
  // shader hook. Desk only. Used by the real desk page (DeskPage) and tuned in DeskColorLab.tsx.
  deskSolidColor?: string;
  deskSolidAmount?: number;
  // 0..1, default 1. Below 1 the lit/tone-mapped result is pulled back toward the flat
  // deskSolidColor so the on-screen desk matches the hex (0 = exact hex, no shading).
  deskSolidLightInfluence?: number;
  // Swaps the mouse-tilt azimuth follow for a manual spin: drag left/right, or scroll
  // (independently of dragging), to freely rotate the desk around -- azimuth only, no
  // up/down tilt, no zoom. Lab-only -- the real desk page's click-to-navigate/drawer-hover
  // raycasting isn't tuned to coexist with this.
  enableOrbitControls?: boolean;
};

export type DeskSetupSceneHandle = {
  setAzimuthPointer: (normalizedX: number) => void;
  resetAzimuthPointer: () => void;
};

const BASE_AZIMUTH_DEG = 35;
const AZIMUTH_RANGE_DEG = 4;
const ELEVATION_DEG = 28;
const CAMERA_MARGIN = 1.25;
const AZIMUTH_EASE = 0.08;
// Lab-only manual spin (enableOrbitControls): free continuous rotation (azimuth only --
// elevation/tilt never changes, so no up/down). Both dragging and scrolling rotate
// (independently of each other); scroll never zooms.
const SPIN_DRAG_DEG_PER_PX = 0.25;
const SPIN_WHEEL_DEG_PER_UNIT = 0.1;
const HOVER_LIFT = 0.04;
const HOVER_LIFT_EASE = 0.18;
const FLOAT_AMPLITUDE = { monitor: 0.008, keyboard: 0.006, tablet: 0.006 };
const FLOAT_PERIOD_MS = { monitor: 4200, keyboard: 4700, tablet: 3900 };
// Only the top drawer (drawerFront2, its handle and its interior box) is the hover/click
// hit-zone -- the lower drawers stay inert.
const DRAWER_SLIDE_DISTANCE = 0.18;
const DRAWER_SLIDE_EASE = 0.12;
// Document folder stored upright in the top drawer. Hovering the drawer makes it peek out;
// clicking lifts it out and lays it flat on the desk, and the contact note opens once it
// has (mostly) landed.
const DRAWER_FILE_NAME = 'drawerFront2-file';
const DRAWER_FILE_OUT_MS = 1000;
const DRAWER_FILE_BACK_MS = 750;
const DRAWER_FILE_NOTE_AT = 0.9;
// Right behind the drawer front so it's in front of the tabletop overhang when open.
const DRAWER_FILE_REST = new THREE.Vector3(0, -0.079, -0.028);
const DRAWER_FILE_PEEK = 0.085;
const DRAWER_FILE_ARC = 0.12;
// Relative to the pedestal's top-front corner center (world units): x sideways, z back
// from the pedestal front face (negative = toward the back of the desk).
const DRAWER_FILE_LANDING_OFFSET = new THREE.Vector3(0.02, 0, 0.02);
const DRAWER_FILE_LANDING_YAW = 0.18;
// Extra slide along the landed file's own "down" (its bottom edge, toward the desk's front
// edge) so the tablet doesn't cover it.
const DRAWER_FILE_LANDING_SLIDE = 0.105;

function createDrawerFile(): THREE.Group {
  const file = new THREE.Group();
  file.name = DRAWER_FILE_NAME;
  // Same yellow as the contact note it opens (ContactNote's accent). Unlit and not
  // tone-mapped so it reads as exactly that hex on screen instead of washed out by the scene
  // lighting/ACES.
  const coverMaterial = new THREE.MeshBasicMaterial({ color: '#f7ec9d', toneMapped: false });
  const paperMaterial = new THREE.MeshStandardMaterial({ color: '#FFFDF7', roughness: 0.9 });
  const W = 0.3;
  const H = 0.13;
  const T = 0.003;

  // Back cover with a label tab on the upper left; origin at the bottom center.
  const backShape = new THREE.Shape();
  backShape.moveTo(-W / 2, 0);
  backShape.lineTo(W / 2, 0);
  backShape.lineTo(W / 2, H);
  backShape.lineTo(-W / 2 + 0.11, H);
  backShape.lineTo(-W / 2 + 0.1, H + 0.022);
  backShape.lineTo(-W / 2 + 0.01, H + 0.022);
  backShape.lineTo(-W / 2, H);
  backShape.closePath();
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(backShape, { depth: T, bevelEnabled: false }), coverMaterial);
  back.position.z = -0.006;
  file.add(back);

  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.012), paperMaterial);
  label.position.set(-W / 2 + 0.055, H + 0.011, -0.006 + T + 0.0005);
  file.add(label);

  [0.118, 0.124].forEach((height, index) => {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03 - index * 0.012, height, 0.001), paperMaterial);
    paper.position.set(0.006 * index, height / 2 + 0.003, -0.002 + index * 0.0015);
    file.add(paper);
  });

  // Front cover, a bit shorter than the back so the papers peek out, hinged open slightly.
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, H - 0.022, T), coverMaterial);
  front.geometry.translate(0, (H - 0.022) / 2, 0);
  front.position.z = 0.003;
  front.rotation.x = 0.06;
  file.add(front);

  file.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  file.position.copy(DRAWER_FILE_REST);
  return file;
}
// Project screens cycled on the desk monitor (Figma 275:472, 275:474, 275:473), each cropped
// to its 1034x576 Figma frame. Held, then cross-faded into the next.
const MONITOR_SLIDES = [
  '/assets/desk-monitor/sulwhasoo.jpg',
  '/assets/desk-monitor/jaduya.jpg',
  '/assets/desk-monitor/beplain.jpg',
];
const MONITOR_SLIDE_HOLD_MS = 3000;
const MONITOR_SLIDE_FADE_MS = 800;
const MONITOR_SCREEN_CANVAS_HEIGHT = 720;
let monitorSlideImages: HTMLImageElement[] | null = null;
// Loaded once per page load and kept, so returning to the desk doesn't refetch them.
function getMonitorSlideImages(): HTMLImageElement[] {
  monitorSlideImages ??= MONITOR_SLIDES.map((src) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    return image;
  });
  return monitorSlideImages;
}

// Cover-fits `image` into the canvas (the frames are 1034:576, the screen a bit wider).
function drawMonitorSlide(context: CanvasRenderingContext2D, image: HTMLImageElement, alpha: number) {
  const { width, height } = context.canvas;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.globalAlpha = alpha;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  context.globalAlpha = 1;
}

const INTRO_OBJECT_DURATION_MS = 600;
const INTRO_TOTAL_DURATION_MS = 860;

function smootherStep(progress: number): number {
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

type ClickableDeskObject = {
  destination: DeskObjectDestination;
  model: THREE.Object3D;
  baseY: number;
  introMaterials: IntroMaterialState[];
  introDelay: number;
  introOffsetY: number;
  introCurrentOffsetY: number;
  liftCurrent: number;
  liftTarget: number;
  floatAmplitude: number;
  floatPeriodMs: number;
};

type IntroMaterialState = {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  // Keep writing depth while faded. For the keyboard: with depthWrite off, its ~80 keycaps
  // and the case under them are ordered only by draw order, so the case painted over the
  // keys drawn before it and the keyboard looked blank until the intro finished.
  keepDepthWrite: boolean;
};

function collectIntroMaterials(model: THREE.Object3D, { keepDepthWrite = false } = {}): IntroMaterialState[] {
  const materials = new Set<THREE.Material>();
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
    meshMaterials.forEach((material) => materials.add(material));
  });

  return [...materials].map((material) => ({
    material,
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    keepDepthWrite,
  }));
}

function setIntroOpacity(states: IntroMaterialState[], progress: number) {
  for (const state of states) {
    if (!state.material.transparent) {
      state.material.transparent = true;
      state.material.needsUpdate = true;
    }
    state.material.depthWrite = state.keepDepthWrite;
    state.material.opacity = state.opacity * progress;
  }
}

function restoreIntroMaterials(states: IntroMaterialState[]) {
  for (const state of states) {
    const transparencyChanged = state.material.transparent !== state.transparent;
    state.material.opacity = state.opacity;
    state.material.transparent = state.transparent;
    state.material.depthWrite = state.depthWrite;
    if (transparencyChanged) state.material.needsUpdate = true;
  }
}

function placeDeskObject(
  model: THREE.Object3D,
  scale: number,
  position: THREE.Vector3Tuple,
  rotationY = 0,
): THREE.Object3D {
  model.scale.setScalar(scale);
  model.position.set(...position);
  model.rotation.set(0, rotationY, 0);
  model.updateMatrixWorld(true);
  return model;
}

export const DeskSetupScene = forwardRef<DeskSetupSceneHandle, DeskSetupSceneProps>(
  ({
    className,
    introActive = false,
    introComplete = false,
    onReady,
    onIntroComplete,
    onObjectActivate,
    onDrawerActivate,
    onDrawerClose,
    drawerFileOut,
    enableShadows,
    showShadowFloor,
    hideBakedAO,
    keyLightPosition,
    enableOrbitControls,
    shadowColor,
    deskTintColor,
    deskBrightness,
    deskSaturate,
    deskHue,
    deskSolidColor,
    deskSolidAmount,
    deskSolidLightInfluence,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetAzimuthRef = useRef(BASE_AZIMUTH_DEG);
    const introActiveRef = useRef(introActive);
    const introCompleteRef = useRef(introComplete);
    const onReadyRef = useRef(onReady);
    const onIntroCompleteRef = useRef(onIntroComplete);
    const onObjectActivateRef = useRef(onObjectActivate);
    const onDrawerActivateRef = useRef(onDrawerActivate);
    const onDrawerCloseRef = useRef(onDrawerClose);
    onDrawerCloseRef.current = onDrawerClose;
    const enableShadowsRef = useRef(enableShadows ?? false);
    const keyLightPositionRef = useRef(keyLightPosition);
    const shadowColorRef = useRef(shadowColor);
    const deskTintColorRef = useRef(deskTintColor);
    const deskBrightnessRef = useRef(deskBrightness ?? 100);
    const deskSaturateRef = useRef(deskSaturate ?? 100);
    const deskHueRef = useRef(deskHue ?? 0);
    // Read every frame by tick(), so kept in sync during render.
    const drawerFileOutRef = useRef(drawerFileOut ?? false);
    drawerFileOutRef.current = drawerFileOut ?? false;
    const deskSolidColorRef = useRef(deskSolidColor);
    const deskSolidAmountRef = useRef(deskSolidAmount ?? 1);
    const deskSolidLightInfluenceRef = useRef(deskSolidLightInfluence ?? 1);

    useEffect(() => {
      deskSolidColorRef.current = deskSolidColor;
      deskSolidAmountRef.current = deskSolidAmount ?? 1;
      deskSolidLightInfluenceRef.current = deskSolidLightInfluence ?? 1;
    }, [deskSolidColor, deskSolidAmount, deskSolidLightInfluence]);

    useEffect(() => {
      introActiveRef.current = introActive;
      introCompleteRef.current = introComplete;
      onReadyRef.current = onReady;
      onIntroCompleteRef.current = onIntroComplete;
      onObjectActivateRef.current = onObjectActivate;
      onDrawerActivateRef.current = onDrawerActivate;
      enableShadowsRef.current = enableShadows ?? false;
      keyLightPositionRef.current = keyLightPosition;
      shadowColorRef.current = shadowColor;
      deskTintColorRef.current = deskTintColor;
      deskBrightnessRef.current = deskBrightness ?? 100;
      deskSaturateRef.current = deskSaturate ?? 100;
      deskHueRef.current = deskHue ?? 0;
    }, [introActive, introComplete, onIntroComplete, onObjectActivate, onDrawerActivate, onReady, enableShadows, keyLightPosition, shadowColor, deskTintColor, deskBrightness, deskSaturate, deskHue]);

    useImperativeHandle(ref, () => ({
      setAzimuthPointer(normalizedX: number) {
        const clamped = Math.max(-1, Math.min(1, normalizedX));
        targetAzimuthRef.current = BASE_AZIMUTH_DEG - clamped * AZIMUTH_RANGE_DEG;
      },
      resetAzimuthPointer() {
        targetAzimuthRef.current = BASE_AZIMUTH_DEG;
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      configureCurvedBirchPlyDeskSetupRenderer(renderer);
      // Matches the key light's own soft shadow.radius/blurSamples config -- see
      // createCurvedBirchPlyDeskSetupLookDevLights. Harmless to set even while shadows are
      // off (enableShadowsRef starts false; toggled live in tick() below).
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const environment = createCurvedBirchPlyDeskSetupEnvironment(renderer);
      scene.environment = environment;
      scene.environmentIntensity = 1.0;

      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

      // The source model defaults to multi-megapixel procedural maps for look-dev.
      // The entry-page canvas is much smaller, so 512px maps avoid tens of millions
      // of synchronous texture samples without a visible loss at this display size.
      const model = createCurvedBirchPlyDeskSetupModel({
        textureSize: 512,
        textureAnisotropy: 4,
        qualityPriority: 'balanced',
      });
      scene.add(model);

      // The desk's own baked contact-shadow look comes from a real per-material aoMap (see
      // createDeskSetupModel.ts's material baking, ~line 660), not a hack -- but it means a
      // real dynamic shadow (enableShadows + showShadowFloor) layers on top of it instead of
      // replacing it. Zeroing aoMapIntensity here isolates the dynamic shadow so it's the only
      // one visible, for comparison. Desk only, not the monitor/keyboard/tablet. Lab-only.
      if (hideBakedAO) {
        model.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if ('aoMapIntensity' in material) (material as THREE.MeshStandardMaterial).aoMapIntensity = 0;
          }
        });
      }

      // Only the shared birch-plywood material (tabletop/leg panel/pedestal case/drawer
      // fronts all reference this SAME material instance) -- not the drawer handles, desk
      // mat, glass riser, aluminum legs, or the USB-hub's mic/headphone/USB icon colors.
      // Tinting every material under `model` (the old approach) swept those in too, which is
      // why adjustments looked muddy -- a pink mic icon or a black mat sliding hue/lightness
      // along with the wood never looks right. Captured once so the live tint
      // (deskTintColorRef, applied in tick()) always multiplies against the material's
      // ORIGINAL color rather than compounding onto whatever the previous frame left behind.
      // Desk only. Lab-only.
      const tintRuntime = model.userData.sculptRuntime as ProceduralModelRuntime | undefined;
      const plywoodMaterial = tintRuntime?.meshes['tabletop']?.material as THREE.MeshStandardMaterial | undefined;
      const deskTintableMaterials: { material: THREE.MeshStandardMaterial; baseColor: THREE.Color }[] = plywoodMaterial
        ? [{ material: plywoodMaterial, baseColor: plywoodMaterial.color.clone() }]
        : [];
      const tintScratch = new THREE.Color();
      const hslScratch = { h: 0, s: 0, l: 0 };

      // Normal-blend overlay for deskSolidColor: after the albedo map is sampled, mix the
      // result toward a flat uniform color. The uniform goes through THREE.Color.set, so the
      // sRGB hex is converted to linear like any other material color. The model is shared
      // across mounts, so the original hook/cache key are restored in cleanup.
      const solidUniforms = {
        uDeskSolidColor: { value: new THREE.Color('#ffffff') },
        uDeskSolidAmount: { value: 0 },
        uDeskLightInfluence: { value: 1 },
      };
      const solidHookInstalled = plywoodMaterial !== undefined && deskSolidColorRef.current !== undefined;
      const originalOnBeforeCompile = plywoodMaterial?.onBeforeCompile;
      const originalCacheKey = plywoodMaterial?.customProgramCacheKey;
      if (plywoodMaterial && solidHookInstalled) {
        plywoodMaterial.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, solidUniforms);
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'void main() {',
              'uniform vec3 uDeskSolidColor;\nuniform float uDeskSolidAmount;\nuniform float uDeskLightInfluence;\nvoid main() {',
            )
            .replace(
              '#include <map_fragment>',
              '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDeskSolidColor, uDeskSolidAmount);',
            )
            // Lighting + ACES tone mapping shift the picked color a lot, so optionally pull
            // the final pixel back toward the flat swatch (0 influence = exact hex on screen).
            .replace(
              '#include <tonemapping_fragment>',
              '#include <tonemapping_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uDeskSolidColor, (1.0 - uDeskLightInfluence) * uDeskSolidAmount);',
            );
        };
        plywoodMaterial.customProgramCacheKey = () => 'desk-solid-color';
        plywoodMaterial.needsUpdate = true;
      }

      // Rest heights put each object's lowest point just on its support (glass riser top
      // 0.8575, desk mat top 0.7285) -- the float in tick() only ever rises from here.
      const monitor = placeDeskObject(
        createCurvedAllInOneMonitorModel({}),
        0.48,
        [0, 0.8697, 0.19],
      );
      const keyboard = placeDeskObject(
        createKeyboardModel({ atlasLabels: true }),
        0.0041,
        [-0.12, 0.73, 0.49],
        -0.05,
      );
      const tablet = placeDeskObject(
        createTabletModel({}),
        0.0028,
        [0.5, 0.7342, 0.49],
        -0.035,
      );
      scene.add(monitor, keyboard, tablet);

      // Slideshow on the monitor screen. Added before the intro materials are collected so
      // it fades in with the monitor; removed again in cleanup since the monitor is cached.
      const slideCanvas = document.createElement('canvas');
      slideCanvas.height = MONITOR_SCREEN_CANVAS_HEIGHT;
      slideCanvas.width = Math.round(MONITOR_SCREEN_CANVAS_HEIGHT * CURVED_MONITOR_SCREEN_ASPECT);
      const slideContext = slideCanvas.getContext('2d');
      if (slideContext) {
        slideContext.fillStyle = '#05050a';
        slideContext.fillRect(0, 0, slideCanvas.width, slideCanvas.height);
      }
      const slideTexture = new THREE.CanvasTexture(slideCanvas);
      slideTexture.colorSpace = THREE.SRGBColorSpace;
      slideTexture.anisotropy = 4;
      const slideMaterial = new THREE.MeshBasicMaterial({ map: slideTexture, toneMapped: false });
      const slideSurface = createCurvedMonitorScreenSurface(slideMaterial);
      monitor.add(slideSurface);
      const slideImages = getMonitorSlideImages();
      let slideStartTime: number | null = null;
      let slideDrawnKey = '';

      const deskRuntime = model.userData.sculptRuntime as ProceduralModelRuntime | undefined;
      const drawerPivot = deskRuntime?.nodes['drawerFront2'];
      // The model is cached, so the pivot keeps whatever z the last mount left it at (e.g.
      // open, if the page was left with the file out). Record the real closed z once, on the
      // pivot itself, instead of trusting its current position.
      if (drawerPivot && drawerPivot.userData.drawerClosedZ === undefined) {
        drawerPivot.userData.drawerClosedZ = drawerPivot.position.z;
      }
      const drawerClosedZ: number = drawerPivot?.userData.drawerClosedZ ?? 0;
      let drawerHovered = false;
      // Starts open and eases closed on load (see the tick loop below) as a one-time reveal.
      let drawerOpenCurrent = 1;

      // The top drawer used to be just a front panel sliding in front of a solid case --
      // opening it revealed nothing behind it. This rebuilds the pedestal as a real hollow
      // shell (a picture-frame front panel with the drawer opening cut clean through it,
      // via THREE.Shape holes, plus the other 5 walls) and adds an empty interior box
      // parented to the same pivot as the front panel/handle, so it slides out together with
      // them and is actually visible through the opening.
      const pedestalNode = deskRuntime?.nodes['pedestalCarcass'];
      const pedestalMesh = deskRuntime?.meshes['pedestalCarcass'];
      // createCurvedBirchPlyDeskSetupModel's model is cached/shared across mounts (see the
      // cleanup comment below), and this effect can run more than once against that same
      // cached model (StrictMode's double-invoke in dev, or a genuine remount after
      // navigating away and back) -- guard on pedestalMesh still being attached so a second
      // run doesn't rebuild on top of the first run's already-rebuilt shell.
      if (pedestalNode && pedestalMesh && drawerPivot && pedestalMesh.parent === pedestalNode) {
        const pedestalMaterial = pedestalMesh.material as THREE.Material;
        pedestalNode.remove(pedestalMesh);

        const PEDESTAL_W = 0.46;
        const PEDESTAL_H = 0.685;
        const PEDESTAL_D = 0.6;
        const WALL = 0.02;
        const HOLE_W = 0.4;
        const HOLE_H = 0.19;
        const HOLE_CENTER_Y = 0.222; // matches drawerFront2's socket y

        const frontShape = new THREE.Shape();
        frontShape.moveTo(-PEDESTAL_W / 2, -PEDESTAL_H / 2);
        frontShape.lineTo(PEDESTAL_W / 2, -PEDESTAL_H / 2);
        frontShape.lineTo(PEDESTAL_W / 2, PEDESTAL_H / 2);
        frontShape.lineTo(-PEDESTAL_W / 2, PEDESTAL_H / 2);
        frontShape.closePath();
        const holePath = new THREE.Path();
        holePath.moveTo(-HOLE_W / 2, HOLE_CENTER_Y - HOLE_H / 2);
        holePath.lineTo(HOLE_W / 2, HOLE_CENTER_Y - HOLE_H / 2);
        holePath.lineTo(HOLE_W / 2, HOLE_CENTER_Y + HOLE_H / 2);
        holePath.lineTo(-HOLE_W / 2, HOLE_CENTER_Y + HOLE_H / 2);
        holePath.closePath();
        frontShape.holes.push(holePath);
        const frontGeometry = new THREE.ExtrudeGeometry(frontShape, { depth: WALL, bevelEnabled: false, steps: 1 });
        frontGeometry.translate(0, 0, PEDESTAL_D / 2 - WALL);
        const frontMesh = new THREE.Mesh(frontGeometry, pedestalMaterial);
        frontMesh.castShadow = true;
        frontMesh.receiveShadow = true;
        pedestalNode.add(frontMesh);

        const addCasePanel = (w: number, h: number, d: number, x: number, y: number, z: number) => {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pedestalMaterial);
          panel.position.set(x, y, z);
          panel.castShadow = true;
          panel.receiveShadow = true;
          pedestalNode.add(panel);
        };
        addCasePanel(PEDESTAL_W, PEDESTAL_H, WALL, 0, 0, -PEDESTAL_D / 2 + WALL / 2); // back
        addCasePanel(PEDESTAL_W, WALL, PEDESTAL_D, 0, PEDESTAL_H / 2 - WALL / 2, 0); // top
        addCasePanel(PEDESTAL_W, WALL, PEDESTAL_D, 0, -PEDESTAL_H / 2 + WALL / 2, 0); // bottom
        addCasePanel(WALL, PEDESTAL_H, PEDESTAL_D, -PEDESTAL_W / 2 + WALL / 2, 0, 0); // left
        addCasePanel(WALL, PEDESTAL_H, PEDESTAL_D, PEDESTAL_W / 2 - WALL / 2, 0, 0); // right

        const BOX_W = HOLE_W - 0.02;
        const BOX_H = HOLE_H - 0.02;
        const BOX_D = 0.24;
        const BOX_WALL = 0.006;
        const drawerBox = new THREE.Group();
        drawerBox.name = 'drawerFront2-interior';
        const addBoxPanel = (w: number, h: number, d: number, x: number, y: number, z: number) => {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pedestalMaterial);
          panel.position.set(x, y, z);
          panel.castShadow = true;
          panel.receiveShadow = true;
          drawerBox.add(panel);
        };
        addBoxPanel(BOX_W, BOX_H, BOX_WALL, 0, 0, -BOX_D + BOX_WALL / 2); // back
        addBoxPanel(BOX_W, BOX_WALL, BOX_D, 0, -BOX_H / 2 + BOX_WALL / 2, -BOX_D / 2); // bottom
        addBoxPanel(BOX_WALL, BOX_H, BOX_D, -BOX_W / 2 + BOX_WALL / 2, 0, -BOX_D / 2); // left
        addBoxPanel(BOX_WALL, BOX_H, BOX_D, BOX_W / 2 - BOX_WALL / 2, 0, -BOX_D / 2); // right
        drawerPivot.add(drawerBox);
      }

      // Looked up by name (not kept from the build above) because the model is cached and a
      // remount skips that rebuild.
      let drawerFile = drawerPivot?.getObjectByName(DRAWER_FILE_NAME) as THREE.Group | undefined;
      if (drawerPivot && !drawerFile) {
        drawerFile = createDrawerFile();
        drawerPivot.add(drawerFile);
      }
      const drawerHoverTargets = deskRuntime
        ? ([
            deskRuntime.meshes['drawerFront2'],
            deskRuntime.meshes['drawerHandle2'],
            drawerPivot?.getObjectByName('drawerFront2-interior'),
            drawerFile,
          ].filter(Boolean) as THREE.Object3D[])
        : [];
      // 0 = resting in the drawer, 1 = lifted out in front of the desk.
      let fileProgress = 0;
      let fileTarget = 0;
      let fileNoteRequested = false;
      let fileNoteSeenOpen = false;
      let filePeek = 0;
      let fileLandingWorld: THREE.Vector3 | null = null;
      const fileScratchStart = new THREE.Vector3();
      const fileScratchEnd = new THREE.Vector3();
      const fileScratchC1 = new THREE.Vector3();
      const fileScratchC2 = new THREE.Vector3();
      // On the tabletop right above the pedestal, just behind the front edge. Measured from
      // the live meshes (lazily, once matrices exist) rather than hard-coded model numbers.
      const computeFileLandingWorld = () => {
        const tabletopMesh = deskRuntime?.meshes['tabletop'];
        const pedestal = deskRuntime?.nodes['pedestalCarcass'];
        if (!tabletopMesh || !pedestal) return new THREE.Vector3();
        const topBox = new THREE.Box3().setFromObject(tabletopMesh);
        // Case panels only -- the drawer pivots (and this file) slide, so they'd skew it.
        const pedestalBox = new THREE.Box3();
        pedestal.children.forEach((child) => {
          if (child instanceof THREE.Mesh) pedestalBox.expandByObject(child);
        });
        const pedestalCenter = pedestalBox.getCenter(new THREE.Vector3());
        // Laid flat (rotation.x = -90deg) and spun by the yaw, the file's local -y ends up
        // pointing along (sin yaw, 0, cos yaw) in world space.
        return new THREE.Vector3(
          pedestalCenter.x + DRAWER_FILE_LANDING_OFFSET.x + Math.sin(DRAWER_FILE_LANDING_YAW) * DRAWER_FILE_LANDING_SLIDE,
          topBox.max.y + 0.004,
          pedestalBox.max.z + DRAWER_FILE_LANDING_OFFSET.z + Math.cos(DRAWER_FILE_LANDING_YAW) * DRAWER_FILE_LANDING_SLIDE,
        );
      };
      let lastTickTime: number | null = null;

      const clickableObjects: ClickableDeskObject[] = [
        {
          destination: '/projects',
          model: monitor,
          baseY: monitor.position.y,
          introMaterials: collectIntroMaterials(monitor),
          introDelay: 0,
          introOffsetY: 0.2,
          introCurrentOffsetY: 0,
          liftCurrent: 0,
          liftTarget: 0,
          floatAmplitude: FLOAT_AMPLITUDE.monitor,
          floatPeriodMs: FLOAT_PERIOD_MS.monitor,
        },
        {
          destination: '/keyboard',
          model: keyboard,
          baseY: keyboard.position.y,
          introMaterials: collectIntroMaterials(keyboard, { keepDepthWrite: true }),
          introDelay: 100,
          introOffsetY: 0.12,
          introCurrentOffsetY: 0,
          liftCurrent: 0,
          liftTarget: 0,
          floatAmplitude: FLOAT_AMPLITUDE.keyboard,
          floatPeriodMs: FLOAT_PERIOD_MS.keyboard,
        },
        {
          destination: '/tablet',
          model: tablet,
          baseY: tablet.position.y,
          introMaterials: collectIntroMaterials(tablet),
          introDelay: 200,
          introOffsetY: 0.13,
          introCurrentOffsetY: 0,
          liftCurrent: 0,
          liftTarget: 0,
          floatAmplitude: FLOAT_AMPLITUDE.tablet,
          floatPeriodMs: FLOAT_PERIOD_MS.tablet,
        },
      ];

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let introStartTime: number | null = null;
      let introFinished = introCompleteRef.current;
      let introCompletionNotified = introFinished;

      for (const object of clickableObjects) {
        object.introCurrentOffsetY = introFinished || reduceMotion ? 0 : object.introOffsetY;
        object.model.visible = true;
        object.model.position.y = object.baseY + object.introCurrentOffsetY;
        if (!introFinished && !reduceMotion) setIntroOpacity(object.introMaterials, 0);
      }
      if (introFinished || reduceMotion) drawerOpenCurrent = 0;
      // The page was left with the file out: keep the drawer open and the file on the desk
      // (without reopening the note) until the drawer is clicked again, which puts it away.
      let fileParked = false;
      // Right after that click the pointer is still on the drawer; ignore the hover-open
      // until it leaves, or the drawer would stay open under the cursor.
      let drawerHoverSuppressed = false;
      if (drawerPivot?.userData.drawerFileParked && drawerFile && introFinished && !reduceMotion) {
        fileParked = true;
        fileTarget = 1;
        fileProgress = 1;
        filePeek = 1;
        fileNoteRequested = true;
        drawerOpenCurrent = 1;
      }
      if (drawerPivot) drawerPivot.userData.drawerFileParked = false;

      const lights = createCurvedBirchPlyDeskSetupLookDevLights();
      scene.add(lights);
      const keyLight = lights.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight && child.castShadow,
      );

      // Frame once, then cache center/distance so per-frame azimuth updates
      // don't re-walk the whole model's geometry via Box3.setFromObject.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) * CAMERA_MARGIN;

      let shadowFloor: THREE.Mesh | null = null;
      if (showShadowFloor) {
        shadowFloor = new THREE.Mesh(
          new THREE.PlaneGeometry(maxDim * 6, maxDim * 6),
          new THREE.ShadowMaterial({ opacity: 0.35 }),
        );
        shadowFloor.rotation.x = -Math.PI / 2;
        shadowFloor.position.y = box.min.y;
        shadowFloor.receiveShadow = true;
        scene.add(shadowFloor);
      }

      const fov = (camera.fov * Math.PI) / 180;
      const distance = (maxDim / 2) / Math.tan(fov / 2);
      camera.near = Math.max(0.01, distance - maxDim);
      camera.far = distance + maxDim * 2;
      camera.updateProjectionMatrix();

      const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
      let currentAzimuthDeg = BASE_AZIMUTH_DEG;

      const updateCameraPosition = () => {
        const azimuthRad = (currentAzimuthDeg * Math.PI) / 180;
        const dir = new THREE.Vector3(
          Math.sin(azimuthRad) * Math.cos(elevationRad),
          Math.sin(elevationRad),
          Math.cos(azimuthRad) * Math.cos(elevationRad),
        );
        camera.position.copy(center).addScaledVector(dir, distance);
        camera.lookAt(center);
      };

      updateCameraPosition();

      let spinPointerDown = false;
      let spinStartX = 0;
      let spinStartAzimuth = BASE_AZIMUTH_DEG;

      // Distinguishes an actual drag-to-rotate gesture from a plain click (navigate/open
      // drawer) that happens to move a couple pixels between down and up.
      let spinDragMoved = false;
      const SPIN_CLICK_THRESHOLD_PX = 4;

      const handleSpinPointerDown = (event: PointerEvent) => {
        if (!enableOrbitControls || event.button !== 0) return;
        spinPointerDown = true;
        spinDragMoved = false;
        spinStartX = event.clientX;
        spinStartAzimuth = targetAzimuthRef.current;
      };
      const handleSpinPointerMove = (event: PointerEvent) => {
        if (!enableOrbitControls || !spinPointerDown) return;
        const deltaX = event.clientX - spinStartX;
        if (Math.abs(deltaX) > SPIN_CLICK_THRESHOLD_PX) spinDragMoved = true;
        // Unclamped -- full continuous spin, azimuth only (elevation/tilt never changes).
        // Dragging right rotates the desk's near side to the right (and vice versa), so the
        // sign is flipped relative to a camera-orbit convention.
        targetAzimuthRef.current = spinStartAzimuth - deltaX * SPIN_DRAG_DEG_PER_PX;
      };
      const handleSpinPointerUp = () => {
        spinPointerDown = false;
      };
      const handleSpinWheel = (event: WheelEvent) => {
        if (!enableOrbitControls) return;
        event.preventDefault();
        targetAzimuthRef.current += event.deltaY * SPIN_WHEEL_DEG_PER_UNIT;
      };

      if (enableOrbitControls) {
        renderer.domElement.addEventListener('pointerdown', handleSpinPointerDown);
        renderer.domElement.addEventListener('pointermove', handleSpinPointerMove);
        window.addEventListener('pointerup', handleSpinPointerUp);
        renderer.domElement.addEventListener('wheel', handleSpinWheel, { passive: false });
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const getPointedObject = (event: PointerEvent): ClickableDeskObject | undefined => {
        if (!introFinished) return undefined;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        return clickableObjects.find(({ model: clickableModel }) =>
          raycaster.intersectObject(clickableModel, true).length > 0,
        );
      };

      const handleObjectPointerMove = (event: PointerEvent) => {
        if (!introFinished) {
          renderer.domElement.style.cursor = 'default';
          drawerHovered = false;
          return;
        }
        const pointed = getPointedObject(event);
        // getPointedObject sets up `raycaster` for this event's screen position as a side
        // effect, so it can be reused here without recomputing the pointer.
        const overDrawer = drawerHoverTargets.length > 0
          && raycaster.intersectObjects(drawerHoverTargets, true).length > 0;
        if (!overDrawer) drawerHoverSuppressed = false;
        drawerHovered = overDrawer && !drawerHoverSuppressed;
        renderer.domElement.style.cursor = pointed || overDrawer ? 'pointer' : 'default';
        for (const object of clickableObjects) {
          object.liftTarget = object === pointed ? HOVER_LIFT : 0;
        }
      };

      const handleObjectPointerLeave = () => {
        renderer.domElement.style.cursor = 'default';
        drawerHovered = false;
        drawerHoverSuppressed = false;
        for (const object of clickableObjects) {
          object.liftTarget = 0;
        }
      };

      const handleObjectClick = (event: PointerEvent) => {
        if (!introFinished) return;
        if (enableOrbitControls && spinDragMoved) return;
        const target = getPointedObject(event);
        if (target) {
          onObjectActivateRef.current?.(target.destination);
          return;
        }
        // getPointedObject sets up `raycaster` for this event's screen position as a side
        // effect, so it can be reused here without recomputing the pointer.
        if (drawerHoverTargets.length > 0 && raycaster.intersectObjects(drawerHoverTargets, true).length > 0) {
          if (drawerFileOutRef.current) {
            // Note is open: clicking the drawer again closes it. tick() then sees the note
            // gone and tucks the file back in, and the drawer shuts behind it.
            onDrawerCloseRef.current?.();
            drawerHovered = false;
            drawerHoverSuppressed = true;
            return;
          }
          if (!drawerFile || reduceMotion) {
            onDrawerActivateRef.current?.();
            return;
          }
          if (fileParked) {
            // Put the file back and shut the drawer (it closes once the file is in).
            fileParked = false;
            fileTarget = 0;
            fileNoteRequested = false;
            fileNoteSeenOpen = false;
            drawerHovered = false;
            drawerHoverSuppressed = true;
            return;
          }
          // The note opens from tick() once the file is mostly out.
          fileTarget = 1;
        }
      };

      renderer.domElement.addEventListener('pointermove', handleObjectPointerMove);
      renderer.domElement.addEventListener('pointerleave', handleObjectPointerLeave);
      renderer.domElement.addEventListener('pointerup', handleObjectClick);

      const resize = () => {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      // Without this, the very first renderer.render() call below is the moment shaders
      // compile AND every material's texture (including the keyboard's label atlas) first
      // uploads to the GPU -- both synchronous, and on a slow GPU/driver that first call can
      // itself take multiple frames, so the compositor can paint a partially-uploaded frame
      // (keys missing/blank) before the next tick finishes it. compile() forces all of that
      // to happen right here, synchronously, while the page is still behind the intro
      // loading screen -- see IntroPage/onReady below -- so the first frame the user actually
      // sees is already complete.
      // Shadows are switched on per frame in tick(); set them now too, or compile() builds
      // the no-shadow program variants and the first real frames rebuild them all (the
      // keyboard, with the most materials, showed up noticeably late from that).
      renderer.shadowMap.enabled = enableShadowsRef.current;
      renderer.compile(scene, camera);
      // compile() only builds shaders; textures still upload on first draw. Push the
      // keyboard's label atlas (and its other maps) to the GPU now as well.
      keyboard.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          const map = (material as THREE.MeshStandardMaterial).map;
          if (map) renderer.initTexture(map);
        });
      });

      let frameId = 0;
      let readyNotified = false;
      let floatStartTime: number | null = null;
      const tick = (now: number) => {
        if (!introFinished && introActiveRef.current) {
          if (reduceMotion) {
            introFinished = true;
          } else {
            introStartTime ??= now;
            let allObjectsSettled = true;

            for (const object of clickableObjects) {
              const elapsed = now - introStartTime - object.introDelay;
              const progress = Math.max(0, Math.min(1, elapsed / INTRO_OBJECT_DURATION_MS));
              const easedProgress = smootherStep(progress);
              object.introCurrentOffsetY = object.introOffsetY * (1 - easedProgress);
              const fadeProgress = smootherStep(Math.min(1, progress / 0.58));
              setIntroOpacity(object.introMaterials, fadeProgress);
              if (progress < 1) allObjectsSettled = false;
            }

            if (allObjectsSettled && now - introStartTime >= INTRO_TOTAL_DURATION_MS) {
              introFinished = true;
            }
          }
        }

        if (introFinished && !introCompletionNotified && introActiveRef.current) {
          introCompletionNotified = true;
          for (const object of clickableObjects) {
            object.model.visible = true;
            object.introCurrentOffsetY = 0;
            restoreIntroMaterials(object.introMaterials);
          }
          onIntroCompleteRef.current?.();
        }

        currentAzimuthDeg += (targetAzimuthRef.current - currentAzimuthDeg) * AZIMUTH_EASE;
        updateCameraPosition();
        if (keyLight && keyLightPositionRef.current) keyLight.position.set(...keyLightPositionRef.current);
        if (shadowFloor && shadowColorRef.current) {
          (shadowFloor.material as THREE.ShadowMaterial).color.set(shadowColorRef.current);
        }
        if (deskTintableMaterials.length > 0) {
          const tint = deskTintColorRef.current ? tintScratch.set(deskTintColorRef.current) : null;
          const hueDeg = deskHueRef.current;
          const satPct = deskSaturateRef.current;
          const lightPct = deskBrightnessRef.current;
          const hasHsl = hueDeg !== 0 || satPct !== 100 || lightPct !== 100;
          for (const { material, baseColor } of deskTintableMaterials) {
            material.color.copy(baseColor);
            if (tint) material.color.multiply(tint);
            if (hasHsl) {
              material.color.getHSL(hslScratch);
              hslScratch.h = (((hslScratch.h + hueDeg / 360) % 1) + 1) % 1;
              hslScratch.s = Math.min(1, Math.max(0, hslScratch.s * (satPct / 100)));
              hslScratch.l = Math.min(1, Math.max(0, hslScratch.l * (lightPct / 100)));
              material.color.setHSL(hslScratch.h, hslScratch.s, hslScratch.l);
            }
          }
        }
        if (solidHookInstalled) {
          const solidColor = deskSolidColorRef.current;
          solidUniforms.uDeskSolidAmount.value = solidColor ? Math.min(1, Math.max(0, deskSolidAmountRef.current)) : 0;
          if (solidColor) solidUniforms.uDeskSolidColor.value.set(solidColor);
          solidUniforms.uDeskLightInfluence.value = Math.min(1, Math.max(0, deskSolidLightInfluenceRef.current));
        }
        if (drawerPivot) {
          if (!introFinished && introStartTime !== null) {
            // Close in sync with the monitor/keyboard/tablet intro drop rather than the
            // generic hover ease below.
            const drawerProgress = Math.max(0, Math.min(1, (now - introStartTime) / INTRO_OBJECT_DURATION_MS));
            drawerOpenCurrent = 1 - smootherStep(drawerProgress);
          } else if (introFinished) {
            // Stays open while the file is out (or on its way back in).
            const drawerOpenTarget = drawerHovered || fileTarget > 0 || fileProgress > 0.01 ? 1 : 0;
            drawerOpenCurrent += (drawerOpenTarget - drawerOpenCurrent) * DRAWER_SLIDE_EASE;
          }
          drawerPivot.position.z = drawerClosedZ + DRAWER_SLIDE_DISTANCE * drawerOpenCurrent;
        }
        const tickDelta = lastTickTime === null ? 0 : Math.min(250, now - lastTickTime);
        lastTickTime = now;
        if (drawerFile) {
          if (fileTarget === 1 && !fileNoteRequested && drawerFileOutRef.current) {
            // Note was already open when the drawer was clicked -- treat it as shown.
            fileNoteRequested = true;
          }
          if (fileNoteRequested && fileNoteSeenOpen && !drawerFileOutRef.current) {
            // Note closed: tuck the file back in (also ends a parked file from a return visit).
            fileParked = false;
            fileTarget = 0;
            fileNoteRequested = false;
            fileNoteSeenOpen = false;
          }
          if (drawerFileOutRef.current) fileNoteSeenOpen = true;
          // Don't lift until the drawer is mostly open, so the file clears the front panel.
          const canMove = fileTarget === 0 || drawerOpenCurrent > 0.7;
          if (canMove) {
            const step = tickDelta / (fileTarget === 1 ? DRAWER_FILE_OUT_MS : DRAWER_FILE_BACK_MS);
            fileProgress = fileTarget === 1 ? Math.min(1, fileProgress + step) : Math.max(0, fileProgress - step);
          }
          if (fileTarget === 1 && !fileNoteRequested && fileProgress >= DRAWER_FILE_NOTE_AT) {
            fileNoteRequested = true;
            onDrawerActivateRef.current?.();
          }
          // Hover: the file peeks up out of the open drawer.
          const peekTarget = drawerHovered || fileTarget === 1 || fileProgress > 0 ? 1 : 0;
          filePeek += (peekTarget - filePeek) * DRAWER_SLIDE_EASE;
          const start = fileScratchStart.copy(DRAWER_FILE_REST);
          start.y += DRAWER_FILE_PEEK * filePeek;

          if (fileProgress <= 0) {
            drawerFile.position.copy(start);
            drawerFile.rotation.set(0, 0, 0);
          } else {
            // Click: up and out of the drawer, over the front edge, then laid flat on the desk.
            // The landing spot is fixed in world space, so convert it into the (sliding)
            // drawer's local space every frame.
            if (!fileLandingWorld) fileLandingWorld = computeFileLandingWorld();
            const end = drawerPivot ? drawerPivot.worldToLocal(fileScratchEnd.copy(fileLandingWorld)) : fileScratchEnd.copy(start);
            const t = smootherStep(fileProgress);
            const apex = Math.max(start.y, end.y) + DRAWER_FILE_ARC;
            const c1 = fileScratchC1.set(start.x, apex, start.z + 0.12);
            const c2 = fileScratchC2.set(end.x, apex, end.z + 0.06);
            const u = 1 - t;
            drawerFile.position.set(0, 0, 0)
              .addScaledVector(start, u * u * u)
              .addScaledVector(c1, 3 * u * u * t)
              .addScaledVector(c2, 3 * u * t * t)
              .addScaledVector(end, t * t * t);
            const flat = smootherStep(Math.min(1, Math.max(0, (fileProgress - 0.15) / 0.75)));
            drawerFile.rotation.set(-Math.PI / 2 * flat, 0, DRAWER_FILE_LANDING_YAW * flat);
          }
        }
        const floatElapsed = introFinished && !reduceMotion ? now - (floatStartTime ??= now) : 0;
        for (const object of clickableObjects) {
          object.liftCurrent += (object.liftTarget - object.liftCurrent) * HOVER_LIFT_EASE;
          // Rises from the rest height and settles back onto it (0 .. 2x amplitude, the same
          // travel as the old +/-amplitude swing) instead of dipping below -- below rest the
          // objects sank into the desk mat / glass riser. Starts at 0 with zero speed, so
          // there's no jump when floating begins.
          const floatOffset = introFinished && !reduceMotion
            ? (1 - Math.cos(floatElapsed * Math.PI * 2 / object.floatPeriodMs)) * object.floatAmplitude
            : 0;
          object.model.position.y = object.baseY + object.introCurrentOffsetY + object.liftCurrent + floatOffset;
        }
        if (slideContext) {
          slideStartTime ??= now;
          const slidePeriod = MONITOR_SLIDE_HOLD_MS + MONITOR_SLIDE_FADE_MS;
          const slideElapsed = now - slideStartTime;
          const slideIndex = Math.floor(slideElapsed / slidePeriod) % slideImages.length;
          const current = slideImages[slideIndex];
          const upcoming = slideImages[(slideIndex + 1) % slideImages.length];
          const fade = Math.max(0, (slideElapsed % slidePeriod) - MONITOR_SLIDE_HOLD_MS) / MONITOR_SLIDE_FADE_MS;
          // Redraw only when the picture actually changes (30 steps per cross-fade).
          const fadeStep = upcoming.complete && upcoming.naturalWidth > 0 ? Math.round(smootherStep(fade) * 30) : 0;
          const slideKey = `${slideIndex}:${fadeStep}`;
          if (slideKey !== slideDrawnKey && current.complete && current.naturalWidth > 0) {
            drawMonitorSlide(slideContext, current, 1);
            if (fadeStep > 0) drawMonitorSlide(slideContext, upcoming, fadeStep / 30);
            slideTexture.needsUpdate = true;
            slideDrawnKey = slideKey;
          }
        }
        renderer.shadowMap.enabled = enableShadowsRef.current;
        renderer.render(scene, camera);
        if (!readyNotified) {
          readyNotified = true;
          onReadyRef.current?.();
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        clickableObjects.forEach((object) => restoreIntroMaterials(object.introMaterials));
        monitor.remove(slideSurface);
        slideSurface.geometry.dispose();
        slideMaterial.dispose();
        slideTexture.dispose();
        // Leave the shared model with the drawer shut and the file tucked inside; if the file
        // was out, flag it so the next mount reopens the drawer with the file on the desk.
        if (drawerPivot) {
          drawerPivot.position.z = drawerClosedZ;
          drawerPivot.userData.drawerFileParked = Boolean(drawerFile) && fileTarget === 1;
        }
        if (drawerFile) {
          drawerFile.position.copy(DRAWER_FILE_REST);
          drawerFile.rotation.set(0, 0, 0);
        }
        if (plywoodMaterial && solidHookInstalled && originalOnBeforeCompile && originalCacheKey) {
          plywoodMaterial.onBeforeCompile = originalOnBeforeCompile;
          plywoodMaterial.customProgramCacheKey = originalCacheKey;
          plywoodMaterial.needsUpdate = true;
        }
        renderer.domElement.removeEventListener('pointermove', handleObjectPointerMove);
        renderer.domElement.removeEventListener('pointerleave', handleObjectPointerLeave);
        renderer.domElement.removeEventListener('pointerup', handleObjectClick);
        if (enableOrbitControls) {
          renderer.domElement.removeEventListener('pointerdown', handleSpinPointerDown);
          renderer.domElement.removeEventListener('pointermove', handleSpinPointerMove);
          window.removeEventListener('pointerup', handleSpinPointerUp);
          renderer.domElement.removeEventListener('wheel', handleSpinWheel);
        }
        container.removeChild(renderer.domElement);
        renderer.dispose();
        // environment is built fresh per mount (see createDeskSetupModel.ts) and must be
        // disposed here; model is cached/shared across mounts, so only detach it.
        environment.dispose();
        keyboard.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        });
        scene.remove(model, monitor, keyboard, tablet, lights);
      };
    }, []);

    return <div ref={containerRef} className={className} />;
  },
);

DeskSetupScene.displayName = 'DeskSetupScene';
