import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { BUBBLE_VISIBLE_MS } from './DeskBubbles';

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

// Speech bubble shown when a tape is clicked (Figma 244:165), same look/motion/duration as
// the decor-object bubbles (DeskBubbles). It hangs off the tape itself: its tail tip sits
// `along` Figma px from the tape's left end along the (rotated) top edge, `gap` Figma px
// straight above it -- both measured from the Figma frame -- so it keeps its place however
// long the tape is and follows the tape when dragged.
type TapeBubbleId = 'work-tape' | 'spin-tape';
const TAPE_BUBBLES: Record<TapeBubbleId, { along: number; gap: number; text: string; src: string }> = {
  'work-tape': { along: 140, gap: 33, text: '난 이동도 가능해!', src: '/assets/desk-decor/bubble-sticker-work.svg' },
  'spin-tape': { along: 500, gap: 52, text: '나도 이동할 수 있어', src: '/assets/desk-decor/bubble-sticker-spin.svg' },
};
// The note's bubble (Figma 244:165): 234.5-wide balloon at the note's left edge, its top
// 116 Figma px above the note's top (tail tip 18 px above the note).
const NOTE_BUBBLE = { text: '나도 되지롱...////', src: '/assets/desk-decor/bubble-note.svg', width: 234.5, textLeft: 46 };
// Press + release within this many px counts as a click (not a drag).
const CLICK_MOVE_THRESHOLD = 5;

// Module-level on purpose: survives DeskPage unmounting (visiting another page and coming
// back keeps where things were dragged), but a page reload resets it to the design layout.
const draggedOffsets = new Map<StickerId, Offset>();
const stackOrder: StickerId[] = STICKERS.map((sticker) => sticker.id);

function StickerContent({ id, bubbleVisible }: { id: StickerId; bubbleVisible: boolean }) {
  if (id === 'todo-note') {
    // The note clips its overflow, so the bubble sits beside it in this wrap.
    return (
      <div className="desk-sticker__note-wrap">
        <div className="desk-sticker__note">
          <p className="desk-sticker__note-title">오늘 할 일</p>
          <ol className="desk-sticker__note-list">
            <li>끝내주게 밥먹기</li>
            <li>작살나게 잠자기</li>
            <li>숨쉬기 운동하기</li>
          </ol>
        </div>
        <div
          className={`desk-bubble desk-bubble--note${bubbleVisible ? ' is-visible' : ''}`}
          style={{ '--balloon-width': NOTE_BUBBLE.width, '--balloon-text-left': NOTE_BUBBLE.textLeft } as CSSProperties}
          aria-hidden={!bubbleVisible}
        >
          <div className="desk-bubble__motion">
            <div className="desk-bubble__balloon">
              <img src={NOTE_BUBBLE.src} alt="" />
              <span>{NOTE_BUBBLE.text}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const isWork = id === 'work-tape';
  const bubble = TAPE_BUBBLES[id];
  // The wrap carries the tape's rotation (the tape itself clips its overflow, which would
  // cut the bubble off); the bubble is rotated back upright around its tail tip.
  return (
    <div
      className={`desk-sticker__tape-wrap desk-sticker__tape-wrap--${isWork ? 'work' : 'spin'}`}
      style={{ '--bubble-along': bubble.along, '--bubble-gap': bubble.gap } as CSSProperties}
    >
      <div className={`desk-sticker__tape desk-sticker__tape--${isWork ? 'work' : 'spin'}`}>
        <span className="desk-sticker__tape-block" />
        <span className="desk-sticker__tape-text">{isWork ? '아무거나 눌러봐!' : '책상을 돌려봐!'}</span>
      </div>
      <div
        className={`desk-bubble desk-bubble--sticker${bubbleVisible ? ' is-visible' : ''}`}
        aria-hidden={!bubbleVisible}
      >
        <div className="desk-bubble__motion">
          <div className="desk-bubble__balloon">
            <img src={bubble.src} alt="" />
            <span>{bubble.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeskStickers({ entranceClass }: { entranceClass: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState(() => new Map(draggedOffsets));
  const [order, setOrder] = useState(() => [...stackOrder]);
  const dragRef = useRef<{ id: StickerId; startX: number; startY: number; origin: Offset; moved: boolean } | null>(null);
  const [visibleBubbles, setVisibleBubbles] = useState<Partial<Record<StickerId, boolean>>>({});
  const bubbleTimersRef = useRef<Partial<Record<StickerId, number>>>({});

  // Same as DeskPage's showBubble: re-clicking restarts the timer.
  const showBubble = (id: StickerId) => {
    window.clearTimeout(bubbleTimersRef.current[id]);
    setVisibleBubbles((current) => ({ ...current, [id]: true }));
    bubbleTimersRef.current[id] = window.setTimeout(() => {
      setVisibleBubbles((current) => ({ ...current, [id]: false }));
    }, BUBBLE_VISIBLE_MS);
  };

  useEffect(() => () => {
    Object.values(bubbleTimersRef.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

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
      moved: false,
    };
    bringToFront(id);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const layer = layerRef.current;
    if (!drag || !layer) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_MOVE_THRESHOLD) {
      drag.moved = true;
    }
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
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.type === 'pointerup' && drag && !drag.moved) showBubble(drag.id);
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
              <StickerContent id={id} bubbleVisible={!!visibleBubbles[id]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
