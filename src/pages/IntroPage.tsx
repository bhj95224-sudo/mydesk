import { useCallback, useEffect, useRef, useState } from 'react';
import { LatticeLoader } from '../components/LatticeLoader';
import { TextType } from '../components/TextType';

const HOLD_AFTER_TYPING_MS = 1700;

export function IntroPage({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [minimumHoldDone, setMinimumHoldDone] = useState(false);
  const leavingTriggered = useRef(false);
  const holdTimerRef = useRef<number | null>(null);

  const startLeaving = useCallback(() => {
    if (leavingTriggered.current) return;
    leavingTriggered.current = true;
    setIsLeaving(true);
  }, []);

  const handleSentenceComplete = useCallback(() => {
    if (holdTimerRef.current !== null) return;
    holdTimerRef.current = window.setTimeout(() => {
      setMinimumHoldDone(true);
    }, HOLD_AFTER_TYPING_MS);
  }, []);

  useEffect(() => {
    if (ready && minimumHoldDone) startLeaving();
  }, [minimumHoldDone, ready, startLeaving]);

  useEffect(() => () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
  }, []);

  return (
    <main
      className={`intro-page page-shell${isLeaving ? ' is-leaving' : ''}`}
      aria-busy={!ready}
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
          onSentenceComplete={handleSentenceComplete}
        />
      </div>
    </main>
  );
}
