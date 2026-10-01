import { useEffect, useRef } from 'react';

// Click spark effect (React Bits "ClickSpark"), laid over the whole site: every click bursts
// a ring of short lines that fly outward and shrink away. The canvas ignores pointer events.
type Spark = { x: number; y: number; angle: number; startTime: number };

type ClickSparkProps = {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  extraScale?: number;
};

const easeOut = (t: number) => t * (2 - t);

export function ClickSpark({
  sparkColor = '#ff8b9d',
  sparkSize = 18,
  sparkRadius = 40,
  sparkCount = 8,
  duration = 400,
  extraScale = 0.9,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sparks: Spark[] = [];
    let frame = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (timestamp: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.strokeStyle = sparkColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      sparks = sparks.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;

        const eased = easeOut(elapsed / duration);
        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);
        const cos = Math.cos(spark.angle);
        const sin = Math.sin(spark.angle);

        ctx.beginPath();
        ctx.moveTo(spark.x + distance * cos, spark.y + distance * sin);
        ctx.lineTo(spark.x + (distance + lineLength) * cos, spark.y + (distance + lineLength) * sin);
        ctx.stroke();
        return true;
      });

      frame = sparks.length ? requestAnimationFrame(draw) : 0;
    };

    const handleClick = (event: MouseEvent) => {
      if (reducedMotion.matches) return;
      const startTime = performance.now();
      for (let i = 0; i < sparkCount; i += 1) {
        sparks.push({ x: event.clientX, y: event.clientY, angle: (2 * Math.PI * i) / sparkCount, startTime });
      }
      if (!frame) frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    // Capture phase, so pages that stop click propagation still get the effect.
    window.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, extraScale]);

  return <canvas ref={canvasRef} className="click-spark" aria-hidden="true" />;
}
