import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCurvedBirchPlyDeskSetupModel,
  createCurvedBirchPlyDeskSetupLookDevLights,
  frameCurvedBirchPlyDeskSetupCamera,
  configureCurvedBirchPlyDeskSetupRenderer,
  createCurvedBirchPlyDeskSetupEnvironment,
} from '../models/createDeskSetupModel';

type DeskSetupSceneProps = {
  className?: string;
};

export function DeskSetupScene({ className }: DeskSetupSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    frameCurvedBirchPlyDeskSetupCamera(camera, model, {
      azimuthDeg: 35,
      elevationDeg: 28,
      margin: 1.25,
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
  }, []);

  return <div ref={containerRef} className={className} />;
}
