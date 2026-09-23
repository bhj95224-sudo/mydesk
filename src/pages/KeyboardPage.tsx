import { useState } from 'react';

export function KeyboardPage() {
  const [isLeaving, setIsLeaving] = useState(false);

  return (
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
    </main>
  );
}
