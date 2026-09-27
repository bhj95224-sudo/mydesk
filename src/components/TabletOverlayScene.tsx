import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createTabletModel,
  createTabletLookDevLights,
  frameTabletCamera,
  configureTabletRenderer,
  createTabletEnvironment,
} from '../models/createTabletModel';

type TabletOverlaySceneProps = {
  className?: string;
  onReady?: () => void;
};

const AZIMUTH_DEG = 35;
const ELEVATION_DEG = 28;
const CAMERA_MARGIN = 1.25;

export function TabletOverlayScene({ className, onReady }: TabletOverlaySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    configureTabletRenderer(renderer);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createTabletEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.6;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);

    const model = createTabletModel({});
    scene.add(model);

    const lights = createTabletLookDevLights();
    scene.add(lights);

    frameTabletCamera(camera, model, {
      azimuthDeg: AZIMUTH_DEG,
      elevationDeg: ELEVATION_DEG,
      margin: CAMERA_MARGIN,
    });

    const render = () => renderer.render(scene, camera);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      render();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    onReady?.();

    return () => {
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
  }, [onReady]);

  return <div ref={containerRef} className={className} />;
}
