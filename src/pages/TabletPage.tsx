import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BackToDeskLink } from '../components/BackToDeskLink';
import { TabletPlaceholder } from '../components/TabletPlaceholder';
import { TabletPhysicsObject } from '../components/TabletPhysicsObject';
import { tabletPhysicsItems, type TabletPlaceholderItem } from '../data/tabletPlaceholders';
import { useTabletPhysics } from '../hooks/useTabletPhysics';
import { IntroPage, LOADING_TEXT } from './IntroPage';

export function TabletPage({ onBackToDesk }: { onBackToDesk: () => void }) {
  const physicsStageRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The card whose design is shown in the preview window. Any card with a design (src)
  // opens it on click; closes with the X or Escape. The backdrop lets clicks through, so
  // the objects behind stay draggable.
  const [previewItem, setPreviewItem] = useState<TabletPlaceholderItem | null>(null);
  const previewOpen = previewItem !== null;
  // Window drag offset from its centered spot; reset each time it opens.
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const previewDragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  const openPreview = (item: TabletPlaceholderItem) => {
    setPreviewOffset({ x: 0, y: 0 });
    setPreviewItem(item);
  };

  const handlePreviewDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: previewOffset,
    };
  };

  const handlePreviewDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPreviewOffset({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    });
  };

  const handlePreviewDragEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (previewDragRef.current?.pointerId !== event.pointerId) return;
    previewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Objects start falling only after the loading screen is gone.
  useTabletPhysics(physicsStageRef, tabletPhysicsItems, !showLoader);

  useEffect(() => {
    if (!previewOpen) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewItem(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen]);

  return (
    <>
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
              onActivate={item.src ? () => openPreview(item) : undefined}
            />
          ) : (
            <TabletPhysicsObject key={item.id} item={item} />
          ),
        )}
      </section>

      {previewItem && (
        <div className="tablet-preview-backdrop">
          <section
            className={previewItem.previewTone ? 'tablet-preview-window tablet-preview-window--' + previewItem.previewTone : 'tablet-preview-window'}
            role="dialog"
            aria-modal="false"
            aria-labelledby="tablet-preview-title"
            style={{ left: previewOffset.x, top: previewOffset.y }}
          >
            <header
              className="tablet-preview-window__header"
              onPointerDown={handlePreviewDragStart}
              onPointerMove={handlePreviewDragMove}
              onPointerUp={handlePreviewDragEnd}
              onPointerCancel={handlePreviewDragEnd}
            >
              <span className="tablet-preview-window__eyebrow">{previewItem.previewEyebrow ?? 'PROJECT'}</span>
              <h2 id="tablet-preview-title">{previewItem.previewTitle ?? previewItem.label}</h2>
              <div className="tablet-preview-window__actions">
                <span>PROJECT PREVIEW</span>
                <button
                  ref={closeButtonRef}
                  className="tablet-preview-window__close"
                  type="button"
                  aria-label="전체 이미지 닫기"
                  onClick={() => setPreviewItem(null)}
                >
                  <img src="/assets/icon-close.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className={previewItem.previewImages ? 'tablet-preview-window__body tablet-preview-window__body--stacked' : 'tablet-preview-window__body'}>
              {previewItem.previewImages ? (
                <div className="tablet-preview-window__gallery">
                  {previewItem.previewImages.map((image) => (
                    <img key={image.src} src={image.src} alt={image.alt} />
                  ))}
                </div>
              ) : (
                <img src={previewItem.previewSrc ?? previewItem.src} alt={previewItem.previewAlt ?? previewItem.label} />
              )}
            </div>
          </section>
        </div>
      )}
    </main>
    {showLoader && <IntroPage text={LOADING_TEXT.tablet} ready onFinish={() => setShowLoader(false)} />}
    </>
  );
}
