import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LatticeLoader } from '../components/LatticeLoader';

// One character appears every TYPE_STEP_MS; once the whole line is written it stays for
// REPEAT_PAUSE_MS, then clears and types again -- looping for as long as loading lasts.
const TYPE_STEP_MS = 120;
const REPEAT_PAUSE_MS = 2000;
// The screen only leaves once the line is fully written and has been readable this long.
const HOLD_AFTER_TYPING_MS = 1700;

// Loading-screen copy for each transition (App/pages pass the matching one).
export const LOADING_TEXT = {
  desk: '내 방으로 가는 중...',
  projects: '컴퓨터 켜는 중...',
  keyboard: '타자 치는 중...',
  tablet: '그림 그리는 중...',
  backFromProjects: '컴퓨터 끄는 중...',
  backFromKeyboard: '손가락 쉬는 중...',
  backFromTablet: '손목 스트레칭 중...',
} as const;

type IntroPageProps = {
  ready: boolean;
  onFinish: () => void;
  text?: string;
  // Fade the screen in instead of it being there from the first paint -- for loaders that
  // appear mid-session (returning to the desk), where popping in would flash.
  fadeIn?: boolean;
};

export function IntroPage({
  ready,
  onFinish,
  text = LOADING_TEXT.desk,
  fadeIn = false,
}: IntroPageProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const leavingTriggered = useRef(false);

  const startLeaving = useCallback(() => {
    if (leavingTriggered.current) return;
    leavingTriggered.current = true;
    setIsLeaving(true);
  }, []);

  return (
    <main
      className={`intro-page page-shell${fadeIn ? ' is-fading-in' : ''}${isLeaving ? ' is-leaving' : ''}`}
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
        <CssTypingLine text={text} ready={ready} onReadyToLeave={startLeaving} />
      </div>
    </main>
  );
}

type TypingLineProps = { text: string; ready: boolean; onReadyToLeave: () => void };

// The typing is a pure CSS opacity animation per character (not JS timers): the desk page
// builds its 3D scene synchronously while this screen is up, which blocks the main thread
// and froze timer-driven typing after the first character. Opacity animations run on the
// compositor, so the line keeps typing through that.
function buildTypingKeyframes(charCount: number, cycleMs: number): string {
  return Array.from({ length: charCount }, (_, index) => {
    const appearAt = (((index + 1) * TYPE_STEP_MS) / cycleMs) * 100;
    return `@keyframes introChar-${charCount}-${index} { 0%, ${appearAt.toFixed(3)}% { opacity: 0; } ${(appearAt + 0.01).toFixed(3)}%, 100% { opacity: 1; } }`;
  }).join('\n');
}

const CURSOR_GAP_PX = 4;

// Cursor follows the text the same way: a stepped translateX (also compositor-run) that
// jumps to the end of each character at the moment that character appears.
function buildCursorKeyframes(name: string, charEnds: number[], cycleMs: number): string {
  const steps = ['0% { transform: translateX(0px); }'];
  let previous = 0;
  charEnds.forEach((end, index) => {
    const at = (((index + 1) * TYPE_STEP_MS) / cycleMs) * 100;
    const x = end + CURSOR_GAP_PX;
    steps.push(`${at.toFixed(3)}% { transform: translateX(${previous}px); }`);
    steps.push(`${(at + 0.01).toFixed(3)}% { transform: translateX(${x}px); }`);
    previous = x;
  });
  steps.push(`100% { transform: translateX(${previous}px); }`);
  return `@keyframes ${name} { ${steps.join(' ')} }`;
}

function CssTypingLine({ text, ready, onReadyToLeave }: TypingLineProps) {
  const firstCharRef = useRef<HTMLSpanElement>(null);
  const charsRef = useRef<HTMLSpanElement>(null);
  const chars = useMemo(() => Array.from(text), [text]);
  const typingMs = (chars.length + 1) * TYPE_STEP_MS;
  const cycleMs = typingMs + REPEAT_PAUSE_MS;
  const keyframes = useMemo(() => buildTypingKeyframes(chars.length, cycleMs), [chars.length, cycleMs]);
  const cursorName = `introCursor-${chars.length}`;
  const [charEnds, setCharEnds] = useState<number[] | null>(null);

  // Measure where each character ends (before the first paint, so the cursor animation
  // starts in the same frame as the character animations). Re-measure once web fonts have
  // loaded, since a font swap changes the widths; the keyframes keep their name, so the
  // running animation just picks up the new positions.
  useLayoutEffect(() => {
    const measure = () => {
      const container = charsRef.current;
      if (!container) return;
      const ends = Array.from(container.children, (child) => {
        const element = child as HTMLElement;
        return element.offsetLeft + element.offsetWidth;
      });
      setCharEnds(ends);
    };
    measure();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [chars]);

  const cursorKeyframes = useMemo(
    () => (charEnds ? buildCursorKeyframes(cursorName, charEnds, cycleMs) : ''),
    [charEnds, cursorName, cycleMs],
  );

  // Once loading is done, leave at the next moment the line is fully written and has been
  // up for HOLD_AFTER_TYPING_MS -- read off the CSS animation's own clock so it lines up
  // with what's on screen.
  useEffect(() => {
    if (!ready) return undefined;
    let timer = 0;
    const check = () => {
      const time = firstCharRef.current?.getAnimations()[0]?.currentTime;
      if (typeof time !== 'number') {
        onReadyToLeave(); // no animation (reduced motion): the text is shown whole already
        return;
      }
      const phase = time % cycleMs;
      const leaveFrom = typingMs + HOLD_AFTER_TYPING_MS;
      if (phase >= leaveFrom) onReadyToLeave();
      else timer = window.setTimeout(check, leaveFrom - phase);
    };
    check();
    return () => window.clearTimeout(timer);
  }, [cycleMs, onReadyToLeave, ready, typingMs]);

  return (
    <div className="intro-text intro-text--css" aria-label={text}>
      <style>{`${keyframes}\n${cursorKeyframes}`}</style>
      <span ref={charsRef} aria-hidden="true">
        {chars.map((char, index) => (
          <span
            key={index}
            ref={index === 0 ? firstCharRef : undefined}
            className="intro-text__char"
            style={{ animationName: `introChar-${chars.length}-${index}`, animationDuration: `${cycleMs}ms` }}
          >
            {char}
          </span>
        ))}
      </span>
      {/* Outer span moves (cursor keyframes), inner span blinks. Hidden until measured. */}
      {charEnds && (
        <span
          className="intro-text__cursor-track"
          aria-hidden="true"
          style={{ animationName: cursorName, animationDuration: `${cycleMs}ms` }}
        >
          <span className="intro-text__cursor">|</span>
        </span>
      )}
    </div>
  );
}
