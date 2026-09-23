import { useRef, useState } from 'react';
import { TabletPlaceholder } from '../components/TabletPlaceholder';
import { tabletPlaceholders } from '../data/tabletPlaceholders';
import { useTabletPhysics } from '../hooks/useTabletPhysics';

export function TabletPage() {
  const [isLeaving, setIsLeaving] = useState(false);
  const physicsStageRef = useRef<HTMLElement>(null);

  useTabletPhysics(physicsStageRef, tabletPlaceholders);

  return (
    <main
      className={`tablet-page page-shell${isLeaving ? ' is-leaving' : ''}`}
      onAnimationEnd={(event) => {
        if (isLeaving && event.target === event.currentTarget) {
          window.location.hash = '/';
        }
      }}
    >
      <header className="browser-header tablet-header">
        <a
          className="back-link"
          href="#/"
          aria-label="책상 화면으로 돌아가기"
          onClick={(event) => {
            event.preventDefault();
            if (!isLeaving) setIsLeaving(true);
          }}
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          BACK TO DESK
        </a>
      </header>

      <section ref={physicsStageRef} className="tablet-physics-stage" aria-label="태블릿 작업물 영역">
        {tabletPlaceholders.map((item) => (
          <TabletPlaceholder key={item.id} item={item} />
        ))}
      </section>
    </main>
  );
}
