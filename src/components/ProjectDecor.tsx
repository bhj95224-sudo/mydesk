import { AnimatePresence, motion } from 'motion/react';
import type { DecorItem } from '../data/projects';

export function ProjectDecor({ themeId, items }: { themeId: string; items: DecorItem[] }) {
  return (
    <div className="browser-decor" aria-hidden="true">
      <AnimatePresence>
        {items.map((item, index) => (
          <motion.img
            key={`${themeId}-${index}`}
            src={item.src}
            alt=""
            className="browser-decor__item"
            style={{
              width: item.width,
              height: item.height,
              left: item.left,
              top: item.top,
              transform: `rotate(${item.rotate ?? 0}deg)${item.flipY ? ' scaleY(-1)' : ''}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
