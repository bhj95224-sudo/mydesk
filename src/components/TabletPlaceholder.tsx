import type { CSSProperties, ReactNode } from 'react';
import type { TabletPlaceholderItem } from '../data/tabletPlaceholders';

interface TabletPlaceholderProps {
  item: TabletPlaceholderItem;
  children?: ReactNode;
}

type TabletPlaceholderStyle = CSSProperties & {
  '--placeholder-width': string;
  '--placeholder-height': string;
  '--placeholder-left': string;
  '--placeholder-top': string;
  '--placeholder-rotation': string;
  '--placeholder-ratio': string;
};

export function TabletPlaceholder({ item, children }: TabletPlaceholderProps) {
  const style: TabletPlaceholderStyle = {
    '--placeholder-width': `${item.width}px`,
    '--placeholder-height': `${item.height}px`,
    '--placeholder-left': `${item.left}px`,
    '--placeholder-top': `${item.top}px`,
    '--placeholder-rotation': `${item.rotation}deg`,
    '--placeholder-ratio': `${item.width} / ${item.height}`,
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
    >
      <div className="tablet-placeholder__content">{children}</div>
    </article>
  );
}
