import * as THREE from 'three';
import { type PressableKey } from './createKeyboardModel';

const PRESS_MS = 70;
const HOLD_MS = 50;
const RELEASE_MS = 120;
const HOVER_EMISSIVE = 0x2a2a26;
// Plain (non-skill) keys react to the pointer only a little.
const SOFT_HOVER_EMISSIVE = 0x121210;

type KeyState = 'idle' | 'pressing' | 'holding' | 'releasing';

interface KeyAnim {
  group: PressableKey;
  state: KeyState;
  phaseStart: number;
}

export type UpdateFn = ((now: number) => void) & {
  dispose: () => void;
  // Plays the press motion on a random idle pressable key -- motion only, no onKeyPress.
  pressRandomKey: () => void;
  // Plays the press motion on the pressable key with this label (e.g. from a physical key
  // press) -- motion only, no onKeyPress. No-op for keys that aren't pressable.
  pressKey: (letter: string) => void;
  // Plays the press motion for a physical KeyboardEvent.code (any key: letters, digits,
  // space, modifiers, punctuation, F-keys) -- motion only, no onKeyPress.
  pressCode: (code: string) => void;
};

// KeyboardEvent.code -> the model key's label (and which one of a left/right pair).
const CODE_LABELS: Record<string, { label: string; side?: 'left' | 'right' }> = {
  Space: { label: '' },
  Enter: { label: 'Enter' },
  NumpadEnter: { label: 'Enter' },
  Backspace: { label: 'Backspace' },
  Tab: { label: 'Tab' },
  CapsLock: { label: 'Caps' },
  Escape: { label: 'Esc' },
  ContextMenu: { label: 'Menu' },
  ShiftLeft: { label: 'Shift', side: 'left' },
  ShiftRight: { label: 'Shift', side: 'right' },
  ControlLeft: { label: 'Ctrl', side: 'left' },
  ControlRight: { label: 'Ctrl', side: 'right' },
  AltLeft: { label: 'Alt', side: 'left' },
  AltRight: { label: 'Alt', side: 'right' },
  MetaLeft: { label: 'Win', side: 'left' },
  Backquote: { label: '~' },
  Minus: { label: '-' },
  Equal: { label: '=' },
  BracketLeft: { label: '[' },
  BracketRight: { label: ']' },
  Backslash: { label: '\\' },
  Semicolon: { label: ';' },
  Quote: { label: "'" },
  Comma: { label: ',' },
  Period: { label: '.' },
  Slash: { label: '/' },
};

function labelForCode(code: string): { label: string; side?: 'left' | 'right' } | null {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return { label: code.slice(3) };
  if (/^Digit[0-9]$/.test(code)) return { label: code.slice(5) };
  if (/^F([1-9]|1[0-2])$/.test(code)) return { label: code };
  return null;
}

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
      if (hovered) setEmissive(hovered, hovered.userData.skill ? HOVER_EMISSIVE : SOFT_HOVER_EMISSIVE);
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
    // Plain keys just move; only the skill keys open a card.
    if (!hit.userData.skill) return;
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
      const pressDepth = anim.group.userData.pressDepth;
      if (anim.state === 'pressing') {
        const t = Math.min(1, elapsed / PRESS_MS);
        anim.group.position.y = restY - pressDepth * t;
        if (elapsed >= PRESS_MS) {
          anim.state = 'holding';
          anim.phaseStart = now;
        }
      } else if (anim.state === 'holding') {
        anim.group.position.y = restY - pressDepth;
        if (elapsed >= HOLD_MS) {
          anim.state = 'releasing';
          anim.phaseStart = now;
        }
      } else if (anim.state === 'releasing') {
        const t = Math.min(1, elapsed / RELEASE_MS);
        anim.group.position.y = restY - pressDepth * (1 - t);
        if (elapsed >= RELEASE_MS) {
          anim.state = 'idle';
          anim.group.position.y = restY;
        }
      }
    }
  };

  update.pressKey = (letter: string) => {
    const target = letter.toUpperCase();
    const anim = [...anims.values()].find((candidate) => candidate.group.userData.key.toUpperCase() === target);
    if (!anim) return;
    // Restart even mid-press so a fast repeat still reads as a new keystroke.
    anim.state = 'pressing';
    anim.phaseStart = performance.now();
  };

  update.pressCode = (code: string) => {
    const target = labelForCode(code);
    if (!target) return;
    const matches = [...anims.values()]
      .filter((candidate) => candidate.group.userData.key.toUpperCase() === target.label.toUpperCase())
      .sort((a, b) => a.group.position.x - b.group.position.x);
    if (matches.length === 0) return;
    // Left/right pairs (Shift, Ctrl, Alt) -- the left one is the one with the smaller x.
    const anim = target.side === 'right' ? matches[matches.length - 1] : matches[0];
    anim.state = 'pressing';
    anim.phaseStart = performance.now();
  };

  update.pressRandomKey = () => {
    // The idle typing only plays on the skill keys.
    const idle = [...anims.values()].filter((anim) => anim.state === 'idle' && anim.group.userData.skill);
    if (idle.length === 0) return;
    const anim = idle[Math.floor(Math.random() * idle.length)];
    anim.state = 'pressing';
    anim.phaseStart = performance.now();
  };

  update.dispose = () => {
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    onPointerLeave();
  };

  return update;
}
