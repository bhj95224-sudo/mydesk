import * as THREE from 'three';
import { PRESS_DEPTH, type PressableKey } from './createKeyboardModel';

const PRESS_MS = 70;
const HOLD_MS = 50;
const RELEASE_MS = 120;
const HOVER_EMISSIVE = 0x2a2a26;

type KeyState = 'idle' | 'pressing' | 'holding' | 'releasing';

interface KeyAnim {
  group: PressableKey;
  state: KeyState;
  phaseStart: number;
}

export type UpdateFn = ((now: number) => void) & { dispose: () => void };

export function attachKeyboardInteractions(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  model: THREE.Object3D,
  onKeyPress?: (letter: string) => void,
  onBackgroundClick?: () => void,
): UpdateFn {
  const pressableKeys = (model.userData.pressableKeys as PressableKey[]) ?? [];
  const anims = new Map<PressableKey, KeyAnim>();
  const meshTargets: THREE.Object3D[] = [];
  for (const group of pressableKeys) {
    anims.set(group, { group, state: 'idle', phaseStart: 0 });
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshTargets.push(obj);
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function findPressable(obj: THREE.Object3D | null): PressableKey | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData && cur.userData.pressable === true) return cur as PressableKey;
      cur = cur.parent;
    }
    return null;
  }

  function updatePointerFromEvent(event: PointerEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastPressable(): PressableKey | null {
    raycaster.setFromCamera(pointer, camera as THREE.PerspectiveCamera);
    const hits = raycaster.intersectObjects(meshTargets, false);
    if (hits.length === 0) return null;
    return findPressable(hits[0].object);
  }

  function setEmissive(group: PressableKey, value: number): void {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.emissive) std.emissive.setHex(value);
      }
    });
  }

  let hovered: PressableKey | null = null;

  function onPointerMove(event: PointerEvent): void {
    updatePointerFromEvent(event);
    const hit = raycastPressable();
    if (hit !== hovered) {
      if (hovered) setEmissive(hovered, 0x000000);
      hovered = hit;
      if (hovered) setEmissive(hovered, HOVER_EMISSIVE);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'auto';
    }
  }

  function onPointerDown(event: PointerEvent): void {
    updatePointerFromEvent(event);
    const hit = raycastPressable();
    if (!hit) {
      onBackgroundClick?.();
      return;
    }
    const anim = anims.get(hit);
    if (!anim || anim.state !== 'idle') return;
    anim.state = 'pressing';
    anim.phaseStart = performance.now();
    const letter = hit.userData.key as string;
    onKeyPress?.(letter);
    renderer.domElement.dispatchEvent(
      new CustomEvent('virtual-key-press', { detail: { key: letter } }),
    );
  }

  function onPointerLeave(): void {
    if (hovered) {
      setEmissive(hovered, 0x000000);
      hovered = null;
      renderer.domElement.style.cursor = 'auto';
    }
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  const update = function update(now: number): void {
    for (const anim of anims.values()) {
      if (anim.state === 'idle') continue;
      const elapsed = now - anim.phaseStart;
      const restY = anim.group.userData.restY;
      if (anim.state === 'pressing') {
        const t = Math.min(1, elapsed / PRESS_MS);
        anim.group.position.y = restY - PRESS_DEPTH * t;
        if (elapsed >= PRESS_MS) {
          anim.state = 'holding';
          anim.phaseStart = now;
        }
      } else if (anim.state === 'holding') {
        anim.group.position.y = restY - PRESS_DEPTH;
        if (elapsed >= HOLD_MS) {
          anim.state = 'releasing';
          anim.phaseStart = now;
        }
      } else if (anim.state === 'releasing') {
        const t = Math.min(1, elapsed / RELEASE_MS);
        anim.group.position.y = restY - PRESS_DEPTH * (1 - t);
        if (elapsed >= RELEASE_MS) {
          anim.state = 'idle';
          anim.group.position.y = restY;
        }
      }
    }
  };

  update.dispose = () => {
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    onPointerLeave();
  };

  return update;
}
