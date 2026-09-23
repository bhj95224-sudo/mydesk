import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { gsap } from 'gsap';

/**
 * Plays a slide+scale+fade-in tween on mount. Pass `key={...}` from the caller
 * (e.g. the active project id) so React remounts this on every change and the
 * animation replays — this is not scroll-triggered, unlike the reactbits original.
 */
export function AnimatedContent({
  children,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  distance?: number;
  direction?: 'vertical' | 'horizontal';
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const offset = reverse ? -distance : distance;

    gsap.set(el, { [axis]: offset, scale, opacity: animateOpacity ? initialOpacity : 1 });
    const tween = gsap.to(el, { [axis]: 0, scale: 1, opacity: 1, duration, ease, delay });

    return () => { tween.kill(); };
  }, [distance, direction, reverse, duration, ease, initialOpacity, animateOpacity, scale, delay]);

  return <div ref={ref} className={className}>{children}</div>;
}
