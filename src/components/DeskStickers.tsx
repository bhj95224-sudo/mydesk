import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

// Draggable paper decorations on the desk page (Figma frame 229:209). Positions are the
// element centers in % of the 16:9 decor frame (same frame as DeskPage's DESK_DECOR),
// measured from the 3840x1906 Figma frame: frame height 1906 -> 16:9 width 3388.44,
// centered at x offset 225.78.
type StickerId = 'work-tape' | 'spin-tape' | 'todo-note';

const STICKERS: { id: StickerId; x: number; y: number }[] = [
  { id: 'work-tape', x: 40.1, y: 18.98 },
  { id: 'spin-tape', x: 79.92, y: 74.17 },
  { id: 'todo-note', x: 6.37, y: 73.61 },
];

type Offset = { x: number; y: number };

// Module-level on purpose: survives DeskPage unmounting (visiting another page and coming
// back keeps where things were dragged), but a page reload resets it to the design layout.
const draggedOffsets = new Map<StickerId, Offset>();
const stackOrder: StickerId[] = STICKERS.map((sticker) => sticker.id);

function StickerContent({ id }: { id: StickerId }) {
  if (id === 'todo-note') {
    return (
      <div className="desk-sticker__note">
        <p className="desk-sticker__note-title">오늘 할 일</p>
        <ol className="desk-sticker__note-list">
          <li>끝내주게 밥먹기</li>
          <li>작살나게 잠자기</li>
          <li>숨쉬기 운동하기</li>
        </ol>
      </div>
    );
  }
  const isWork = id === 'work-tape';
  return (
    <div className={`desk-sticker__tape desk-sticker__tape--${isWork ? 'work' : 'spin'}`}>
      <span className="desk-sticker__tape-block" />
      <span className="desk-sticker__tape-text">{isWork ? '눌러봐!' : '돌려봐!'}</span>
    </div>
  );
}

export function DeskStickers({ entranceClass }: { entranceClass: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState(() => new Map(draggedOffsets));
  const [order, setOrder] = useState(() => [...stackOrder]);
  const dragRef = useRef<{ id: StickerId; startX: number; startY: number; origin: Offset } | null>(null);

  const bringToFront = (id: StickerId) => {
    const index = stackOrder.indexOf(id);
    if (index >= 0) stackOrder.splice(index, 1);
    stackOrder.push(id);
    setOrder([...stackOrder]);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: StickerId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      origin: draggedOffsets.get(id) ?? { x: 0, y: 0 },
    };
    bringToFront(id);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const layer = layerRef.current;
    if (!drag || !layer) return;
    const rect = layer.getBoundingClientRect();
    const next = {
      x: drag.origin.x + ((event.clientX - drag.startX) / rect.width) * 100,
      y: drag.origin.y + ((event.clientY - drag.startY) / rect.height) * 100,
    };
    draggedOffsets.set(drag.id, next);
    setOffsets(new Map(draggedOffsets));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div ref={layerRef} className={`desk-stickers ${entranceClass}`}>
      {STICKERS.map(({ id, x, y }) => {
        const offset = offsets.get(id) ?? { x: 0, y: 0 };
        return (
          <div
            key={id}
            className={`desk-sticker desk-sticker--${id}`}
            style={{
              left: `${x + offset.x}%`,
              top: `${y + offset.y}%`,
              zIndex: order.indexOf(id) + 1,
            } as CSSProperties}
            onPointerDown={(event) => handlePointerDown(event, id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="desk-sticker__entrance">
              <StickerContent id={id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
