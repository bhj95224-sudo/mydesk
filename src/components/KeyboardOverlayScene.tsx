import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createKeyboardModel,
  createKeyboardLookDevLights,
  frameKeyboardCamera,
  configureKeyboardRenderer,
  createKeyboardEnvironment,
} from '../models/createKeyboardModel';

type KeyboardOverlaySceneProps = {
  className?: string;
  onReady?: () => void;
};

const AZIMUTH_DEG = 22;
const ELEVATION_DEG = 34;
const CAMERA_MARGIN = 1.07;

export function KeyboardOverlayScene({ className, onReady }: KeyboardOverlaySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);

    const model = createKeyboardModel({});
    scene.add(model);

    const lights = createKeyboardLookDevLights();
    scene.add(lights);

    frameKeyboardCamera(camera, model, {
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
