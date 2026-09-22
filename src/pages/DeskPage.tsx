export function DeskPage() {
  return (
    <main className="desk-page page-shell">
      <section className="desk-scene" aria-label="책상 화면">
        <div className="desk-image-wrap">
          <img className="desk-image" src="/assets/desk-temporary.png" alt="모니터와 키보드, 마우스, 의자가 놓인 책상" />
          <a className="desk-monitor-hotspot" href="#/projects" aria-label="모니터를 열어 프로젝트 브라우저로 이동" title="프로젝트 보기" />
        </div>
      </section>
    </main>
  );
}
