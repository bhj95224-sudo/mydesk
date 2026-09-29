import { useEffect, useRef, useState } from 'react';
import { BackToDeskLink } from '../components/BackToDeskLink';
import { TabletPlaceholder } from '../components/TabletPlaceholder';
import { TabletPhysicsObject } from '../components/TabletPhysicsObject';
import { tabletPhysicsItems } from '../data/tabletPlaceholders';
import { useTabletPhysics } from '../hooks/useTabletPhysics';

export function TabletPage({ onBackToDesk }: { onBackToDesk: () => void }) {
  const physicsStageRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [previewMode, setPreviewMode] = useState<'hover' | 'manual' | null>(null);

  useTabletPhysics(physicsStageRef, tabletPhysicsItems);

  useEffect(() => {
    if (!previewMode) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewMode(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    if (previewMode === 'manual') closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMode]);

  return (
    <main className="tablet-page page-shell">
      <header className="browser-header tablet-header">
        <BackToDeskLink onBackToDesk={onBackToDesk} />
      </header>

      <section ref={physicsStageRef} className="tablet-physics-stage" aria-label="태블릿 작업물 영역">
        {tabletPhysicsItems.map((item) =>
          item.kind === 'placeholder' ? (
            <TabletPlaceholder
              key={item.id}
              item={item}
              onActivate={item.size === 'large' && item.src ? () => setPreviewMode('manual') : undefined}
              onHoverStart={item.size === 'large' && item.src ? () => setPreviewMode('hover') : undefined}
              onHoverEnd={item.size === 'large' && item.src ? () => setPreviewMode((mode) => mode === 'hover' ? null : mode) : undefined}
            />
          ) : (
            <TabletPhysicsObject key={item.id} item={item} />
          ),
        )}
      </section>

      {previewMode && (
        <div
          className={`tablet-preview-backdrop${previewMode === 'hover' ? ' tablet-preview-backdrop--hover' : ''}`}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setPreviewMode(null);
          }}
        >
          <section className="tablet-preview-window" role="dialog" aria-modal={previewMode === 'manual'} aria-labelledby="tablet-preview-title">
            <header className="tablet-preview-window__header">
              <span className="tablet-preview-window__eyebrow">STORYBOARD</span>
              <h2 id="tablet-preview-title">Sulwhasoo</h2>
              <div className="tablet-preview-window__actions">
                <span>PROJECT PREVIEW</span>
                {previewMode === 'manual' && (
                  <button
                    ref={closeButtonRef}
                    className="tablet-preview-window__close"
                    type="button"
                    aria-label="전체 이미지 닫기"
                    onClick={() => setPreviewMode(null)}
                  >
                    ×
                  </button>
                )}
              </div>
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
