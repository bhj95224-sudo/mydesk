import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { MonitorScreenBounds } from './ProjectMonitorScene';
import type { DecorItem } from '../data/projects';

// Original decor coordinates were measured against the 1920x1080 project page.
// Rebase those offsets from the former front project window onto the 3D monitor screen.
const REFERENCE_PAGE = { width: 1920, height: 1080, windowCenterX: 1184, windowCenterY: 575, windowWidth: 992 };

function scaledSize(value: string | number, scale: number): number | string {
  if (typeof value === 'number') return value * scale;
  if (value.endsWith('vh')) return parseFloat(value) * REFERENCE_PAGE.height / 100 * scale;
  if (value.endsWith('px')) return parseFloat(value) * scale;
  return value;
}

function keepVisible(position: number, size: number | string, otherSize: number | string, rotation: number, limit: number) {
  if (typeof size !== 'number' || typeof otherSize !== 'number' || !limit) return position;
  const angle = rotation * Math.PI / 180;
  const rotatedExtent = Math.abs(size * Math.cos(angle)) + Math.abs(otherSize * Math.sin(angle));
  const extra = Math.max(0, (rotatedExtent - size) / 2);
  const edge = 26 + extra;
  return Math.max(edge, Math.min(position, Math.max(edge, limit - size - edge)));
}

export function ProjectDecor({ themeId, items, screen, pageWidth, pageHeight }: {
  themeId: string;
  items: DecorItem[];
  screen: MonitorScreenBounds | null;
  pageWidth: number;
  pageHeight: number;
}) {
  const reduceMotion = useReducedMotion();
  const scale = screen ? screen.width / REFERENCE_PAGE.windowWidth : 1;

  return (
    <div className="browser-decor" aria-hidden="true">
      <AnimatePresence>
        {screen && items.map((item, index) => {
          const width = scaledSize(item.width, scale);
          const height = scaledSize(item.height, scale);
          const left = screen.left + screen.width / 2
            + (parseFloat(item.left) / 100 * REFERENCE_PAGE.width + 100 - REFERENCE_PAGE.windowCenterX) * scale;
          const top = screen.top + screen.height / 2
            + (parseFloat(item.top) / 100 * REFERENCE_PAGE.height - REFERENCE_PAGE.windowCenterY) * scale;
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
                width,
                height,
                left: keepVisible(left, width, height, item.rotate ?? 0, pageWidth) + (item.overflowOffsetX ?? 0) * scale,
                top: keepVisible(top, height, width, item.rotate ?? 0, pageHeight) + (item.overflowOffsetY ?? 0) * scale,
              }}
              initial={{ opacity: 0, scale: 0.84, y: 8 }}
              animate={
                reduceMotion
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 1, scale: [0.84, 1.015, 1], y: [8, -1, 0] }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: 0.66, ease: [0.22, 0.8, 0.3, 1] }}
            >
              <motion.div
                className="browser-decor__drift"
                animate={
                  reduceMotion
                    ? { x: 0, y: 0, rotate: 0 }
                    : {
                        x: [0, horizontalDrift, horizontalDrift * -0.35, 0],
                        y: [0, -verticalDrift, verticalDrift * 0.4, 0],
                        rotate: [0, rotationDrift, rotationDrift * -0.45, 0],
                      }
                }
                transition={{
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

