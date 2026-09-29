import { useEffect, useRef, useState } from 'react';

// Matches the arrowDepart duration on .back-link.is-departing in global.css.
const ARROW_DEPART_MS = 500;

// "BACK TO DESK" pill shared by the project/keyboard/tablet pages. Clicking plays the
// arrow's departure animation first and only navigates once it has finished.
export function BackToDeskLink({ onBackToDesk }: { onBackToDesk: () => void }) {
  const [departing, setDeparting] = useState(false);
  const navigatedRef = useRef(false);
  const fallbackTimerRef = useRef(0);

  const finish = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    window.clearTimeout(fallbackTimerRef.current);
    onBackToDesk();
  };

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), []);

  return (
    <a
      className={`back-link${departing ? ' is-departing' : ''}`}
      href="#/"
      aria-label="책상 화면으로 돌아가기"
      onClick={(event) => {
        event.preventDefault();
        if (departing) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          finish();
          return;
        }
        setDeparting(true);
        // animationend can be skipped (e.g. a backgrounded tab pauses CSS animations), so
        // don't let navigation depend on it alone.
        fallbackTimerRef.current = window.setTimeout(finish, ARROW_DEPART_MS + 150);
      }}
    >
      <img
        className="back-arrow"
        src="/assets/arrow-back.svg"
        alt=""
        aria-hidden="true"
        onAnimationEnd={(event) => {
          if (event.animationName === 'arrowDepart') finish();
        }}
      />
      BACK TO DESK
    </a>
  );
}
