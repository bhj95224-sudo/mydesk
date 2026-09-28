import type { Project } from '../data/projects';

export function ProjectArtwork({ project }: { project: Project }) {
  if (!project.contentImage) {
    return (
      <div
        className={`project-artwork project-artwork--${project.theme}`}
        style={{ background: project.contentBg }}
        aria-label={`${project.displayName} 프로젝트 대표 화면 (준비 중)`}
      />
    );
  }

  if (project.externalUrl) {
    return (
      <a
        className={`project-artwork project-artwork--${project.theme} project-artwork--linked`}
        href={project.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${project.displayName} 프로젝트 사이트 새 탭에서 열기`}
      >
        <img src={project.contentImage} alt="" className="project-artwork__image" />
      </a>
    );
  }

  return (
    <div className={`project-artwork project-artwork--${project.theme}`} aria-label={`${project.displayName} 프로젝트 대표 화면`}>
      <img src={project.contentImage} alt="" className="project-artwork__image" />
    </div>
  );
}
