import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { Project } from '../data/projects';

type Position = { x: number; y: number };

const PAGE_MARGIN = 18;
const SLIDE_COLORS: Record<Project['theme'], string> = {
  beplain: '#7fde26',
  sulwhasoo: '#fcd3b7',
  hourtention: '#c1b0f2',
  jaduya: '#9bd8fa',
};

export function ProjectSlidesWindow({ project, revealToken }: { project: Project; revealToken: number }) {
  const windowRef = useRef<HTMLElement>(null);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const clampPosition = (next: Position): Position => {
    const element = windowRef.current;
    const page = element?.closest('.browser-page');
    if (!(page instanceof HTMLElement) || !element) return next;

    return {
      x: Math.min(Math.max(PAGE_MARGIN, next.x), Math.max(PAGE_MARGIN, page.clientWidth - element.offsetWidth - PAGE_MARGIN)),
      y: Math.min(Math.max(PAGE_MARGIN, next.y), Math.max(PAGE_MARGIN, page.clientHeight - element.offsetHeight - PAGE_MARGIN)),
    };
  };

  const moveTo = (next: Position) => {
    const clamped = clampPosition(next);
    positionRef.current = clamped;
    setPosition(clamped);
  };

  useLayoutEffect(() => {
    const element = windowRef.current;
    const page = element?.closest('.browser-page');
    if (!(page instanceof HTMLElement) || !element) return;

    moveTo({ x: page.clientWidth * (198 / 1920), y: page.clientHeight * (712 / 1080) });

    const observer = new ResizeObserver(() => moveTo(positionRef.current));
    observer.observe(page);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = windowRef.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const animation = element.animate(
      [
        { opacity: 0, transform: 'translateY(12px) scale(.72)' },
        { opacity: 1, transform: 'translateY(-3px) scale(1.045)', offset: 0.72 },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: 520,
        delay: 400,
        easing: 'cubic-bezier(.2, .85, .3, 1)',
        fill: 'both',
      },
    );

    return () => animation.cancel();
  }, [revealToken]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
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

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveTo({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
  };

  const stopDragging = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
      ref={windowRef}
      className={`project-slides-window${dragging ? ' is-dragging' : ''}`}
      aria-label={`${project.displayName} 기획서 창`}
      style={{
        left: position.x,
        top: position.y,
        '--slides-border': project.borderColor,
        '--slides-background': SLIDE_COLORS[project.theme],
      } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
    >
      <div
        className="project-slides-window__bar"
        tabIndex={0}
        aria-label="기획서 창 이동: 마우스로 끌거나 방향키로 이동"
        onKeyDown={handleKeyDown}
      >
        <span className="project-slides-window__title" style={{ fontFamily: project.titleFont }}>기획서 보러가기</span>
        {/* Not linked yet -- no planning document URL to point at. */}
        <img className="project-slides-window__arrow" src="/assets/arrow.svg" alt="" aria-hidden="true" />
      </div>
      <div className="project-slides-window__placeholder" aria-hidden="true" />
    </section>
  );
}
