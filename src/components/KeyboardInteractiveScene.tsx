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
};

const AZIMUTH_DEG = 0;
const ELEVATION_DEG = 89.5;
const CAMERA_MARGIN = 1.08;

export function KeyboardInteractiveScene({ className }: KeyboardInteractiveSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    configureKeyboardRenderer(renderer);
    renderer.domElement.setAttribute('aria-label', '클릭할 수 있는 3D 키보드');
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createKeyboardEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    const model = createKeyboardModel({});
    scene.add(model);
    scene.add(createKeyboardLookDevLights());

    const interactions = attachKeyboardInteractions(renderer, camera, model);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      frameKeyboardCamera(camera, model, {
        azimuthDeg: AZIMUTH_DEG,
        elevationDeg: ELEVATION_DEG,
        margin: CAMERA_MARGIN,
      });
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId = 0;
    const render = (now: number) => {
      interactions(now);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
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
  }, []);

  return <div ref={containerRef} className={className} />;
}
