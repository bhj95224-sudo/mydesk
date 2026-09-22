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

  return (
    <div className={`project-artwork project-artwork--${project.theme}`} aria-label={`${project.displayName} 프로젝트 대표 화면`}>
      <img src={project.contentImage} alt="" className="project-artwork__image" />
    </div>
  );
}
