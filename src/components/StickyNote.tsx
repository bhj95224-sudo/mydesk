import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';

export type Position = { x: number; y: number };

export type StickyNoteHandle = { getRect: () => DOMRect | null };

type StickyNoteProps = {
  accent: string;
  ariaLabel: string;
  className?: string;
  getInitialPosition: (element: HTMLElement) => Position;
  onClose: () => void;
  onPlus?: () => void;
  children: ReactNode;
};

const SCREEN_MARGIN = 18;

// Direct 1:1 pointer-tracked drag (setPointerCapture + delta from the header's own
// pointerdown/move) -- no eased/lagged follow, matching ProjectSlidesWindow's drag.
export const StickyNote = forwardRef<StickyNoteHandle, StickyNoteProps>(function StickyNote({
  accent,
  ariaLabel,
  className = '',
  getInitialPosition,
  onClose,
  onPlus,
  children,
}, ref) {
  const noteRef = useRef<HTMLElement>(null);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    getRect: () => noteRef.current?.getBoundingClientRect() ?? null,
  }));

  const clampPosition = (next: Position): Position => {
    const element = noteRef.current;
    if (!element) return next;
    return {
      x: Math.min(Math.max(SCREEN_MARGIN, next.x), Math.max(SCREEN_MARGIN, window.innerWidth - element.offsetWidth - SCREEN_MARGIN)),
      y: Math.min(Math.max(SCREEN_MARGIN, next.y), Math.max(SCREEN_MARGIN, window.innerHeight - element.offsetHeight - SCREEN_MARGIN)),
    };
  };

  const moveTo = (next: Position) => {
    const clamped = clampPosition(next);
    positionRef.current = clamped;
    setPosition(clamped);
  };

  useLayoutEffect(() => {
    const element = noteRef.current;
    if (!element) return;
    moveTo(getInitialPosition(element));

    const handleResize = () => moveTo(positionRef.current);
    const observer = new ResizeObserver(handleResize);
    observer.observe(element);
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
    // Initial position/clamping only -- intentionally not re-running on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ...positionRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveTo({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 10;
    moveTo({ x: positionRef.current.x + delta.x * step, y: positionRef.current.y + delta.y * step });
  };

  return (
    <section
      ref={noteRef}
      className={`sticky-note ${className}${dragging ? ' is-dragging' : ''}`}
      role="dialog"
      aria-label={ariaLabel}
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? 'visible' : 'hidden',
        '--sticky-accent': accent,
      } as CSSProperties}
    >
      <div
        className="sticky-note__header"
        tabIndex={0}
        aria-label={`${ariaLabel} 창 이동: 마우스로 끌거나 방향키로 이동`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
        onKeyDown={handleHeaderKeyDown}
      >
        <button
          type="button"
          className="sticky-note__icon-btn sticky-note__plus"
          disabled={!onPlus}
          onClick={onPlus}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="새 메모"
        >
          +
        </button>
        <div className="sticky-note__header-spacer" />
        <button
          type="button"
          className="sticky-note__icon-btn"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={(event) => event.stopPropagation()}
        >
          ···
        </button>
        <button
          type="button"
          className="sticky-note__icon-btn sticky-note__close"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="sticky-note__body">{children}</div>

      <footer className="sticky-note__toolbar" aria-hidden="true">
        <span className="sticky-note__tool sticky-note__tool--bold">B</span>
        <span className="sticky-note__tool sticky-note__tool--italic">I</span>
        <span className="sticky-note__tool sticky-note__tool--underline">U</span>
        <span className="sticky-note__tool sticky-note__tool--strike">ab</span>
        <svg className="sticky-note__tool" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="2.5" cy="4" r="1.4" fill="currentColor" />
          <circle cx="2.5" cy="9" r="1.4" fill="currentColor" />
          <circle cx="2.5" cy="14" r="1.4" fill="currentColor" />
          <path d="M6.5 4H15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M6.5 9H15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M6.5 14H15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <svg className="sticky-note__tool" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1.5" y="2.5" width="15" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6" cy="7" r="1.3" fill="currentColor" />
          <path d="M2.5 13.5L6.5 9.5L9.5 12L12.5 8.5L15.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </footer>
    </section>
  );
});
