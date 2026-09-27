import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedBirchPlyDeskSetupModel,
  createCurvedBirchPlyDeskSetupLookDevLights,
  configureCurvedBirchPlyDeskSetupRenderer,
  createCurvedBirchPlyDeskSetupEnvironment,
} from '../models/createDeskSetupModel';

type DeskSetupSceneProps = {
  className?: string;
};

export type DeskSetupSceneHandle = {
  setAzimuthPointer: (normalizedX: number) => void;
  resetAzimuthPointer: () => void;
};

const BASE_AZIMUTH_DEG = 35;
const AZIMUTH_RANGE_DEG = 6;
const ELEVATION_DEG = 28;
const CAMERA_MARGIN = 1.25;
const AZIMUTH_EASE = 0.08;

export const DeskSetupScene = forwardRef<DeskSetupSceneHandle, DeskSetupSceneProps>(
  ({ className }, ref) => {
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
      configureCurvedBirchPlyDeskSetupRenderer(renderer);
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const environment = createCurvedBirchPlyDeskSetupEnvironment(renderer);
      scene.environment = environment;
      scene.environmentIntensity = 1.0;

      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

      const model = createCurvedBirchPlyDeskSetupModel({});
      scene.add(model);

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
      const tick = () => {
        currentAzimuthDeg += (targetAzimuthRef.current - currentAzimuthDeg) * AZIMUTH_EASE;
        updateCameraPosition();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        container.removeChild(renderer.domElement);
        renderer.dispose();
        environment.dispose();
        model.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => material.dispose());
          }
        });
      };
    }, []);

    return <div ref={containerRef} className={className} />;
  },
);

DeskSetupScene.displayName = 'DeskSetupScene';
