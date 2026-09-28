import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createKeyboardModel,
  createKeyboardLookDevLights,
  configureKeyboardRenderer,
  createKeyboardEnvironment,
} from '../models/createKeyboardModel';

type KeyboardOverlaySceneProps = {
  className?: string;
  onReady?: () => void;
};

export type KeyboardOverlaySceneHandle = {
  setAzimuthPointer: (normalizedX: number) => void;
  resetAzimuthPointer: () => void;
};

// Matches DeskSetupScene's azimuth/elevation exactly (not just the tilt range/easing) --
// this object sits flat on the desk's surface, so its camera needs the same viewing angle
// as the desk camera or it renders flatter/more top-down than the surface it sits on.
const BASE_AZIMUTH_DEG = 35;
const AZIMUTH_RANGE_DEG = 6;
const ELEVATION_DEG = 28;
const CAMERA_MARGIN = 1.07;
const AZIMUTH_EASE = 0.08;
// See TabletOverlayScene.tsx's FLATTEN_FACTOR comment: stepping the camera back and
// narrowing the FOV weakens this object's own perspective distortion to match the desk's
// flatter, more distant look, instead of looking shot separately and pasted on.
const FLATTEN_FACTOR = 4;

export const KeyboardOverlayScene = forwardRef<KeyboardOverlaySceneHandle, KeyboardOverlaySceneProps>(
  ({ className, onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetAzimuthRef = useRef(BASE_AZIMUTH_DEG);

    useImperativeHandle(ref, () => ({
      setAzimuthPointer(normalizedX: number) {
        const clamped = Math.max(-1, Math.min(1, normalizedX));
        targetAzimuthRef.current = BASE_AZIMUTH_DEG + clamped * AZIMUTH_RANGE_DEG;
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
      configureKeyboardRenderer(renderer);
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const environment = createKeyboardEnvironment(renderer);
      scene.environment = environment;
      scene.environmentIntensity = 0.5;

      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);

      const model = createKeyboardModel({});
      scene.add(model);

      const lights = createKeyboardLookDevLights();
      scene.add(lights);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const halfSize = size.clone().multiplyScalar(0.5);

      const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
      let currentAzimuthDeg = BASE_AZIMUTH_DEG;

      // Project the bounding box onto the camera's own right/up/forward axes (not just
      // world size.x/y/z) so an object that isn't axis-aligned to the view still gets an
      // accurate on-screen half-width/height -- same technique as frameKeyboardCamera().
      const azimuthRad0 = (BASE_AZIMUTH_DEG * Math.PI) / 180;
      const dir0 = new THREE.Vector3(
        Math.sin(azimuthRad0) * Math.cos(elevationRad),
        Math.sin(elevationRad),
        Math.cos(azimuthRad0) * Math.cos(elevationRad),
      );
      const up0 = new THREE.Vector3(0, 1, 0);
      const right0 = new THREE.Vector3().crossVectors(dir0, up0).normalize();
      const screenUp0 = new THREE.Vector3().crossVectors(right0, dir0).normalize();
      const halfWidth =
        Math.abs(right0.x) * halfSize.x + Math.abs(right0.y) * halfSize.y + Math.abs(right0.z) * halfSize.z;
      const halfHeight =
        Math.abs(screenUp0.x) * halfSize.x + Math.abs(screenUp0.y) * halfSize.y + Math.abs(screenUp0.z) * halfSize.z;
      const halfDepth =
        Math.abs(dir0.x) * halfSize.x + Math.abs(dir0.y) * halfSize.y + Math.abs(dir0.z) * halfSize.z;
      const maxHalfExtent = Math.max(halfWidth, halfHeight) * CAMERA_MARGIN;

      const selfFitDistance = maxHalfExtent / Math.tan((camera.fov * Math.PI) / 180 / 2);
      const distance = selfFitDistance * FLATTEN_FACTOR;
      camera.fov = (2 * Math.atan(maxHalfExtent / distance) * 180) / Math.PI;
      camera.near = Math.max(0.01, distance - halfDepth * 2);
      camera.far = distance + halfDepth * 4;
      camera.updateProjectionMatrix();

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
        container.removeChild(renderer.domElement);
        renderer.dispose();
        // environment is built fresh per mount (see createKeyboardModel.ts) and must be
        // disposed here. The model itself is NOT cached either (its keys carry live
        // press-animation state on the /keyboard page), so it must still be disposed.
        environment.dispose();
        model.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => material.dispose());
          }
        });
      };
    }, [onReady]);

    return <div ref={containerRef} className={className} />;
  },
);

KeyboardOverlayScene.displayName = 'KeyboardOverlayScene';
