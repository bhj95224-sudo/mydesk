import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  configureKeyboardRenderer,
  createKeyboardEnvironment,
  createKeyboardLookDevLights,
  createKeyboardModel,
  frameKeyboardCamera,
} from '../models/createKeyboardModel';
import { attachKeyboardInteractions } from '../models/keyboardInteractions';

type KeyboardInteractiveSceneProps = {
  className?: string;
  onReady?: () => void;
  onKeyPress?: (key: string) => void;
  onBackgroundClick?: () => void;
  // Starts the entrance camera move (KEYBOARD_CAMERA_INTRO_FROM -> KEYBOARD_CAMERA_DEFAULTS).
  // Until then the camera holds the FROM framing -- the page flips this once its loader
  // is gone so the move is actually seen.
  playCameraIntro?: boolean;
  // Called once the entrance camera move has settled on its final framing.
  onCameraIntroComplete?: () => void;
};

export type KeyboardCameraSettings = {
  azimuthDeg: number;
  elevationDeg: number;
  fov: number;
  // >1 shrinks the keyboard in frame.
  margin: number;
  // Parallel pan (camera + lookAt target move together, angle unchanged), in model units.
  // +X moves the keyboard left on screen, +Z moves it up (for a top-down shot).
  panX: number;
  panZ: number;
};

// On entering the page the camera starts top-down (FROM) and eases into the angled view
// (DEFAULTS), then stays there.
export const KEYBOARD_CAMERA_INTRO_FROM: KeyboardCameraSettings = {
  azimuthDeg: 0,
  elevationDeg: 89.5,
  fov: 32,
  margin: 1.1,
  panX: 4,
  panZ: 0,
};
export const KEYBOARD_CAMERA_DEFAULTS: KeyboardCameraSettings = {
  azimuthDeg: 18.5,
  elevationDeg: 42.5,
  fov: 10,
  margin: 1.13,
  panX: 12,
  panZ: -2,
};
const CAMERA_INTRO_DELAY_MS = 150;
const CAMERA_INTRO_MS = 1600;
// Rounds the width-fit/height-fit switch in frameKeyboardCamera so the dolly speed doesn't
// jump mid-move (see smoothFit there).
const CAMERA_FIT_SMOOTHING = 0.15;

function lerpCameraSettings(from: KeyboardCameraSettings, to: KeyboardCameraSettings, t: number): KeyboardCameraSettings {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    azimuthDeg: lerp(from.azimuthDeg, to.azimuthDeg),
    elevationDeg: lerp(from.elevationDeg, to.elevationDeg),
    fov: lerp(from.fov, to.fov),
    margin: lerp(from.margin, to.margin),
    panX: lerp(from.panX, to.panX),
    panZ: lerp(from.panZ, to.panZ),
  };
}

// Smootherstep: zero speed AND zero acceleration at both ends, so the move eases out of the
// top-down view without the jolt a sine ease has (its acceleration jumps from 0 to max on
// the first frame), and its peak speed is lower than easeInOutCubic's.
function smootherStep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
// Pressable keys stand this much taller than the rest (model units; a keycap is 2.5).
const PRESSABLE_KEY_RAISE = 2.5;
// Idle "someone is typing" press on a random pressable key -- motion only, no card.
const AUTO_PRESS_INTERVAL_MS = 8000;

