import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, WheelEvent as ReactWheelEvent } from 'react';
import { AnimatedContent } from '../components/AnimatedContent';
import { BackToDeskLink } from '../components/BackToDeskLink';
import { IntroPage, LOADING_TEXT } from './IntroPage';
import { ProjectArtwork } from '../components/ProjectArtwork';
import { ProjectDecor } from '../components/ProjectDecor';
import { ProjectMonitorScene, type MonitorScreenBounds } from '../components/ProjectMonitorScene';
import { projects, type Project } from '../data/projects';

type WindowSlot = {
  left: number;
  top: number;
  zIndex: number;
};

// Stack depth of the front-most project window.
const FRONT_WINDOW_DEPTH = 3;

export function ProjectBrowserPage({ onBackToDesk, entryLoaderVisible = false }: { onBackToDesk: () => void; entryLoaderVisible?: boolean }) {
  const [showLoader, setShowLoader] = useState(!entryLoaderVisible);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [stackOrder, setStackOrder] = useState(() => projects.map((project) => project.id));
  const [screenBounds, setScreenBounds] = useState<MonitorScreenBounds | null>(null);
  const [decorFrame, setDecorFrame] = useState<{ screen: MonitorScreenBounds; pageWidth: number; pageHeight: number } | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const windowRefs = useRef<Record<string, HTMLElement | null>>({});
  const swapTimeline = useRef<gsap.core.Timeline | null>(null);
  const swapInProgress = useRef(false);
  const wheelDelta = useRef(0);
  const wheelResetTimer = useRef<number | null>(null);

  const active = projects[activeIndex];
  const handleScreenBounds = useCallback((next: MonitorScreenBounds) => {
    setScreenBounds((current) => current
      && Math.abs(current.left - next.left) < 0.5
      && Math.abs(current.top - next.top) < 0.5
      && Math.abs(current.width - next.width) < 0.5
      && Math.abs(current.height - next.height) < 0.5
      ? current : next);
    const page = pageRef.current;
    const monitor = monitorRef.current;
    if (!page || !monitor) return;
    const pageRect = page.getBoundingClientRect();
    const monitorRect = monitor.getBoundingClientRect();
    const pageScreen = {
      left: next.left + monitorRect.left - pageRect.left,
      top: next.top + monitorRect.top - pageRect.top,
      width: next.width,
      height: next.height,
    };
    setDecorFrame((current) => current
      && current.pageWidth === page.clientWidth
      && current.pageHeight === page.clientHeight
      && Math.abs(current.screen.left - pageScreen.left) < 0.5
      && Math.abs(current.screen.top - pageScreen.top) < 0.5
      && Math.abs(current.screen.width - pageScreen.width) < 0.5
      && Math.abs(current.screen.height - pageScreen.height) < 0.5
      ? current : { screen: pageScreen, pageWidth: page.clientWidth, pageHeight: page.clientHeight });
  }, []);

  useEffect(() => () => {
    swapTimeline.current?.kill();
    if (wheelResetTimer.current !== null) window.clearTimeout(wheelResetTimer.current);
  }, []);

  const chooseProject = (index: number) => {
    const selected = projects[index];
    const targetPosition = stackOrder.indexOf(selected.id);

    if (targetPosition <= 0) {
      setActiveIndex(index);
      setDetailsOpen(false);
      return;
    }

    if (swapInProgress.current) return;

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

      const depth = FRONT_WINDOW_DEPTH - position;
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

    const backSlot = slots.get(FRONT_WINDOW_DEPTH - projects.length + 1);
    if (!backSlot) return;

    swapInProgress.current = true;
    setStackOrder(nextOrder);
    setActiveIndex(index);
    setDetailsOpen(false);

    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(windowElements, {
          clearProps: 'left,top,zIndex,transform,transformOrigin,transition,opacity,clipPath',
        });
        swapInProgress.current = false;
        swapTimeline.current = null;
      },
    });

    swapTimeline.current = timeline;

    const fadeOutDuration = 0.5;
    const returnStart = fadeOutDuration;
    const motionEnd = 1.34;
    const promoteStart = 0.08;

    // The leaving front window fades out in place on the screen (over the next window
    // sliding in underneath), then reappears in the back slot behind the monitor.
    timeline
      .set(
        leavingWindow,
        {
          // Above the new front window (z 5) while it fades.
          zIndex: FRONT_WINDOW_DEPTH + 3,
          opacity: 1,
        },
        0,
      )
      .to(
        leavingWindow,
        {
          opacity: 0,
          duration: fadeOutDuration,
          ease: 'power1.out',
        },
        0,
      )
      .set(
        leavingWindow,
        { left: backSlot.left, top: backSlot.top, zIndex: backSlot.zIndex },
        returnStart,
      )
      .to(
        leavingWindow,
        {
          opacity: 1,
          duration: motionEnd - returnStart,
          ease: 'power1.inOut',
        },
        returnStart,
      );

    nextOrder.slice(0, -1).forEach((projectId, position) => {
      const element = windowRefs.current[projectId];
      const depth = FRONT_WINDOW_DEPTH - position;
      const targetSlot = slots.get(depth);
      if (!element || !targetSlot) return;

      const startAt = promoteStart + position * 0.035;
      // The window becoming the front one is raised above the monitor as it slides in from
      // its back slot, so clip it to the screen (the stage box -- windows are the stage's
      // size) the whole way; the part still outside the screen stays hidden.
      const clipToScreen = position === 0
        ? () => {
            const left = Number.parseFloat(element.style.left) || 0;
            const top = Number.parseFloat(element.style.top) || 0;
            element.style.clipPath = `inset(${Math.max(0, -top)}px ${Math.max(0, left)}px ${Math.max(0, top)}px ${Math.max(0, -left)}px)`;
          }
        : undefined;
      timeline
        .set(element, { zIndex: targetSlot.zIndex, onComplete: clipToScreen }, startAt)
        .to(
          element,
          {
            left: targetSlot.left,
            top: targetSlot.top,
            duration: motionEnd - startAt,
            ease: 'power2.inOut',
            onUpdate: clipToScreen,
          },
          startAt,
        );
    });
  };

  const handleProjectWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (projects.length < 2 || swapInProgress.current) return;

    const normalizedDelta = event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * window.innerHeight
        : event.deltaY;

    wheelDelta.current += normalizedDelta;
    if (wheelResetTimer.current !== null) window.clearTimeout(wheelResetTimer.current);
    wheelResetTimer.current = window.setTimeout(() => {
      wheelDelta.current = 0;
      wheelResetTimer.current = null;
    }, 140);

    if (Math.abs(wheelDelta.current) < 40) return;

    event.preventDefault();
    const targetPosition = 1;
    const targetProjectId = stackOrder[targetPosition];
    wheelDelta.current = 0;

    const targetIndex = projects.findIndex((project) => project.id === targetProjectId);
    if (targetIndex >= 0) chooseProject(targetIndex);
  };

  return (
    <>
    <main
      ref={pageRef}
      className="browser-page page-shell"
      style={{ '--tint-mid': active.backgroundMid, '--tint-end': active.backgroundEnd } as CSSProperties}
    >
      <div className="browser-tint" aria-hidden="true" />

      <div
        className="project-progress"
        aria-hidden="true"
        style={{
          '--progress-track': active.progressTrack,
          '--progress-segment': active.progressSegment,
          '--progress-segment-height': `${100 / projects.length}%`,
          '--progress-position': `${(activeIndex / projects.length) * 100}%`,
        } as CSSProperties}
      >
        <span className="project-progress__thumb" />
      </div>

      <header className="browser-header">
        <BackToDeskLink onBackToDesk={onBackToDesk} />
        <span>SELECTED PROJECTS <b>✳</b> 2026</span>
      </header>

      <div className="browser-layout">
        <section className="project-intro" aria-labelledby="project-title">
          <p className="eyebrow">PROJECT BROWSER <span className="project-count">0{activeIndex + 1} / 0{projects.length}</span></p>
          <p className="project-category">{active.category}</p>
          <AnimatedContent key={`intro-${active.id}`} className="project-text-anim" direction="horizontal" reverse duration={1.2} scale={1.3}>
            <h1 id="project-title" style={{ fontFamily: active.titleFont }}>{active.displayName}</h1>
            <p className="project-description">{active.description}</p>
            {active.note && <p className="project-description project-description--note">{active.note}</p>}
          </AnimatedContent>
          <button className="detail-link" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} aria-controls="project-details">
            {detailsOpen ? '설명 닫기' : '프로젝트 설명'} <span aria-hidden="true">↗</span>
          </button>
          {detailsOpen && <div className="project-details" id="project-details"><strong>{active.displayName}</strong><p>{active.description}</p><small>프로젝트 상세 페이지와 최종 기여 범위는 콘텐츠 확정 후 연결할 예정입니다.</small></div>}

        </section>

        <div ref={monitorRef} className="project-monitor" onWheel={handleProjectWheel}>
          <ProjectMonitorScene
            className="project-monitor__scene"
            backgroundMid={active.backgroundMid}
            backgroundEnd={active.backgroundEnd}
            onScreenBounds={handleScreenBounds}
          />
          <section
            className="window-stage"
            aria-label="모니터 화면 안에 겹쳐진 프로젝트 창"
            style={screenBounds ? {
              left: screenBounds.left,
              top: screenBounds.top,
              width: screenBounds.width,
              height: screenBounds.height,
            } : { visibility: 'hidden' }}
          >
            {projects.map((project, projectIndex) => {
              const stackPosition = stackOrder.indexOf(project.id);
              const depth = FRONT_WINDOW_DEPTH - stackPosition;

              return (
                <ProjectWindow
                  key={project.id}
                  project={project}
                  depth={depth}
                  active={project.id === active.id}
                  onSelect={() => chooseProject(projectIndex)}
                  windowRef={(node) => {
                    windowRefs.current[project.id] = node;
                  }}
                />
              );
            })}
          </section>
        </div>
      </div>
      {!showLoader && !entryLoaderVisible && (
        <ProjectDecor
          themeId={active.theme}
          items={active.decor}
          screen={decorFrame?.screen ?? null}
          pageWidth={decorFrame?.pageWidth ?? 0}
          pageHeight={decorFrame?.pageHeight ?? 0}
        />
      )}
      <div className="project-haze" aria-hidden="true" />
      {decorFrame && (
        // Stacked at the monitor's bottom-left corner, the color blocks overlapping the left
        // bezel onto the screen edge; the lower tape ends just above the chin's bottom edge.
        <nav
          className="project-links"
          aria-label={`${active.displayName} 바로가기`}
          style={{
            right: decorFrame.pageWidth - decorFrame.screen.left - decorFrame.screen.width * 0.032,
            top: decorFrame.screen.top + decorFrame.screen.height * 1.027,
            transform: 'translateY(-100%)',
            ...(active.tapeColors && {
              '--tape-color-top': active.tapeColors[0],
              '--tape-color-bottom': active.tapeColors[1],
            }),
          } as CSSProperties}
        >
          {active.externalUrl ? (
            <a className="project-link" href={active.externalUrl} target="_blank" rel="noopener noreferrer">
              <span className="project-link__label">프로젝트 보러가기</span>
              <span className="project-link__swatch" aria-hidden="true" />
            </a>
          ) : (
            <span className="project-link is-disabled" aria-disabled="true">
              <span className="project-link__label">프로젝트 보러가기</span>
              <span className="project-link__swatch" aria-hidden="true" />
            </span>
          )}
          {/* No proposal link yet -- button only for now. */}
          <span className="project-link project-link--proposal is-disabled" aria-disabled="true">
            <span className="project-link__label">기획서 보러가기</span>
            <span className="project-link__swatch" aria-hidden="true" />
          </span>
        </nav>
      )}
    </main>
    {showLoader && <IntroPage text={LOADING_TEXT.projects} ready onFinish={() => setShowLoader(false)} />}
    </>
  );
}

function ProjectWindow({
  project,
  depth,
  active,
  onSelect,
  windowRef,
}: {
  project: Project;
  depth: number;
  active: boolean;
  onSelect: () => void;
  windowRef: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={windowRef}
      className={`project-window project-window--${project.theme} project-window--depth-${depth} ${active ? 'is-front' : ''}`}
      style={{ '--project-accent': project.accent, '--project-border': project.borderColor } as CSSProperties}
    >
      <button
        className="project-window__bar"
        type="button"
        onClick={onSelect}
        aria-label={`${project.displayName} 프로젝트를 맨 앞으로 가져오기`}
        aria-pressed={active}
      >
        <span className="project-window__status" aria-hidden="true" />
        <span className="project-window__title" style={{ fontFamily: project.titleFont }}>{project.name}</span>
      </button>
      {/* Decorative only -- the project site opens from the "프로젝트 보러가기" button. */}
      <span className="project-window__action" aria-hidden="true">
        <img src="/assets/arrow.svg" alt="" />
      </span>
      <ProjectArtwork project={project} isFront={active} />
    </article>
  );
}








