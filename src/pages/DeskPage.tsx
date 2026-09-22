import { ProjectArtwork } from '../components/ProjectArtwork';
import { projects } from '../data/projects';

export function DeskPage() {
  return (
    <main className="desk-page page-shell">
      <header className="site-header">
        <a className="site-brand" href="#/" aria-label="포트폴리오 첫 화면">PORTFOLIO<span className="brand-star">✳</span></a>
        <span className="site-header__right">PERSONAL WORKSPACE <span aria-hidden="true">↗</span></span>
      </header>

      <section className="desk-intro" aria-labelledby="desk-title">
        <p className="eyebrow">WELCOME TO MY DESK · 2026</p>
        <h1 id="desk-title">작업을 담은<br /><em>나의 책상.</em></h1>
        <p>모니터 속에는 프로젝트가,<br />책상 위에는 작업의 흔적이 담겨 있어요.</p>
        <a className="text-link" href="#/projects">프로젝트 보러 가기 <span aria-hidden="true">↗</span></a>
      </section>

      <section className="desk-scene" aria-label="책상 화면">
        <div className="desk-note desk-note--top" aria-hidden="true">click<br />the monitor ✳</div>
        <span className="desk-spark desk-spark--a" aria-hidden="true">✳</span>
        <span className="desk-spark desk-spark--b" aria-hidden="true">✦</span>
        <div className="monitor-assembly">
          <a className="monitor" href="#/projects" aria-label="모니터를 열어 프로젝트 브라우저로 이동">
            <div className="monitor-screen">
              <div className="monitor-screen__top"><span>MY PROJECTS</span><span>01 / 04</span></div>
              <div className="monitor-screen__content">
                <div className="monitor-screen__copy"><span>SELECTED WORK</span><strong>프로젝트<br />브라우저</strong><span className="monitor-screen__hint">ENTER PROJECTS ↗</span></div>
                <div className="monitor-preview" aria-hidden="true"><ProjectArtwork project={projects[0]} /></div>
              </div>
            </div>
          </a>
          <div className="monitor-neck" aria-hidden="true" />
          <div className="monitor-base" aria-hidden="true" />
        </div>
        <div className="desk-keyboard" aria-label="작업 도구: Figma, VS Code, Illustrator, Photoshop, React">
          {['FIGMA', 'VS CODE', 'ILLUSTRATOR', 'PHOTOSHOP', 'REACT'].map((tool) => <span key={tool}>{tool}</span>)}
        </div>
        <div className="desk-mouse" aria-hidden="true" />
        <div className="desk-note desk-note--bottom" aria-hidden="true">make it<br />personal.</div>
      </section>

      <footer className="desk-footer"><span>DESIGNED & BUILT AS A PERSONAL PORTFOLIO</span><span>SCROLL / EXPLORE ✳</span></footer>
    </main>
  );
}
