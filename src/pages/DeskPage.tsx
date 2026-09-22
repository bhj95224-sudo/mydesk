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
        <div className="desk-image-wrap">
          <img className="desk-image" src="/assets/desk-temporary.png" alt="모니터와 키보드, 마우스, 의자가 놓인 책상" />
          <a className="desk-monitor-hotspot" href="#/projects" aria-label="모니터를 열어 프로젝트 브라우저로 이동" title="프로젝트 보기" />
        </div>
      </section>

      <footer className="desk-footer"><span>DESIGNED & BUILT AS A PERSONAL PORTFOLIO</span><span>SCROLL / EXPLORE ✳</span></footer>
    </main>
  );
}