export function KeyboardInteractiveScene({
  className,
  onReady,
  onKeyPress,
  onBackgroundClick,
  playCameraIntro = true,
  onCameraIntroComplete,
}: KeyboardInteractiveSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Read by the render loop.
  const playCameraIntroRef = useRef(playCameraIntro);
  playCameraIntroRef.current = playCameraIntro;
  const onCameraIntroCompleteRef = useRef(onCameraIntroComplete);
  onCameraIntroCompleteRef.current = onCameraIntroComplete;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    configureKeyboardRenderer(renderer);
    renderer.domElement.setAttribute('aria-label', '클릭할 수 있는 3D 키보드. 색이 칠해진 키를 누르면 관련 활용 정보가 표시됩니다.');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createKeyboardEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    const model = createKeyboardModel({
      includeNavCluster: false,
      highlightPressableKeys: true,
      pressableKeyRaise: PRESSABLE_KEY_RAISE,
    });
    scene.add(model);
    scene.add(createKeyboardLookDevLights());

    const interactions = attachKeyboardInteractions(renderer, camera, model, onKeyPress, onBackgroundClick);

    // Typing on the real keyboard presses the matching model key too (motion only -- the
    // page's own keydown handler takes care of the card). Same filters as that handler.
    const handlePhysicalKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!event.code.startsWith('Key')) return;
      interactions.pressKey(event.code.slice(3));
    };
    window.addEventListener('keydown', handlePhysicalKeyDown);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let introStart: number | null = null;
    let introDone = reduceMotion;
    // What the camera should show this frame: the entrance move (held at FROM until
    // playCameraIntro, then eased to DEFAULTS).
    // Eased 0..1 progress of the move (0 = FROM, 1 = DEFAULTS); drives the fit correction.
    let introEase = introDone ? 1 : 0;
    const currentCameraSettings = (now: number): KeyboardCameraSettings => {
      if (introDone) {
        introEase = 1;
        return KEYBOARD_CAMERA_DEFAULTS;
      }
      if (!playCameraIntroRef.current) return KEYBOARD_CAMERA_INTRO_FROM;
      introStart ??= now;
      const t = Math.min(1, Math.max(0, (now - introStart - CAMERA_INTRO_DELAY_MS) / CAMERA_INTRO_MS));
      if (t >= 1) {
        introDone = true;
        introEase = 1;
        return KEYBOARD_CAMERA_DEFAULTS;
      }
      introEase = smootherStep(t);
      return lerpCameraSettings(KEYBOARD_CAMERA_INTRO_FROM, KEYBOARD_CAMERA_DEFAULTS, introEase);
    };

    // smoothFit makes the keyboard a bit smaller than a hard fit; scale the margin back by
    // the hard/smooth distance ratio at the two ends (blended by progress) so the start and
    // end framings match the tuned values exactly. Depends on aspect -- recomputed in resize().
    const scratchCamera = new THREE.PerspectiveCamera();
    const scratchCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const hardToSmoothRatio = (settings: KeyboardCameraSettings) => {
      scratchCamera.aspect = camera.aspect;
      scratchCamera.fov = settings.fov;
      const az = (settings.azimuthDeg * Math.PI) / 180;
      const opts = {
        azimuthDeg: settings.azimuthDeg,
        elevationDeg: settings.elevationDeg,
        margin: 1,
        up: new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az)),
      };
      frameKeyboardCamera(scratchCamera, model, opts);
      const hard = scratchCamera.position.distanceTo(scratchCenter);
      frameKeyboardCamera(scratchCamera, model, { ...opts, smoothFit: CAMERA_FIT_SMOOTHING });
      return hard / scratchCamera.position.distanceTo(scratchCenter);
    };
    let fitCorrectionFrom = 1;
    let fitCorrectionTo = 1;

    // Measured once, before any key press animation can nudge it, so the framing target
    // doesn't wobble from frame to frame during the camera move.
    const modelCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    let framedSettings: KeyboardCameraSettings = currentCameraSettings(performance.now());
    // Camera-only; runs every frame during the entrance move. Canvas resizing lives in
    // resize() below, since setSize() every frame reallocates the drawing buffer.
    const frameCamera = () => {
      const settings = framedSettings;
      camera.fov = settings.fov;

      // "Horizontally away from the camera" is a valid up reference at every elevation below
      // 90deg and varies smoothly with azimuth, so both the fit distance and the roll stay
      // continuous through the move (frameKeyboardCamera's own up swaps near straight-down).
      const az = (settings.azimuthDeg * Math.PI) / 180;
      frameKeyboardCamera(camera, model, {
        azimuthDeg: settings.azimuthDeg,
        elevationDeg: settings.elevationDeg,
        margin: settings.margin * (fitCorrectionFrom + (fitCorrectionTo - fitCorrectionFrom) * introEase),
        up: new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az)),
        smoothFit: CAMERA_FIT_SMOOTHING,
      });

      // Parallel pan: translate the camera and its lookAt target together by the same
      // vector, so the viewing angle is untouched -- only the framed window slides.
      const panOffset = new THREE.Vector3(settings.panX, 0, settings.panZ);
      camera.position.add(panOffset);
      camera.lookAt(modelCenter.clone().add(panOffset));
      camera.updateProjectionMatrix();
    };
    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      fitCorrectionFrom = hardToSmoothRatio(KEYBOARD_CAMERA_INTRO_FROM);
      fitCorrectionTo = hardToSmoothRatio(KEYBOARD_CAMERA_DEFAULTS);
      frameCamera();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId = 0;
    let readyNotified = false;
    let introCompleteNotified = false;
    const render = (now: number) => {
      const nextSettings = currentCameraSettings(now);
      if (nextSettings !== framedSettings) {
        framedSettings = nextSettings;
        frameCamera();
      }
      if (introDone && !introCompleteNotified) {
        introCompleteNotified = true;
        onCameraIntroCompleteRef.current?.();
      }
      interactions(now);
      renderer.render(scene, camera);
      if (!readyNotified) {
        readyNotified = true;
        onReady?.();
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    const autoPressTimer = reduceMotion
      ? 0
      : window.setInterval(() => interactions.pressRandomKey(), AUTO_PRESS_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearInterval(autoPressTimer);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handlePhysicalKeyDown);
      interactions.dispose();
      environment.dispose();

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
        meshMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
      });
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onReady, onKeyPress, onBackgroundClick]);

  return <div ref={containerRef} className={className} />;
}
