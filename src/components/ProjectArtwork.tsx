import { useEffect, useRef } from 'react';
import type { Project } from '../data/projects';

export function ProjectArtwork({ project, isFront }: { project: Project; isFront: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isFront) {
      // Every time the project comes to the front, play its video from the start.
      video.currentTime = 0;
      void video.play().catch(() => {});
    } else if (!video.paused || video.currentTime > 0) {
      // Sent to the back: reset to how it looked before playing (the poster), rather than
      // freezing on whatever frame it had reached. load() rewinds and brings the poster back.
      video.pause();
      video.load();
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

  // Not a link: the site opens from the "프로젝트 보러가기" button beside the monitor.
  return (
    <div className={`project-artwork project-artwork--${project.theme}`} aria-label={`${project.displayName} 프로젝트 대표 화면`}>
      {preview}
    </div>
  );
}
