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
};

const AZIMUTH_DEG = 0;
const ELEVATION_DEG = 89.5;
const CAMERA_MARGIN = 1.04;
// Esc's left edge sits at local x = -46.25 (see colToX(0,1) in createKeyboardModel.ts);
// F1's left edge sits at x = -36.0 (colToX(2,1) minus half its keycap width). Framing from
// this x instead of the model's true left edge crops Esc and the gap before F1 out of view,
// while the right edge stays at the model's own true bound -- so nothing on the right side
// gets pushed out of frame the way a plain post-hoc pan would (panning a frame that's
// already tight-fit to the whole keyboard just shifts the clipping from one side to the
// other; it doesn't add room).
const VISIBLE_LEFT_X = -41.0;

export function KeyboardInteractiveScene({ className, onReady }: KeyboardInteractiveSceneProps) {
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

      // Frame against a box that starts at F1's left edge instead of the model's true left
      // edge (Esc) -- see VISIBLE_LEFT_X above. This proxy mesh is never added to the scene;
      // it exists only so frameKeyboardCamera can read its geometry bounds.
      const fullBox = new THREE.Box3().setFromObject(model);
      const cropSize = fullBox.getSize(new THREE.Vector3());
      cropSize.x = fullBox.max.x - VISIBLE_LEFT_X;
      const cropCenter = fullBox.getCenter(new THREE.Vector3());
      cropCenter.x = (VISIBLE_LEFT_X + fullBox.max.x) / 2;
      const cropProxy = new THREE.Mesh(new THREE.BoxGeometry(cropSize.x, cropSize.y, cropSize.z));
      cropProxy.position.copy(cropCenter);
      cropProxy.updateMatrixWorld(true);

      frameKeyboardCamera(camera, cropProxy, {
        azimuthDeg: AZIMUTH_DEG,
        elevationDeg: ELEVATION_DEG,
        margin: CAMERA_MARGIN,
      });
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId = 0;
    let readyNotified = false;
    const render = (now: number) => {
      interactions(now);
      renderer.render(scene, camera);
      if (!readyNotified) {
        readyNotified = true;
        onReady?.();
      }
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
  }, [onReady]);

  return <div ref={containerRef} className={className} />;
}
