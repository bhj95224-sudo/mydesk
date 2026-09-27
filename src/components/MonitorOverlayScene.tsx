import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedAllInOneMonitorModel,
  createCurvedAllInOneMonitorLookDevLights,
  frameCurvedAllInOneMonitorCamera,
  configureCurvedAllInOneMonitorRenderer,
  createCurvedAllInOneMonitorEnvironment,
} from '../models/createCurvedMonitorModel';

type MonitorOverlaySceneProps = {
  className?: string;
  onReady?: () => void;
};

const AZIMUTH_DEG = 18;
const ELEVATION_DEG = 3;
const CAMERA_MARGIN = 1.35;

export function MonitorOverlayScene({ className, onReady }: MonitorOverlaySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    configureCurvedAllInOneMonitorRenderer(renderer);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createCurvedAllInOneMonitorEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

    const model = createCurvedAllInOneMonitorModel({});
    scene.add(model);

    const lights = createCurvedAllInOneMonitorLookDevLights();
    scene.add(lights);

    frameCurvedAllInOneMonitorCamera(camera, model, {
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
