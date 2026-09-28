import { useState } from 'react';
import { KeyboardInteractiveScene } from '../components/KeyboardInteractiveScene';
import { IntroPage } from './IntroPage';

export function KeyboardPage() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  return (
    <>
      <main
        className={`keyboard-page page-shell${isLeaving ? ' is-leaving' : ''}`}
        onAnimationEnd={(event) => {
          if (isLeaving && event.target === event.currentTarget) {
            window.location.hash = '/';
          }
        }}
      >
        <header className="browser-header keyboard-header">
          <a
            className="back-link"
            href="#/"
            aria-label="책상 화면으로 돌아가기"
            onClick={(event) => {
              event.preventDefault();
              if (!isLeaving) setIsLeaving(true);
            }}
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            BACK TO DESK
          </a>
        </header>
        <section className="keyboard-model-stage" aria-label="3D 키보드 체험">
          <KeyboardInteractiveScene className="keyboard-model-scene" onReady={() => setSceneReady(true)} />
        </section>
      </main>
      {showLoader && <IntroPage ready={sceneReady} onFinish={() => setShowLoader(false)} />}
    </>
  );
}
