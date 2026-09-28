import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedBirchPlyDeskSetupModel,
  createCurvedBirchPlyDeskSetupLookDevLights,
  configureCurvedBirchPlyDeskSetupRenderer,
  createCurvedBirchPlyDeskSetupEnvironment,
} from '../models/createDeskSetupModel';
import { createCurvedAllInOneMonitorModel } from '../models/createCurvedMonitorModel';
import { createKeyboardModel } from '../models/createKeyboardModel';
import { createTabletModel } from '../models/createTabletModel';

export type DeskObjectDestination = '/keyboard' | '/projects' | '/tablet';

type DeskSetupSceneProps = {
  className?: string;
  onReady?: () => void;
  onObjectActivate?: (destination: DeskObjectDestination) => void;
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

type ClickableDeskObject = {
  destination: DeskObjectDestination;
  model: THREE.Object3D;
};

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
  ({ className, onReady, onObjectActivate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetAzimuthRef = useRef(BASE_AZIMUTH_DEG);

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
        createKeyboardModel({}),
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

      const clickableObjects: ClickableDeskObject[] = [
        { destination: '/projects', model: monitor },
        { destination: '/keyboard', model: keyboard },
        { destination: '/tablet', model: tablet },
      ];

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
        renderer.domElement.style.cursor = getPointedObject(event) ? 'pointer' : 'default';
      };

      const handleObjectPointerLeave = () => {
        renderer.domElement.style.cursor = 'default';
      };

      const handleObjectClick = (event: PointerEvent) => {
        const target = getPointedObject(event);
        if (target) onObjectActivate?.(target.destination);
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

      let frameId = 0;
      let readyNotified = false;
      const tick = () => {
        currentAzimuthDeg += (targetAzimuthRef.current - currentAzimuthDeg) * AZIMUTH_EASE;
        updateCameraPosition();
        renderer.render(scene, camera);
        if (!readyNotified) {
          readyNotified = true;
          onReady?.();
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
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
    }, [onObjectActivate, onReady]);

    return <div ref={containerRef} className={className} />;
  },
);

DeskSetupScene.displayName = 'DeskSetupScene';
