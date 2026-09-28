import { useCallback, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DeskSetupScene,
  type DeskObjectDestination,
  type DeskSetupSceneHandle,
} from '../components/DeskSetupScene';

const DESK_TILT_DISABLED_QUERY =
  '(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)';

export function DeskPage({ onReady }: { onReady?: () => void }) {
  const [destination, setDestination] = useState<DeskObjectDestination | null>(null);
  const sceneRef = useRef<DeskSetupSceneHandle>(null);
  const readyNotifiedRef = useRef(false);

  const handleSceneReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReady?.();
  }, [onReady]);

  const resetTilt = useCallback(() => {
    sceneRef.current?.resetAzimuthPointer();
  }, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.pointerType === 'touch' ||
      window.matchMedia(DESK_TILT_DISABLED_QUERY).matches
    ) {
      resetTilt();
      return;
    }

    const normalizedX = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
    sceneRef.current?.setAzimuthPointer(normalizedX);
  };

  const beginNavigation = useCallback((nextDestination: DeskObjectDestination) => {
    resetTilt();
    setDestination((currentDestination) => currentDestination ?? nextDestination);
  }, [resetTilt]);

  const startNavigation = (event: MouseEvent<HTMLAnchorElement>, nextDestination: DeskObjectDestination) => {
    event.preventDefault();
    beginNavigation(nextDestination);
  };

  return (
    <main
      className={`desk-page page-shell${destination ? ' is-leaving' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onAnimationEnd={(event) => {
        if (destination && event.target === event.currentTarget) {
          window.location.hash = destination;
        }
      }}
    >
      <section className="desk-scene" aria-label="책상 화면">
        <div className="desk-image-wrap">
          <DeskSetupScene
            ref={sceneRef}
            className="desk-image"
            onReady={handleSceneReady}
            onObjectActivate={beginNavigation}
          />
          <a
            className="desk-overlay desk-overlay--tablet"
            href="#/tablet"
            aria-label="태블릿을 열어 태블릿 페이지로 이동"
            onClick={(event) => startNavigation(event, '/tablet')}
          />
          <a
            className="desk-overlay desk-overlay--keyboard"
            href="#/keyboard"
            aria-label="키보드를 열어 키보드 페이지로 이동"
            onClick={(event) => startNavigation(event, '/keyboard')}
          />
          <a
            className="desk-overlay desk-overlay--monitor"
            href="#/projects"
            aria-label="모니터를 열어 프로젝트 브라우저로 이동"
            onClick={(event) => startNavigation(event, '/projects')}
          />
        </div>
      </section>
    </main>
  );
}
