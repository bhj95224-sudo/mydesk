// Speech bubbles for the desk-page decor objects (Figma frame 232:247). Positions are the
// bubble-group centers in % of the same 16:9 decor frame as DeskPage's DESK_DECOR (from the
// 3840x1906 Figma frame: 16:9 width 3388.44, x offset 225.78). Always mounted; the
// is-visible class drives the slide-down-in / fade-out transition (see .desk-bubble in
// global.css).
export type DeskBubbleId = 'opal' | 'coffee' | 'marimo';

const BUBBLES: { id: DeskBubbleId; x: number; y: number; text: string; color: string }[] = [
  { id: 'opal', x: 17.11, y: 15.95, text: '제일 좋아하는 보석', color: 'opal' },
  { id: 'coffee', x: 27.26, y: 23.45, text: '하루에 한 잔 필수!', color: 'coffee' },
  { id: 'marimo', x: 82.89, y: 42.1, text: '우리집 마리모 ✨', color: 'marimo' },
];

export function DeskBubbles({ visible }: { visible: Partial<Record<DeskBubbleId, boolean>> }) {
  return (
    <div className="desk-bubbles" aria-live="polite">
      {BUBBLES.map(({ id, x, y, text, color }) => (
        <div
          key={id}
          className={`desk-bubble desk-bubble--${id}${visible[id] ? ' is-visible' : ''}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-hidden={!visible[id]}
        >
          <div className="desk-bubble__motion">
            {id === 'marimo' && (
              <div className="desk-bubble__photo">
                <p>실제사진 들어갈 예정</p>
              </div>
            )}
            <div className="desk-bubble__balloon">
              <img src={`/assets/desk-decor/bubble-${color}.svg`} alt="" />
              <span>{text}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
