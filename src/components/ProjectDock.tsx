import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { Project } from '../data/projects';

const DOCK_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 30,
  mass: 1.05,
};

// Jelly Radio-style swell/shrink spring, adapted from reactbits.dev/micro/jelly-radio.
const SWELL = 0.34;
const SHRINK = 0.06;
const JELLY = 1;
const BOUNCE = 0.28;
const STIFFNESS = 520;

const jellySpring = (stiffness: number, mass: number, bounce: number) => ({
  type: 'spring' as const,
  stiffness,
  damping: 2 * Math.sqrt(stiffness * mass) * (1 - bounce),
  mass,
});

function useJellyScale() {
  const sx = useMotionValue(1);
  const sy = useMotionValue(1);
  const reduce = useReducedMotion();
  const transform = useTransform(() => `scale(${sx.get()}, ${sy.get()})`);

  return { sx, sy, reduce, transform };
}

function DockItem({
  project,
  active,
  highlighted,
  onSelect,
}: {
  project: Project;
  active: boolean;
  highlighted: boolean;
  onSelect: () => void;
}) {
  const { sx, sy, reduce, transform } = useJellyScale();

  useEffect(() => {
    const target = highlighted ? 1 + SWELL : 1 - SHRINK;
    if (reduce) {
      sx.jump(target);
      sy.jump(target);
      return;
    }
    animate(sx, target, jellySpring(STIFFNESS * (1 + 0.24 * JELLY), 0.9 - 0.1 * JELLY, Math.min(0.85, BOUNCE + 0.3 * JELLY)));
    animate(sy, target, jellySpring(STIFFNESS * (1 - 0.14 * JELLY), 0.9 + 0.05 * JELLY, BOUNCE));
  }, [highlighted, reduce, sx, sy]);

  return (
    <motion.button
      layout="position"
      transition={{ layout: DOCK_LAYOUT_TRANSITION }}
      type="button"
      className={
        'project-dock__item' +
        (active ? ' is-active' : '') +
        (highlighted ? ' is-highlighted' : '')
      }
      style={
        {
          '--project-accent': project.accent,
          '--project-idle-accent': project.idleAccent,
          '--project-font': project.titleFont,
        } as CSSProperties
      }
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={project.displayName + ' 프로젝트 보기'}
    >
      <motion.span className="project-dock__dot" style={{ transform }} />
      <span className="project-dock__label">{project.name}</span>
    </motion.button>
  );
}

export function ProjectDock({
  projects,
  activeId,
  highlightedId,
  onSelect,
}: {
  projects: Project[];
  activeId: string;
  highlightedId: string | null;
  onSelect: (id: string) => void;
}) {
  const orderedProjects = highlightedId
    ? [
        ...projects.filter((project) => project.id === highlightedId),
        ...projects.filter((project) => project.id !== highlightedId),
      ]
    : projects;

  return (
    <nav className="project-dock" aria-label="프로젝트 선택">
      {orderedProjects.map((project) => (
        <DockItem
          key={project.id}
          project={project}
          active={project.id === activeId}
          highlighted={project.id === highlightedId}
          onSelect={() => onSelect(project.id)}
        />
      ))}
    </nav>
  );
}
