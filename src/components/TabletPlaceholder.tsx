import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { TabletPlaceholderItem } from '../data/tabletPlaceholders';

interface TabletPlaceholderProps {
  item: TabletPlaceholderItem;
  children?: ReactNode;
  onActivate?: () => void;
}

type TabletPlaceholderStyle = CSSProperties & {
  '--placeholder-width': string;
  '--placeholder-height': string;
  '--placeholder-left': string;
  '--placeholder-top': string;
  '--placeholder-rotation': string;
  '--placeholder-ratio': string;
};

const CLICK_MOVE_THRESHOLD = 8;

export function TabletPlaceholder({ item, children, onActivate }: TabletPlaceholderProps) {
  const pointerStartRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const style: TabletPlaceholderStyle = {
    '--placeholder-width': `${item.width}px`,
    '--placeholder-height': `${item.height}px`,
    '--placeholder-left': `${item.left}px`,
    '--placeholder-top': `${item.top}px`,
    '--placeholder-rotation': `${item.rotation}deg`,
    '--placeholder-ratio': `${item.width} / ${item.height}`,
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!onActivate || event.button !== 0) return;
    pointerStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointerStart = pointerStartRef.current;
    if (!pointerStart || pointerStart.id !== event.pointerId || pointerStart.moved) return;

    pointerStart.moved = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    ) > CLICK_MOVE_THRESHOLD;
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!pointerStart || pointerStart.id !== event.pointerId || pointerStart.moved) return;
    onActivate?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onActivate || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onActivate();
  };

  return (
    <article
      className={`tablet-placeholder tablet-placeholder--${item.size}`}
      style={style}
      aria-label={item.label}
      data-physics-id={item.id}
      data-physics-width={item.width}
      data-physics-height={item.height}
      data-physics-rotation={item.rotation}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      aria-haspopup={onActivate ? 'dialog' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStartRef.current = null; }}
      onKeyDown={handleKeyDown}
    >
      <div className="tablet-placeholder__content">
        {item.src && <img className="tablet-placeholder__image" src={item.src} alt="" draggable={false} />}
        {children}
      </div>
    </article>
  );
}
