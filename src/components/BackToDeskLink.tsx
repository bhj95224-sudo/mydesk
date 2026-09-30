import { useRef } from 'react';

// "BACK TO DESK" pill shared by the project/keyboard/tablet pages. The arrow loops while
// hovered (CSS); a click navigates straight away with no arrow animation.
export function BackToDeskLink({ onBackToDesk }: { onBackToDesk: () => void }) {
  const clickedRef = useRef(false);

  return (
    <a
      className="back-link"
      href="#/"
      aria-label="책상 화면으로 돌아가기"
      onClick={(event) => {
        event.preventDefault();
        if (clickedRef.current) return;
        clickedRef.current = true;
        onBackToDesk();
      }}
    >
      <img className="back-arrow" src="/assets/arrow-back.svg" alt="" aria-hidden="true" />
      BACK TO DESK
    </a>
  );
}
