import { useCallback, useEffect, useState } from 'react';
import { BackToDeskLink } from '../components/BackToDeskLink';
import { KeyboardInteractiveScene } from '../components/KeyboardInteractiveScene';
import { KeyboardSkillCard } from '../components/KeyboardSkillCard';
import { KEYBOARD_SKILLS, type KeyboardSkillKey } from '../data/keyboardSkills';
import { IntroPage } from './IntroPage';

function isSkillKey(value: string): value is KeyboardSkillKey {
  return Object.prototype.hasOwnProperty.call(KEYBOARD_SKILLS, value)
    && KEYBOARD_SKILLS[value as KeyboardSkillKey].enabled !== false;
}

export function KeyboardPage({ onBackToDesk }: { onBackToDesk: () => void }) {
  const [sceneReady, setSceneReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [activeSkill, setActiveSkill] = useState<KeyboardSkillKey | null>(null);
  // Kept mounted (with its previous skillKey) while the exit animation plays, even after
  // activeSkill has already moved to null -- see KeyboardSkillCard's show/onExited props.
  const [renderedSkill, setRenderedSkill] = useState<KeyboardSkillKey | null>(null);

  useEffect(() => {
    if (activeSkill !== null) setRenderedSkill(activeSkill);
  }, [activeSkill]);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleCardExited = useCallback(() => setRenderedSkill(null), []);
  const handleKeyPress = useCallback((key: string) => {
    const upper = key.toUpperCase();
    if (!isSkillKey(upper)) return;
    setActiveSkill((current) => (current === upper ? null : upper));
  }, []);
  const handleBackgroundClick = useCallback(() => setActiveSkill(null), []);

  useEffect(() => {
    const handlePhysicalKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!event.code.startsWith('Key')) return;
      handleKeyPress(event.code.slice(3));
    };
    window.addEventListener('keydown', handlePhysicalKey);
    return () => window.removeEventListener('keydown', handlePhysicalKey);
  }, [handleKeyPress]);

  useEffect(() => {
    if (!activeSkill) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const canvas = document.querySelector('.keyboard-model-scene canvas');
      const card = document.querySelector('.keyboard-skill-card');
      if (canvas && canvas.contains(target)) return;
      if (card && card.contains(target)) return;
      setActiveSkill(null);
    };
    window.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => window.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [activeSkill]);

  return (
    <>
      <main className="keyboard-page page-shell">
        <header className="browser-header keyboard-header">
          <BackToDeskLink onBackToDesk={onBackToDesk} />
        </header>
        <section className="keyboard-model-stage" aria-label="3D 키보드 체험">
          <KeyboardInteractiveScene
            className="keyboard-model-scene"
            onReady={handleSceneReady}
            onKeyPress={handleKeyPress}
            onBackgroundClick={handleBackgroundClick}
            playCameraIntro={!showLoader}
          />
        </section>
        {renderedSkill && (
          <KeyboardSkillCard
            skillKey={renderedSkill}
            show={activeSkill !== null}
            onExited={handleCardExited}
          />
        )}
      </main>
      {showLoader && <IntroPage ready={sceneReady} onFinish={() => setShowLoader(false)} />}
    </>
  );
}
