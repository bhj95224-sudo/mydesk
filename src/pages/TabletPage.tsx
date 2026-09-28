import { useRef } from 'react';
import { TabletPlaceholder } from '../components/TabletPlaceholder';
import { TabletPhysicsObject } from '../components/TabletPhysicsObject';
import { tabletPhysicsItems } from '../data/tabletPlaceholders';
import { useTabletPhysics } from '../hooks/useTabletPhysics';

export function TabletPage({ onBackToDesk }: { onBackToDesk: () => void }) {
  const physicsStageRef = useRef<HTMLElement>(null);

  useTabletPhysics(physicsStageRef, tabletPhysicsItems);

  return (
    <main className="tablet-page page-shell">
      <header className="browser-header tablet-header">
        <a
          className="back-link"
          href="#/"
          aria-label="책상 화면으로 돌아가기"
          onClick={(event) => {
            event.preventDefault();
            onBackToDesk();
          }}
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          BACK TO DESK
        </a>
      </header>

      <section ref={physicsStageRef} className="tablet-physics-stage" aria-label="태블릿 작업물 영역">
        {tabletPhysicsItems.map((item) =>
          item.kind === 'placeholder' ? (
            <TabletPlaceholder key={item.id} item={item} />
          ) : (
            <TabletPhysicsObject key={item.id} item={item} />
          ),
        )}
      </section>
    </main>
  );
}
