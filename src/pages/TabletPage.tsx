import { useEffect, useRef, useState } from 'react';
import { TabletPlaceholder } from '../components/TabletPlaceholder';
import { TabletPhysicsObject } from '../components/TabletPhysicsObject';
import { tabletPhysicsItems } from '../data/tabletPlaceholders';
import { useTabletPhysics } from '../hooks/useTabletPhysics';

export function TabletPage({ onBackToDesk }: { onBackToDesk: () => void }) {
  const physicsStageRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useTabletPhysics(physicsStageRef, tabletPhysicsItems);

  useEffect(() => {
    if (!previewOpen) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen]);

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
            <TabletPlaceholder
              key={item.id}
              item={item}
              onActivate={item.size === 'large' && item.src ? () => setPreviewOpen(true) : undefined}
            />
          ) : (
            <TabletPhysicsObject key={item.id} item={item} />
          ),
        )}
      </section>

      {previewOpen && (
        <div
          className="tablet-preview-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section className="tablet-preview-window" role="dialog" aria-modal="true" aria-labelledby="tablet-preview-title">
            <header className="tablet-preview-window__header">
              <h2 id="tablet-preview-title">SULWHASOO STORYBOARD</h2>
              <button
                ref={closeButtonRef}
                className="tablet-preview-window__close"
                type="button"
                aria-label="전체 이미지 닫기"
                onClick={() => setPreviewOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="tablet-preview-window__body">
              <img src="/assets/tablet/storyboard-preview.png" alt="한국 홍보 영상 스토리보드 전체 이미지" />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
