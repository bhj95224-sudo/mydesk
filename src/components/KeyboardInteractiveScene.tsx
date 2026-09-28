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
  onKeyPress?: (key: string) => void;
  onBackgroundClick?: () => void;
};

// Fixed rule: the keyboard is always shot top-down. Any framing adjustment (like the
// left-pan below) must only translate the camera position and its lookAt target together --
// azimuth/elevation must never change.
const AZIMUTH_DEG = 0;
const ELEVATION_DEG = 89.5;
const CAMERA_MARGIN = 1.04;
// Plain parallel pan (not a re-zoom): after framing the full (nav-cluster-less) keyboard
// normally, shift the camera position and its lookAt target together along world +X by this
// many local units, keeping distance/angle identical. Positive X is away from Esc (see
// colToX in createKeyboardModel.ts), so this pushes Esc past the container's left edge
// without changing how big any key looks. Tuned visually against the actual
// `.keyboard-model-stage` box; some clipping into the next key is acceptable.
const PAN_X = 13.5;

export function KeyboardInteractiveScene({ className, onReady, onKeyPress, onBackgroundClick }: KeyboardInteractiveSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    configureKeyboardRenderer(renderer);
    renderer.domElement.setAttribute('aria-label', '클릭할 수 있는 3D 키보드. 색이 칠해진 키를 누르면 관련 활용 정보가 표시됩니다.');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createKeyboardEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    const model = createKeyboardModel({ includeNavCluster: false, highlightPressableKeys: true });
    scene.add(model);
    scene.add(createKeyboardLookDevLights());

    const interactions = attachKeyboardInteractions(renderer, camera, model, onKeyPress, onBackgroundClick);

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

      // Parallel pan: translate the camera and its lookAt target together by the same
      // vector, so the viewing angle (top-down) is untouched -- only the framed window
      // slides sideways, exactly like panning the container itself.
      const panOffset = new THREE.Vector3(PAN_X, 0, 0);
      camera.position.add(panOffset);
      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      camera.lookAt(center.add(panOffset));
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
  }, [onReady, onKeyPress, onBackgroundClick]);

  return <div ref={containerRef} className={className} />;
}
