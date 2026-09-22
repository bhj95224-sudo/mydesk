import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ProjectArtwork } from '../components/ProjectArtwork';
import { ProjectDecor } from '../components/ProjectDecor';
import { ProjectDock } from '../components/ProjectDock';
import { projects, type Project } from '../data/projects';

const ROTATION_MS = 6500;

export function ProjectBrowserPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const elapsed = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const tick = (time: number) => {
      const delta = lastFrame.current === null ? 0 : Math.min(time - lastFrame.current, 100);
      lastFrame.current = time;
      if (!pausedRef.current && !reducedMotion.matches && !document.hidden) {
        elapsed.current += delta;
        if (elapsed.current >= ROTATION_MS) {
          elapsed.current = 0;
          setActiveIndex((index) => (index + 1) % projects.length);
          setDetailsOpen(false);
        }
        setProgress(elapsed.current / ROTATION_MS);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const chooseProject = (index: number) => {
    elapsed.current = 0;
    setProgress(0);
    setActiveIndex(index);
    setDetailsOpen(false);
  };

  const active = projects[activeIndex];

  // Back-to-front stacking order: the project right before `active` (cyclically) sits furthest
  // back, walking forward to `active` itself in front. Matches the Figma reference exactly.
  const ordered: Project[] = [];
  for (let step = 1; step <= projects.length - 1; step += 1) {
    ordered.push(projects[(activeIndex - step + projects.length) % projects.length]);
  }
  ordered.push(active);

  return (
    <main
      className="browser-page page-shell"
      style={{ '--tint-mid': active.backgroundMid, '--tint-end': active.backgroundEnd } as CSSProperties}
    >
      <div className="browser-tint" aria-hidden="true" />
      <ProjectDecor themeId={active.theme} items={active.decor} />

      <header className="browser-header">
        <a className="back-link" href="#/" aria-label="책상 화면으로 돌아가기"><span aria-hidden="true">←</span> BACK TO DESK</a>
        <span>SELECTED PROJECTS <b>✳</b> 2026</span>
      </header>

      <div className="browser-layout">
        <section className="project-intro" aria-labelledby="project-title">
          <p className="eyebrow">PROJECT BROWSER <span className="project-count">0{activeIndex + 1} / 0{projects.length}</span></p>
          <h1 id="project-title" style={{ fontFamily: active.titleFont }}>{active.displayName}</h1>
          <p className="project-category">{active.category}</p>
          <p className="project-description">{active.description}</p>
          <button className="detail-link" type="button" onClick={() => { setDetailsOpen((open) => !open); setPaused(true); }} aria-expanded={detailsOpen} aria-controls="project-details">
            {detailsOpen ? '설명 닫기' : '프로젝트 설명'} <span aria-hidden="true">↗</span>
          </button>
          {detailsOpen && <div className="project-details" id="project-details"><strong>{active.displayName}</strong><p>{active.description}</p><small>프로젝트 상세 페이지와 최종 기여 범위는 콘텐츠 확정 후 연결할 예정입니다.</small></div>}

          <ProjectDock projects={projects} activeId={active.id} onSelect={(id) => chooseProject(projects.findIndex((project) => project.id === id))} />

          <div className="rotation-control">
            <div className="rotation-track" role="progressbar" aria-label="다음 프로젝트까지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? '자동 전환 재개' : '자동 전환 일시정지'}>{paused ? '▶ 재생' : 'Ⅱ 일시정지'}</button>
          </div>
        </section>

        <section className="window-stage" aria-label="겹쳐진 프로젝트 창" onMouseEnter={() => setPaused(true)} onMouseLeave={() => { if (!detailsOpen) setPaused(false); }} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !detailsOpen) setPaused(false); }}>
          {ordered.map((project, depth) => <ProjectWindow key={project.id} project={project} depth={depth} active={project.id === active.id} onSelect={() => chooseProject(projects.findIndex((item) => item.id === project.id))} />)}
        </section>
      </div>
    </main>
  );
}

function ProjectWindow({ project, depth, active, onSelect }: { project: Project; depth: number; active: boolean; onSelect: () => void }) {
  return (
    <article className={`project-window project-window--${project.theme} project-window--depth-${depth} ${active ? 'is-front' : ''}`} style={{ '--project-accent': project.accent, '--project-border': project.borderColor } as CSSProperties}>
      <button className="project-window__bar" type="button" onClick={onSelect} aria-label={`${project.displayName} 프로젝트 선택`} aria-current={active ? 'true' : undefined}>
        <span className="project-window__status" aria-hidden="true" />
        <span className="project-window__title" style={{ fontFamily: project.titleFont }}>{project.name}</span>
        <span className="project-window__action" aria-hidden="true">↗</span>
      </button>
      <ProjectArtwork project={project} />
    </article>
  );
}
