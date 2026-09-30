import type { CSSProperties } from 'react';

// Speech bubbles for the desk-page decor objects (Figma frames 232:247, 244:165). Positions
// are the balloon centers in % of the same 16:9 decor frame as DeskPage's DESK_DECOR (from
// the 3840x1906 Figma frame: 16:9 width 3388.44, x offset 225.78). Always mounted; the
// is-visible class drives the slide-down-in / fade-out transition (see .desk-bubble in
// global.css).
export type DeskBubbleId = 'opal' | 'coffee' | 'marimo' | 'vscode-book' | 'figma-book';

// How long a clicked bubble stays up. Shared with the sticker bubbles (DeskStickers) so
// every desk-page bubble behaves the same.
export const BUBBLE_VISIBLE_MS = 2600;

// width: balloon width in Figma px (the 229 default, or the narrower/wider unions);
// textLeft: the label's left inset in the balloon.
const BUBBLES: { id: DeskBubbleId; x: number; y: number; text: string; src: string; width?: number; textLeft: number }[] = [
  { id: 'opal', x: 17.11, y: 15.95, text: '제일 좋아하는 보석', src: '/assets/desk-decor/bubble-opal.svg', textLeft: 32 },
  { id: 'coffee', x: 27.26, y: 23.45, text: '하루에 한 잔 필수!', src: '/assets/desk-decor/bubble-coffee.svg', textLeft: 36 },
  { id: 'marimo', x: 82.89, y: 42.1, text: '우리집 마리모 ✨', src: '/assets/desk-decor/bubble-marimo.svg', textLeft: 47 },
  { id: 'vscode-book', x: 14.172, y: 38.877, text: '커피 친구☕', src: '/assets/desk-decor/bubble-gray.svg', width: 198, textLeft: 48 },
  { id: 'figma-book', x: 67.169, y: 22.403, text: '이번엔 뭘 만들까?🎉', src: '/assets/desk-decor/bubble-figma-book.svg', width: 227.5, textLeft: 26 },
];

export function DeskBubbles({ visible }: { visible: Partial<Record<DeskBubbleId, boolean>> }) {
  return (
    <div className="desk-bubbles" aria-live="polite">
      {BUBBLES.map(({ id, x, y, text, src, width, textLeft }) => (
        <div
          key={id}
          className={`desk-bubble desk-bubble--${id}${visible[id] ? ' is-visible' : ''}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            ...(width ? { '--balloon-width': width } : {}),
            '--balloon-text-left': textLeft,
          } as CSSProperties}
          aria-hidden={!visible[id]}
        >
          <div className="desk-bubble__motion">
            {id === 'marimo' && (
              <div className="desk-bubble__photo">
                <p>실제사진 들어갈 예정</p>
              </div>
            )}
            <div className="desk-bubble__balloon">
              <img src={src} alt="" />
              <span>{text}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
