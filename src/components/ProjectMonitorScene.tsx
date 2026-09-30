import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  configureCurvedAllInOneMonitorRenderer,
  createCurvedAllInOneMonitorEnvironment,
  createCurvedAllInOneMonitorLookDevLights,
  createCurvedAllInOneMonitorModel,
} from '../models/createCurvedMonitorModel';
import { createCurvedBirchPlyDeskSetupModel, type ProceduralModelRuntime } from '../models/createDeskSetupModel';

const DESK_MONITOR_SCALE = 0.48;
const DESK_MONITOR_POSITION = new THREE.Vector3(0, 0.8697, 0.19);

export type MonitorScreenBounds = { left: number; top: number; width: number; height: number };

type Props = {
  className?: string;
  backgroundMid: string;
  backgroundEnd: string;
  onScreenBounds: (bounds: MonitorScreenBounds) => void;
};

function paintScreen(canvas: HTMLCanvasElement, mid: string, end: string) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.globalAlpha = 1;
  context.fillStyle = '#fbfdfb';
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(251, 253, 251, 0)');
  gradient.addColorStop(0.5, mid);
  gradient.addColorStop(1, end);
  context.globalAlpha = 0.6;
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
}

export function ProjectMonitorScene({ className, backgroundMid, backgroundEnd, onScreenBounds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef({ mid: backgroundMid, end: backgroundEnd });
  const runtimeRef = useRef<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; render: () => void } | null>(null);
  colorsRef.current = { mid: backgroundMid, end: backgroundEnd };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    configureCurvedAllInOneMonitorRenderer(renderer);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createCurvedAllInOneMonitorEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 0.5;

    // The desk scene owns the cached instance, so clone its object tree before placing it
    // on this page. Shared geometry/materials stay cached; this page only owns the lit screen.
    const model = createCurvedAllInOneMonitorModel({}).clone(true);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.setScalar(1);
    // The desk page's slideshow surface lives on the same cached monitor while that page is
    // mounted; this page paints its own screen.
    model.getObjectByName('screenImage')?.removeFromParent();
    model.updateMatrixWorld(true);
    // Reuse the glass riser and its supports from the desk model. Their original
    // positions are converted into the monitor's local scale and position.
    const desk = createCurvedBirchPlyDeskSetupModel({});
    const deskRuntime = desk.userData.sculptRuntime as ProceduralModelRuntime | undefined;
    const riser = new THREE.Group();
    for (const part of deskRuntime?.destructionGroups.glassRiser ?? []) {
      const copy = part.clone(true);
      copy.position.sub(DESK_MONITOR_POSITION).divideScalar(DESK_MONITOR_SCALE);
      copy.scale.divideScalar(DESK_MONITOR_SCALE);
      riser.add(copy);
    }
    // Seen straight-on here, the stand's rounded leg tips read as its bottom edge, and they
    // sit ~0.013 (monitor widths) above the glass even though the leg bodies touch it -- a
    // visible gap. Close it on this page only (the desk page is untouched): raise the riser
    // until the glass top meets the lowest tip cap. The camera frames the monitor, so this
    // looks exactly like lowering the monitor onto the glass.
    riser.updateMatrixWorld(true);
    const glassShelf = deskRuntime?.meshes.glassPlatform
      ? riser.children.find((child) => child.name === deskRuntime.meshes.glassPlatform.parent?.name)
      : undefined;
    let tipCapsBottom = Infinity;
    model.traverse((node) => {
      if (node instanceof THREE.Mesh && node.geometry.type === 'SphereGeometry' && node.name !== 'standHub') {
        tipCapsBottom = Math.min(tipCapsBottom, new THREE.Box3().setFromObject(node).min.y);
      }
    });
    if (glassShelf && Number.isFinite(tipCapsBottom)) {
      const glassTop = new THREE.Box3().setFromObject(glassShelf).max.y;
      if (tipCapsBottom > glassTop) riser.position.y += tipCapsBottom - glassTop;
    }
    scene.add(model, riser);
    const lights = createCurvedAllInOneMonitorLookDevLights();
    scene.add(lights);

    const screenGlass = model.getObjectByName('screenGlass');
    if (!screenGlass) {
      container.removeChild(renderer.domElement);
      renderer.dispose();
      environment.dispose();
      return;
    }
    const glassBounds = new THREE.Box3().setFromObject(screenGlass);
    const glassSize = glassBounds.getSize(new THREE.Vector3());
    const glassCenter = glassBounds.getCenter(new THREE.Vector3());
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 320;
    paintScreen(gradientCanvas, colorsRef.current.mid, colorsRef.current.end);
    const texture = new THREE.CanvasTexture(gradientCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(glassSize.x, glassSize.y),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    screenSurface.position.set(glassCenter.x, glassCenter.y, glassBounds.max.z + 0.002);
    model.add(screenSurface);

    // Frame the monitor itself so the original riser supports can continue below the viewport.
    const modelBounds = new THREE.Box3().setFromObject(model);
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
    camera.position.set(modelCenter.x, modelCenter.y, modelCenter.z + 3);
    camera.lookAt(modelCenter);

    const render = () => renderer.render(scene, camera);
    runtimeRef.current = { canvas: gradientCanvas, texture, render };
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      if (!width || !height) return;
      renderer.setSize(width, height);
      const aspect = width / height;
      const viewHeight = Math.max(modelSize.y * 1.07, 0.91, modelSize.x * 1.08 / aspect);
      // Keep the monitor near the top while the full-size riser continues below it.
      const cameraCenterY = modelBounds.max.y - viewHeight / 2 + viewHeight * 0.01;
      camera.position.y = cameraCenterY;
      camera.lookAt(modelCenter.x, cameraCenterY, modelCenter.z);
      camera.left = -(viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      const lowerLeft = new THREE.Vector3(glassBounds.min.x, glassBounds.min.y, screenSurface.position.z).project(camera);
      const upperRight = new THREE.Vector3(glassBounds.max.x, glassBounds.max.y, screenSurface.position.z).project(camera);
      onScreenBounds({
        left: (lowerLeft.x + 1) * width / 2,
        top: (1 - upperRight.y) * height / 2,
        width: (upperRight.x - lowerLeft.x) * width / 2,
        height: (upperRight.y - lowerLeft.y) * height / 2,
      });
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    return () => {
      resizeObserver.disconnect();
      runtimeRef.current = null;
      screenSurface.geometry.dispose();
      (screenSurface.material as THREE.Material).dispose();
      texture.dispose();
      environment.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [onScreenBounds]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    paintScreen(runtime.canvas, backgroundMid, backgroundEnd);
    runtime.texture.needsUpdate = true;
    runtime.render();
  }, [backgroundMid, backgroundEnd]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
