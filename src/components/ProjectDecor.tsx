import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { DecorItem } from '../data/projects';

export function ProjectDecor({ themeId, items }: { themeId: string; items: DecorItem[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="browser-decor" aria-hidden="true">
      <AnimatePresence>
        {items.map((item, index) => {
          const direction = index % 2 === 0 ? 1 : -1;
          const horizontalDrift = (2 + (index % 3)) * direction;
          const verticalDrift = 4 + (index % 2) * 2;
          const rotationDrift = (0.35 + (index % 3) * 0.15) * direction;
          const duration = 5.4 + (index % 4) * 0.7;
          const delay = index * 0.28;

          return (
            <motion.div
              key={`${themeId}-${index}`}
              className="browser-decor__float"
              style={{
                width: item.width,
                height: item.height,
                left: item.left,
                top: item.top,
              }}
              initial={{ opacity: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 1, x: 0, y: 0, rotate: 0 }
                  : {
                      opacity: 1,
                      x: [0, horizontalDrift, horizontalDrift * -0.35, 0],
                      y: [0, -verticalDrift, verticalDrift * 0.4, 0],
                      rotate: [0, rotationDrift, rotationDrift * -0.45, 0],
                    }
              }
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.5 },
                x: { duration, delay, repeat: Infinity, ease: 'easeInOut' },
                y: { duration: duration * 0.92, delay, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: duration * 1.12, delay, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <img
                src={item.src}
                alt=""
                className="browser-decor__item"
                style={{
                  transform: `rotate(${item.rotate ?? 0}deg)${item.flipY ? ' scaleY(-1)' : ''}`,
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

