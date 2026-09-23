import { useRef, useState } from 'react';
import { LatticeLoader } from '../components/LatticeLoader';
import { TextType } from '../components/TextType';

const HOLD_AFTER_TYPING_MS = 1700;

export function IntroPage({ onFinish }: { onFinish: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const leavingTriggered = useRef(false);

  const startLeaving = () => {
    if (leavingTriggered.current) return;
    leavingTriggered.current = true;
    setIsLeaving(true);
  };

  return (
    <main
      className={`intro-page page-shell${isLeaving ? ' is-leaving' : ''}`}
      onAnimationEnd={(event) => {
        if (isLeaving && event.target === event.currentTarget) {
          onFinish();
        }
      }}
    >
      <div className="intro-tint" aria-hidden="true" />
      <div className="intro-content">
        <LatticeLoader pattern="orbit" grid={3} shape="round" step={140} showTimer={false} label="" color="#736ea2" />
        <TextType
          text="Loading..."
          typingSpeed={120}
          cursorCharacter="|"
          pauseDuration={HOLD_AFTER_TYPING_MS}
          loop={false}
          showCursor
          className="intro-text"
          onSentenceComplete={() => {
            window.setTimeout(startLeaving, HOLD_AFTER_TYPING_MS);
          }}
        />
      </div>
    </main>
  );
}
