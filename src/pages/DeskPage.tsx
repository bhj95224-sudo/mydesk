import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

type DeskDestination = '/keyboard' | '/projects' | '/tablet';

const DESK_TILT_MAX_X = 1;
const DESK_TILT_MAX_Y = 2;
const DESK_TILT_DISABLED_QUERY =
  '(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)';

export function DeskPage() {
  const [destination, setDestination] = useState<DeskDestination | null>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const tiltFrameRef = useRef<number | null>(null);

  const updateTilt = (rotateX: number, rotateY: number) => {
    if (tiltFrameRef.current !== null) {
      cancelAnimationFrame(tiltFrameRef.current);
    }

    tiltFrameRef.current = requestAnimationFrame(() => {
      const desk = deskRef.current;

      if (desk) {
        desk.style.setProperty('--desk-rotate-x', `${rotateX.toFixed(3)}deg`);
        desk.style.setProperty('--desk-rotate-y', `${rotateY.toFixed(3)}deg`);
      }

      tiltFrameRef.current = null;
    });
  };

  const resetTilt = () => {
    updateTilt(0, 0);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.pointerType === 'touch' ||
      window.matchMedia(DESK_TILT_DISABLED_QUERY).matches
    ) {
      resetTilt();
      return;
    }

    const normalizedX = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
    const normalizedY = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));

    updateTilt(
      -normalizedY * DESK_TILT_MAX_X,
      normalizedX * DESK_TILT_MAX_Y,
    );
  };

  useEffect(
    () => () => {
      if (tiltFrameRef.current !== null) {
        cancelAnimationFrame(tiltFrameRef.current);
      }
    },
    [],
  );

  const startNavigation = (event: MouseEvent<HTMLAnchorElement>, nextDestination: DeskDestination) => {
    event.preventDefault();
    resetTilt();

    if (!destination) setDestination(nextDestination);
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
        <div ref={deskRef} className="desk-image-wrap">
          <img className="desk-image" src="/assets/desk.png" alt="키보드와 태블릿, 스피커가 놓인 책상과 의자" />
          <a
            className="desk-overlay desk-overlay--tablet"
            href="#/tablet"
            aria-label="태블릿을 열어 태블릿 페이지로 이동"
            onClick={(event) => startNavigation(event, '/tablet')}
          >
            <img src="/assets/tablet.png" alt="" />
          </a>
          <a
            className="desk-overlay desk-overlay--keyboard"
            href="#/keyboard"
            aria-label="키보드를 열어 키보드 페이지로 이동"
            onClick={(event) => startNavigation(event, '/keyboard')}
          >
            <img src="/assets/keyboard.png" alt="" />
          </a>
          <a
            className="desk-overlay desk-overlay--monitor"
            href="#/projects"
            aria-label="모니터를 열어 프로젝트 브라우저로 이동"
            onClick={(event) => startNavigation(event, '/projects')}
          >
            <img src="/assets/monitor.png" alt="" />
          </a>
        </div>
      </section>
    </main>
  );
}
