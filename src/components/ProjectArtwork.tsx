import type { Project } from '../data/projects';

export function ProjectArtwork({ project }: { project: Project }) {
  return (
    <div className={`project-artwork project-artwork--${project.theme}`} aria-label={`${project.displayName} 프로젝트 임시 대표 화면`}>
      {project.theme === 'beplain' && (
        <>
          <span className="art-spark art-spark--one" aria-hidden="true">✦</span>
          <span className="art-spark art-spark--two" aria-hidden="true">✦</span>
          <span className="art-orb art-orb--one" aria-hidden="true" />
          <span className="art-orb art-orb--two" aria-hidden="true" />
          <strong className="beplain-wordmark">beplain</strong>
          <span className="artwork-caption">BRAND INTRODUCTION</span>
        </>
      )}
      {project.theme === 'sulwhasoo' && (
        <>
          <span className="botanical botanical--one" aria-hidden="true">✿</span>
          <span className="botanical botanical--two" aria-hidden="true">✿</span>
          <span className="sulwhasoo-mark">Sulwhasoo</span>
          <span className="artwork-caption">BEAUTY & HERITAGE</span>
        </>
      )}
      {project.theme === 'hourtention' && (
        <>
          <span className="hourtention-ring" aria-hidden="true" />
          <strong className="hourtention-mark">hour<span>tention</span></strong>
          <span className="artwork-caption">MAKE TIME VISIBLE</span>
        </>
      )}
      {project.theme === 'jaduya' && (
        <>
          <div className="jaduya-phone" aria-hidden="true">
            <span className="phone-top">자두야</span>
            <span className="phone-hello">오늘도 잘 지내고 있나요?</span>
            <span className="phone-card">오늘 챙길 것<br /><b>나의 생활 한눈에 보기</b></span>
            <span className="phone-dots">●　●　●</span>
          </div>
          <strong className="jaduya-mark">자두야</strong>
          <span className="artwork-caption">LIVING, MADE EASIER</span>
        </>
      )}
    </div>
  );
}
