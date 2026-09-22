import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Project } from '../data/projects';

const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };
const BASE_SIZE = 20;
const MAGNIFIED_SIZE = 34;
const DISTANCE = 110;

function DockLabel({ isHovered, active, forceVisible, children }: { isHovered: MotionValue<number>; active: boolean; forceVisible: boolean; children: ReactNode }) {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active || forceVisible) {
      setVisible(true);
      return;
    }
    const unsubscribe = isHovered.on('change', (latest) => setVisible(latest === 1));
    return () => unsubscribe();
  }, [isHovered, active, forceVisible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          className="project-dock__label"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function DockItem({ project, active, onSelect, mouseY, forceVisibleLabel }: { project: Project; active: boolean; onSelect: () => void; mouseY: MotionValue<number>; forceVisibleLabel: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const isHovered = useMotionValue(0);

  const distance = useTransform(mouseY, (value) => {
    const rect = ref.current?.getBoundingClientRect() ?? { y: 0, height: BASE_SIZE };
    return value - rect.y - rect.height / 2;
  });
  const targetSize = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE_SIZE, MAGNIFIED_SIZE, BASE_SIZE]);
  const size = useSpring(targetSize, SPRING);

  return (
    <button
      ref={ref}
      type="button"
      className={`project-dock__item ${active ? 'is-active' : ''}`}
      style={{ '--project-accent': project.accent, '--project-font': project.titleFont } as CSSProperties}
      onMouseEnter={() => isHovered.set(1)}
      onMouseLeave={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`${project.displayName} 프로젝트 보기`}
    >
      <motion.span className="project-dock__dot" style={{ width: size, height: size }} />
      <DockLabel isHovered={isHovered} active={active} forceVisible={forceVisibleLabel}>{project.name}</DockLabel>
    </button>
  );
}

export function ProjectDock({ projects, activeId, onSelect }: { projects: Project[]; activeId: string; onSelect: (id: string) => void }) {
  const mouseY = useMotionValue(Infinity);
  const activeIndex = Math.max(0, projects.findIndex((project) => project.id === activeId));
  const ordered = Array.from({ length: projects.length }, (_, index) => projects[(activeIndex + index) % projects.length]);

  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const handleChange = () => setCompact(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <nav
      className="project-dock"
      aria-label="프로젝트 선택"
      onMouseMove={(event) => mouseY.set(event.clientY)}
      onMouseLeave={() => mouseY.set(Infinity)}
    >
      {ordered.map((project) => (
        <DockItem key={project.id} project={project} active={project.id === activeId} onSelect={() => onSelect(project.id)} mouseY={mouseY} forceVisibleLabel={compact} />
      ))}
    </nav>
  );
}
