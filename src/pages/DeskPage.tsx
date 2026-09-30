import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  DeskSetupScene,
  type DeskObjectDestination,
} from '../components/DeskSetupScene';
import { ContactNote } from '../components/ContactNote';
import { BUBBLE_VISIBLE_MS, DeskBubbles, type DeskBubbleId } from '../components/DeskBubbles';
import { DeskStickers } from '../components/DeskStickers';
import { HobbyNote } from '../components/HobbyNote';
import type { Position, StickyNoteHandle } from '../components/StickyNote';

const NOTE_SCREEN_MARGIN = 24;
const NOTE_STACK_OFFSET = 100;

// Picked in #/lab -- see DeskBrightnessLab.tsx.
const DESK_SHADOW_COLOR = '#746363';
const DESK_KEY_LIGHT_POSITION: [number, number, number] = [-2.0, 9.2, 1.0];
const DESK_TINT_COLOR = '#FFFDFA';
const DESK_BRIGHTNESS = 108;
const DESK_SATURATE = 200;
// Picked in #/desk-color -- see DeskColorLab.tsx. Normal-blend paint over the desk plywood.
const DESK_SOLID_COLOR = '#F5BC7A';
const DESK_SOLID_AMOUNT = 1;
const DESK_SOLID_LIGHT_INFLUENCE = 1;

// Positions and sizes follow Figma frame 172:880, normalized from its 3840px-wide canvas.
const DESK_DECOR = [
  { name: 'VS Code 책', src: '/assets/desk-decor/vscode-book.png', x: 15.04, y: 49.7, width: 7.74, rotate: 0 },
  { name: '아이스커피', src: '/assets/desk-decor/iced-coffee.png', x: 29.5, y: 34.1, width: 5.37, rotate: -30.62 },
  { name: '오팔', src: '/assets/desk-decor/opal.png', x: 17.81, y: 23.8, width: 5.42, rotate: -66.25 },
  { name: '피그마 책', src: '/assets/desk-decor/figma-book.png', x: 67.2, y: 33.8, width: 8.0, rotate: 0 },
  { name: '마리모', src: '/assets/desk-decor/marimo.png', x: 82.6, y: 55.5, width: 5.55, rotate: 25.68 },
] as const;

// Decor objects that show a speech bubble when clicked (Figma 232:247, 244:165).
const DECOR_BUBBLES: Partial<Record<(typeof DESK_DECOR)[number]['name'], DeskBubbleId>> = {
  아이스커피: 'coffee',
  오팔: 'opal',
  마리모: 'marimo',
  'VS Code 책': 'vscode-book',
  '피그마 책': 'figma-book',
};

type DeskPageProps = {
  introActive: boolean;
  introComplete: boolean;
  onIntroComplete: () => void;
  onReady?: () => void;
  onProjectNavigationStart?: () => void;
  // Desk color (normal blend); defaults to the picked DESK_SOLID_* values, overridden by
  // DeskColorLab.tsx.
  deskSolidColor?: string;
  deskSolidAmount?: number;
  deskSolidLightInfluence?: number;
};

export function DeskPage({
  introActive,
  introComplete,
  onIntroComplete,
  onReady,
  onProjectNavigationStart,
  deskSolidColor = DESK_SOLID_COLOR,
  deskSolidAmount = DESK_SOLID_AMOUNT,
  deskSolidLightInfluence = DESK_SOLID_LIGHT_INFLUENCE,
}: DeskPageProps) {
  const [destination, setDestination] = useState<DeskObjectDestination | null>(null);
  const destinationRef = useRef<DeskObjectDestination | null>(null);
  const [contactNoteOpen, setContactNoteOpen] = useState(false);
  const [hobbyNoteOpen, setHobbyNoteOpen] = useState(false);
  const contactNoteRef = useRef<StickyNoteHandle>(null);
  const readyNotifiedRef = useRef(false);
  const playDecorIntroRef = useRef(!introComplete);
  const [visibleBubbles, setVisibleBubbles] = useState<Partial<Record<DeskBubbleId, boolean>>>({});
  const bubbleTimersRef = useRef<Partial<Record<DeskBubbleId, number>>>({});

  // Clicking again while a bubble is up restarts its timer instead of stacking another.
  const showBubble = useCallback((id: DeskBubbleId) => {
    window.clearTimeout(bubbleTimersRef.current[id]);
    setVisibleBubbles((current) => ({ ...current, [id]: true }));
    bubbleTimersRef.current[id] = window.setTimeout(() => {
      setVisibleBubbles((current) => ({ ...current, [id]: false }));
    }, BUBBLE_VISIBLE_MS);
  }, []);

  useEffect(() => () => {
    Object.values(bubbleTimersRef.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const handleSceneReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReady?.();
  }, [onReady]);

  const beginNavigation = useCallback((nextDestination: DeskObjectDestination) => {
    if (!introComplete || destinationRef.current) return;
    destinationRef.current = nextDestination;
    setDestination(nextDestination);
    if (nextDestination === '/projects') onProjectNavigationStart?.();
  }, [introComplete, onProjectNavigationStart]);

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
      onAnimationEnd={(event) => {
        if (destination && event.target === event.currentTarget) {
          window.location.hash = destination;
        }
      }}
    >
      <section className="desk-scene" aria-label="책상 화면">
        <div className="desk-image-wrap">
          <DeskSetupScene
            className="desk-image"
            introActive={introActive}
            introComplete={introComplete}
            onReady={handleSceneReady}
            onIntroComplete={onIntroComplete}
            onObjectActivate={beginNavigation}
            onDrawerActivate={handleDrawerActivate}
            drawerFileOut={contactNoteOpen}
            enableShadows
            showShadowFloor
            hideBakedAO
            keyLightPosition={DESK_KEY_LIGHT_POSITION}
            shadowColor={DESK_SHADOW_COLOR}
            enableOrbitControls
            deskTintColor={DESK_TINT_COLOR}
            deskBrightness={DESK_BRIGHTNESS}
            deskSaturate={DESK_SATURATE}
            deskSolidColor={deskSolidColor}
            deskSolidAmount={deskSolidAmount}
            deskSolidLightInfluence={deskSolidLightInfluence}
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
            className={`desk-decor__anchor${DECOR_BUBBLES[name] ? ' desk-decor__anchor--clickable' : ''}`}
            onClick={() => {
              const bubble = DECOR_BUBBLES[name];
              if (bubble) showBubble(bubble);
            }}
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
      <DeskBubbles visible={visibleBubbles} />
      <DeskStickers
        entranceClass={playDecorIntroRef.current ? introComplete ? 'is-revealed' : 'is-waiting' : 'is-ready'}
      />
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
