import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedBirchPlyDeskSetupModel,
  createCurvedBirchPlyDeskSetupLookDevLights,
  configureCurvedBirchPlyDeskSetupRenderer,
  createCurvedBirchPlyDeskSetupEnvironment,
  type ProceduralModelRuntime,
} from '../models/createDeskSetupModel';
import { createCurvedAllInOneMonitorModel } from '../models/createCurvedMonitorModel';
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
const HOVER_LIFT = 0.04;
const HOVER_LIFT_EASE = 0.18;
// Hovering any of the 3 drawer fronts/handles opens only the top drawer (drawerFront2) --
// the hover hit-zone spans all three so the target doesn't need to be pixel-precise.
const DRAWER_SLIDE_DISTANCE = 0.18;
const DRAWER_SLIDE_EASE = 0.12;
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
};

type IntroMaterialState = {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

function collectIntroMaterials(model: THREE.Object3D): IntroMaterialState[] {
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
  }));
}

function setIntroOpacity(states: IntroMaterialState[], progress: number) {
  for (const state of states) {
    if (!state.material.transparent) {
      state.material.transparent = true;
      state.material.needsUpdate = true;
    }
    state.material.depthWrite = false;
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
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetAzimuthRef = useRef(BASE_AZIMUTH_DEG);
    const introActiveRef = useRef(introActive);
    const introCompleteRef = useRef(introComplete);
    const onReadyRef = useRef(onReady);
    const onIntroCompleteRef = useRef(onIntroComplete);
    const onObjectActivateRef = useRef(onObjectActivate);
    const onDrawerActivateRef = useRef(onDrawerActivate);

    useEffect(() => {
      introActiveRef.current = introActive;
      introCompleteRef.current = introComplete;
      onReadyRef.current = onReady;
      onIntroCompleteRef.current = onIntroComplete;
      onObjectActivateRef.current = onObjectActivate;
      onDrawerActivateRef.current = onDrawerActivate;
    }, [introActive, introComplete, onIntroComplete, onObjectActivate, onDrawerActivate, onReady]);

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

      const monitor = placeDeskObject(
        createCurvedAllInOneMonitorModel({}),
        0.48,
        [0, 0.858, 0.19],
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
        [0.5, 0.731, 0.49],
        -0.035,
      );
      scene.add(monitor, keyboard, tablet);

      const deskRuntime = model.userData.sculptRuntime as ProceduralModelRuntime | undefined;
      const drawerPivot = deskRuntime?.nodes['drawerFront2'];
      const drawerClosedZ = drawerPivot?.position.z ?? 0;
      const drawerHoverMeshes = deskRuntime
        ? ([
            deskRuntime.meshes['drawerFront1'],
            deskRuntime.meshes['drawerFront2'],
            deskRuntime.meshes['drawerHandle1'],
            deskRuntime.meshes['drawerHandle2'],
          ].filter(Boolean) as THREE.Mesh[])
        : [];
      let drawerOpenTarget = 0;
      // Starts open and eases closed on load (see the tick loop below) as a one-time reveal.
      let drawerOpenCurrent = 1;

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
        },
        {
          destination: '/keyboard',
          model: keyboard,
          baseY: keyboard.position.y,
          introMaterials: collectIntroMaterials(keyboard),
          introDelay: 100,
          introOffsetY: 0.12,
          introCurrentOffsetY: 0,
          liftCurrent: 0,
          liftTarget: 0,
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

      const lights = createCurvedBirchPlyDeskSetupLookDevLights();
      scene.add(lights);

      // Frame once, then cache center/distance so per-frame azimuth updates
      // don't re-walk the whole model's geometry via Box3.setFromObject.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) * CAMERA_MARGIN;
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
          drawerOpenTarget = 0;
          return;
        }
        const pointed = getPointedObject(event);
        // getPointedObject sets up `raycaster` for this event's screen position as a side
        // effect, so it can be reused here without recomputing the pointer.
        const drawerHovered = drawerHoverMeshes.length > 0
          && raycaster.intersectObjects(drawerHoverMeshes, true).length > 0;
        drawerOpenTarget = drawerHovered ? 1 : 0;
        renderer.domElement.style.cursor = pointed || drawerHovered ? 'pointer' : 'default';
        for (const object of clickableObjects) {
          object.liftTarget = object === pointed ? HOVER_LIFT : 0;
        }
      };

      const handleObjectPointerLeave = () => {
        renderer.domElement.style.cursor = 'default';
        drawerOpenTarget = 0;
        for (const object of clickableObjects) {
          object.liftTarget = 0;
        }
      };

      const handleObjectClick = (event: PointerEvent) => {
        if (!introFinished) return;
        const target = getPointedObject(event);
        if (target) {
          onObjectActivateRef.current?.(target.destination);
          return;
        }
        // getPointedObject sets up `raycaster` for this event's screen position as a side
        // effect, so it can be reused here without recomputing the pointer.
        if (drawerHoverMeshes.length > 0 && raycaster.intersectObjects(drawerHoverMeshes, true).length > 0) {
          onDrawerActivateRef.current?.();
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
      renderer.compile(scene, camera);

      let frameId = 0;
      let readyNotified = false;
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
        if (drawerPivot) {
          if (!introFinished && introStartTime !== null) {
            // Close in sync with the monitor/keyboard/tablet intro drop rather than the
            // generic hover ease below.
            const drawerProgress = Math.max(0, Math.min(1, (now - introStartTime) / INTRO_OBJECT_DURATION_MS));
            drawerOpenCurrent = 1 - smootherStep(drawerProgress);
          } else if (introFinished) {
            drawerOpenCurrent += (drawerOpenTarget - drawerOpenCurrent) * DRAWER_SLIDE_EASE;
          }
          drawerPivot.position.z = drawerClosedZ + DRAWER_SLIDE_DISTANCE * drawerOpenCurrent;
        }
        for (const object of clickableObjects) {
          object.liftCurrent += (object.liftTarget - object.liftCurrent) * HOVER_LIFT_EASE;
          object.model.position.y = object.baseY + object.introCurrentOffsetY + object.liftCurrent;
        }
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
        renderer.domElement.removeEventListener('pointermove', handleObjectPointerMove);
        renderer.domElement.removeEventListener('pointerleave', handleObjectPointerLeave);
        renderer.domElement.removeEventListener('pointerup', handleObjectClick);
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
