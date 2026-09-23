import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatedContent } from '../components/AnimatedContent';
import { ProjectArtwork } from '../components/ProjectArtwork';
import { ProjectDecor } from '../components/ProjectDecor';
import { ProjectDock } from '../components/ProjectDock';
import { projects, type Project } from '../data/projects';

type WindowSlot = {
  left: number;
  top: number;
  zIndex: number;
};

export function ProjectBrowserPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [highlightedDockId, setHighlightedDockId] = useState<string | null>(projects[0]?.id ?? null);
  const [stackOrder, setStackOrder] = useState(() => projects.map((project) => project.id));
  const windowRefs = useRef<Record<string, HTMLElement | null>>({});
  const swapTimeline = useRef<gsap.core.Timeline | null>(null);
  const swapInProgress = useRef(false);

  const active = projects[activeIndex];

  useEffect(() => () => {
    swapTimeline.current?.kill();
  }, []);

  const chooseProject = (index: number) => {
    const selected = projects[index];
    const targetPosition = stackOrder.indexOf(selected.id);

    if (targetPosition <= 0) {
      setHighlightedDockId(selected.id);
      setActiveIndex(index);
      setDetailsOpen(false);
      return;
    }

    if (swapInProgress.current) return;

    setHighlightedDockId(selected.id);

    const [frontProjectId, ...restOfStack] = stackOrder;
    const remainingProjects = restOfStack.filter((projectId) => projectId !== selected.id);
    const nextOrder = [selected.id, ...remainingProjects, frontProjectId];

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStackOrder(nextOrder);
      setActiveIndex(index);
      setDetailsOpen(false);
      return;
    }

    const windowElements = projects
      .map((project) => windowRefs.current[project.id])
      .filter((element): element is HTMLElement => Boolean(element));
    const leavingWindow = windowRefs.current[frontProjectId];

    if (!leavingWindow || windowElements.length !== projects.length) {
      setStackOrder(nextOrder);
      setActiveIndex(index);
      setDetailsOpen(false);
      return;
    }

    const slots = new Map<number, WindowSlot>();

    stackOrder.forEach((projectId, position) => {
      const element = windowRefs.current[projectId];
      if (!element) return;

      const depth = projects.length - 1 - position;
      const styles = getComputedStyle(element);
      const slot = {
        left: Number.parseFloat(styles.left),
        top: Number.parseFloat(styles.top),
        zIndex: Number.parseInt(styles.zIndex, 10),
      };

      slots.set(depth, slot);
      gsap.set(element, {
        left: slot.left,
        top: slot.top,
        zIndex: slot.zIndex,
        transition: 'none',
      });
    });

    const backSlot = slots.get(0);
    if (!backSlot) return;

    swapInProgress.current = true;
    setStackOrder(nextOrder);
    setActiveIndex(index);
    setDetailsOpen(false);

    const stage = leavingWindow.closest('.window-stage');
    const dropDistance = stage instanceof HTMLElement
      ? Math.min(300, Math.max(200, stage.clientHeight * 0.32))
      : 240;

    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(windowElements, {
          clearProps: 'left,top,zIndex,transform,transformOrigin,transition',
        });
        swapInProgress.current = false;
        swapTimeline.current = null;
      },
    });

    swapTimeline.current = timeline;

    const dropDuration = 0.58;
    const horizontalStart = 0.38;
    const returnStart = dropDuration;
    const motionEnd = 1.34;
    const promoteStart = 0.08;

    timeline
      .set(
        leavingWindow,
        {
          zIndex: projects.length + 1,
          transformOrigin: 'center center',
        },
        0,
      )
      .to(
        leavingWindow,
        {
          y: dropDistance,
          skewY: 3,
          duration: dropDuration,
          ease: 'power2.inOut',
        },
        0,
      )
      .to(
        leavingWindow,
        {
          left: backSlot.left,
          duration: motionEnd - horizontalStart,
          ease: 'power2.inOut',
        },
        horizontalStart,
      )
      .set(leavingWindow, { zIndex: backSlot.zIndex }, returnStart)
      .to(
        leavingWindow,
        {
          top: backSlot.top,
          y: 0,
          skewY: 0,
          duration: motionEnd - returnStart,
          ease: 'power2.out',
        },
        returnStart,
      );

    nextOrder.slice(0, -1).forEach((projectId, position) => {
      const element = windowRefs.current[projectId];
      const depth = projects.length - 1 - position;
      const targetSlot = slots.get(depth);
      if (!element || !targetSlot) return;

      const startAt = promoteStart + position * 0.035;
      timeline
        .set(element, { zIndex: targetSlot.zIndex }, startAt)
        .to(
          element,
          {
            left: targetSlot.left,
            top: targetSlot.top,
            duration: motionEnd - startAt,
            ease: 'power2.inOut',
          },
          startAt,
        );
    });
  };

  return (
    <main
      className={`browser-page page-shell${isLeaving ? ' is-leaving' : ''}`}
      style={{ '--tint-mid': active.backgroundMid, '--tint-end': active.backgroundEnd } as CSSProperties}
      onAnimationEnd={(event) => {
        if (isLeaving && event.target === event.currentTarget) {
          window.location.hash = '/';
        }
      }}
    >
      <div className="browser-tint" aria-hidden="true" />
      <ProjectDecor themeId={active.theme} items={active.decor} />

      <header className="browser-header">
        <a
          className="back-link"
          href="#/"
          aria-label="책상 화면으로 돌아가기"
          onClick={(event) => {
            event.preventDefault();
            if (!isLeaving) setIsLeaving(true);
          }}
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          BACK TO DESK
        </a>
        <span>SELECTED PROJECTS <b>✳</b> 2026</span>
      </header>

      <div className="browser-layout">
        <section className="project-intro" aria-labelledby="project-title">
          <p className="eyebrow">PROJECT BROWSER <span className="project-count">0{activeIndex + 1} / 0{projects.length}</span></p>
          <p className="project-category">{active.category}</p>
          <AnimatedContent key={`intro-${active.id}`} className="project-text-anim" direction="horizontal" reverse duration={1.2} scale={1.3}>
            <h1 id="project-title" style={{ fontFamily: active.titleFont }}>{active.displayName}</h1>
            <p className="project-description">{active.description}</p>
          </AnimatedContent>
          <button className="detail-link" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} aria-controls="project-details">
            {detailsOpen ? '설명 닫기' : '프로젝트 설명'} <span aria-hidden="true">↗</span>
          </button>
          {detailsOpen && <div className="project-details" id="project-details"><strong>{active.displayName}</strong><p>{active.description}</p><small>프로젝트 상세 페이지와 최종 기여 범위는 콘텐츠 확정 후 연결할 예정입니다.</small></div>}

          <ProjectDock
            projects={projects}
            activeId={active.id}
            highlightedId={highlightedDockId}
            onSelect={(id) => chooseProject(projects.findIndex((project) => project.id === id))}
          />
        </section>

        <section className="window-stage" aria-label="겹쳐진 프로젝트 창">
          {projects.map((project) => {
            const stackPosition = stackOrder.indexOf(project.id);
            const depth = projects.length - 1 - stackPosition;

            return (
              <ProjectWindow
                key={project.id}
                project={project}
                depth={depth}
                active={project.id === active.id}
                windowRef={(node) => {
                  windowRefs.current[project.id] = node;
                }}
              />
            );
          })}
        </section>
      </div>
    </main>
  );
}

function ProjectWindow({
  project,
  depth,
  active,
  windowRef,
}: {
  project: Project;
  depth: number;
  active: boolean;
  windowRef: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={windowRef}
      className={`project-window project-window--${project.theme} project-window--depth-${depth} ${active ? 'is-front' : ''}`}
      style={{ '--project-accent': project.accent, '--project-border': project.borderColor } as CSSProperties}
    >
      <div className="project-window__bar">
        <span className="project-window__status" aria-hidden="true" />
        <span className="project-window__title" style={{ fontFamily: project.titleFont }}>{project.name}</span>
        <span className="project-window__action" aria-hidden="true">↗</span>
      </div>
      <ProjectArtwork project={project} />
    </article>
  );
}








