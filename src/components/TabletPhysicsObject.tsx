import type { CSSProperties } from 'react';
import type { TabletImageItem } from '../data/tabletPlaceholders';

interface TabletPhysicsObjectProps {
  item: TabletImageItem;
}

type TabletPhysicsObjectStyle = CSSProperties & {
  '--placeholder-width': string;
  '--placeholder-height': string;
  '--placeholder-left': string;
  '--placeholder-top': string;
  '--placeholder-rotation': string;
  '--placeholder-ratio': string;
};

export function TabletPhysicsObject({ item }: TabletPhysicsObjectProps) {
  const style: TabletPhysicsObjectStyle = {
    '--placeholder-width': `${item.width}px`,
    '--placeholder-height': `${item.height}px`,
    '--placeholder-left': `${item.left}px`,
    '--placeholder-top': `${item.top}px`,
    '--placeholder-rotation': `${item.rotation}deg`,
    '--placeholder-ratio': `${item.width} / ${item.height}`,
  };

  return (
    <article
      className="tablet-physics-object"
      style={style}
      aria-label={item.label}
      data-physics-id={item.id}
      data-physics-width={item.width}
      data-physics-height={item.height}
      data-physics-rotation={item.rotation}
    >
      <img className="tablet-physics-object__image" src={item.src} alt="" draggable={false} />
    </article>
  );
}
