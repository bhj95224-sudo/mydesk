import { useCallback, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DeskSetupScene,
  type DeskObjectDestination,
  type DeskSetupSceneHandle,
} from '../components/DeskSetupScene';
import { ContactNote } from '../components/ContactNote';
import { HobbyNote } from '../components/HobbyNote';
import type { Position, StickyNoteHandle } from '../components/StickyNote';

const NOTE_SCREEN_MARGIN = 24;
const NOTE_STACK_OFFSET = 100;

const DESK_TILT_DISABLED_QUERY =
  '(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)';

// Positions and sizes follow Figma frame 172:880, normalized from its 3840px-wide canvas.
const DESK_DECOR = [
  { name: 'VS Code 책', src: '/assets/desk-decor/vscode-book.png', x: 31.82, y: 31.44, width: 4.17, rotate: 0 },
  { name: '아이스커피', src: '/assets/desk-decor/iced-coffee.png', x: 37.94, y: 37.21, width: 4.04, rotate: -30.62 },
  { name: '오팔', src: '/assets/desk-decor/opal.png', x: 43.85, y: 26.81, width: 3.06, rotate: -66.25 },
  { name: '피그마 책', src: '/assets/desk-decor/figma-book.png', x: 60.55, y: 31.41, width: 4.17, rotate: 0 },
  { name: '마리모', src: '/assets/desk-decor/marimo.png', x: 63.94, y: 46.69, width: 3.83, rotate: 25.68 },
] as const;

type DeskPageProps = {
  introActive: boolean;
  introComplete: boolean;
  onIntroComplete: () => void;
  onReady?: () => void;
};

export function DeskPage({ introActive, introComplete, onIntroComplete, onReady }: DeskPageProps) {
  const [destination, setDestination] = useState<DeskObjectDestination | null>(null);
  const [contactNoteOpen, setContactNoteOpen] = useState(false);
  const [hobbyNoteOpen, setHobbyNoteOpen] = useState(false);
  const sceneRef = useRef<DeskSetupSceneHandle>(null);
  const contactNoteRef = useRef<StickyNoteHandle>(null);
  const readyNotifiedRef = useRef(false);
  const playDecorIntroRef = useRef(!introComplete);

  const handleSceneReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReady?.();
  }, [onReady]);

  const resetTilt = useCallback(() => {
    sceneRef.current?.resetAzimuthPointer();
  }, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!introComplete) {
      resetTilt();
      return;
    }
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
    if (!introComplete) return;
    resetTilt();
    setDestination((currentDestination) => currentDestination ?? nextDestination);
  }, [introComplete, resetTilt]);

  const startNavigation = (event: MouseEvent<HTMLAnchorElement>, nextDestination: DeskObjectDestination) => {
    event.preventDefault();
    beginNavigation(nextDestination);
  };

  const handleDrawerActivate = useCallback(() => {
    // Only opens -- once the note is up it's a real window (drag it, close it with its own
    // x), so re-clicking the drawer shouldn't make it vanish.
    setContactNoteOpen(true);
  }, []);

  const getContactNoteInitialPosition = useCallback((element: HTMLElement): Position => ({
    x: window.innerWidth - element.offsetWidth - NOTE_SCREEN_MARGIN,
    y: window.innerHeight - element.offsetHeight - NOTE_SCREEN_MARGIN,
  }), []);

  const getHobbyNoteInitialPosition = useCallback((element: HTMLElement): Position => {
    const contactRect = contactNoteRef.current?.getRect();
    if (!contactRect) {
      return {
        x: window.innerWidth - element.offsetWidth - NOTE_SCREEN_MARGIN,
        y: window.innerHeight - element.offsetHeight - NOTE_SCREEN_MARGIN,
      };
    }
    return { x: contactRect.left - NOTE_STACK_OFFSET, y: contactRect.top - NOTE_STACK_OFFSET };
  }, []);

  const handleSpawnHobbyNote = useCallback(() => setHobbyNoteOpen(true), []);

  return (
    <main
      className={`desk-page page-shell${
        introComplete ? ' is-intro-complete' : introActive ? ' is-intro-entering' : ' is-intro-pending'
      }${destination ? ' is-leaving' : ''}`}
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
            introActive={introActive}
            introComplete={introComplete}
            onReady={handleSceneReady}
            onIntroComplete={onIntroComplete}
            onObjectActivate={beginNavigation}
            onDrawerActivate={handleDrawerActivate}
          />
          <a
            className="desk-overlay desk-overlay--tablet"
            href="#/tablet"
            aria-label="태블릿을 열어 태블릿 페이지로 이동"
            tabIndex={introComplete ? undefined : -1}
            onClick={(event) => startNavigation(event, '/tablet')}
          />
          <a
            className="desk-overlay desk-overlay--keyboard"
            href="#/keyboard"
            aria-label="키보드를 열어 키보드 페이지로 이동"
            tabIndex={introComplete ? undefined : -1}
            onClick={(event) => startNavigation(event, '/keyboard')}
          />
          <a
            className="desk-overlay desk-overlay--monitor"
            href="#/projects"
            aria-label="모니터를 열어 프로젝트 브라우저로 이동"
            tabIndex={introComplete ? undefined : -1}
            onClick={(event) => startNavigation(event, '/projects')}
          />
        </div>
      </section>
      <div
        className={`desk-decor ${playDecorIntroRef.current ? introComplete ? 'is-revealed' : 'is-waiting' : 'is-ready'}`}
        aria-hidden="true"
      >
        {DESK_DECOR.map(({ name, src, x, y, width, rotate }, index) => (
          <div
            key={src}
            className="desk-decor__anchor"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
              '--decor-float-delay': `${index * 0.28}s`,
              '--decor-float-duration': `${5.4 + (index % 4) * 0.7}s`,
              '--decor-float-x': `${(2 + (index % 3)) * (index % 2 === 0 ? 1 : -1)}px`,
              '--decor-float-x-back': `${(2 + (index % 3)) * (index % 2 === 0 ? -0.35 : 0.35)}px`,
              '--decor-float-y-up': `${-(4 + (index % 2) * 2)}px`,
              '--decor-float-y-back': `${(4 + (index % 2) * 2) * 0.4}px`,
            } as CSSProperties}
          >
            <div className="desk-decor__entrance">
              <div className="desk-decor__float">
                <img className="desk-decor__item" src={src} alt="" aria-label={name} draggable={false} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {contactNoteOpen && (
        <ContactNote
          ref={contactNoteRef}
          getInitialPosition={getContactNoteInitialPosition}
          onClose={() => setContactNoteOpen(false)}
          onPlus={hobbyNoteOpen ? undefined : handleSpawnHobbyNote}
        />
      )}
      {hobbyNoteOpen && (
        <HobbyNote
          getInitialPosition={getHobbyNoteInitialPosition}
          onClose={() => setHobbyNoteOpen(false)}
        />
      )}
    </main>
  );
}
