import { useEffect, useRef } from 'react';
import type { Project } from '../data/projects';

export function ProjectArtwork({ project, isFront }: { project: Project; isFront: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isFront) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isFront]);

  if (!project.contentImage && !project.contentVideo) {
    return (
      <div
        className={`project-artwork project-artwork--${project.theme}`}
        style={{ background: project.contentBg }}
        aria-label={`${project.displayName} 프로젝트 대표 화면 (준비 중)`}
      />
    );
  }

  const preview = project.contentVideo ? (
    <video
      ref={videoRef}
      className="project-artwork__image"
      src={project.contentVideo}
      poster={project.contentImage}
      autoPlay={isFront}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  ) : (
    <img src={project.contentImage} alt="" className="project-artwork__image" />
  );

  if (project.externalUrl) {
    return (
      <a
        className={`project-artwork project-artwork--${project.theme} project-artwork--linked`}
        href={project.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${project.displayName} 프로젝트 사이트 새 탭에서 열기`}
      >
        {preview}
      </a>
    );
  }

  return (
    <div className={`project-artwork project-artwork--${project.theme}`} aria-label={`${project.displayName} 프로젝트 대표 화면`}>
      {preview}
    </div>
  );
}
