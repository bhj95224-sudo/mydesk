// Speech bubbles on the keyboard page (Figma frame 241:118). The frame is a 3840x1906
// capture of a 1920x953 viewport, so positions/sizes are Figma px scaled to the viewport
// (see .keyboard-bubble in global.css). Always mounted; is-visible drives the fade/slide.
export function KeyboardBubbles({ showClickHint, showSkillHint }: { showClickHint: boolean; showSkillHint: boolean }) {
  return (
    <div className="keyboard-bubbles" aria-live="polite">
      <div
        className={`keyboard-bubble keyboard-bubble--click${showClickHint ? ' is-visible' : ''}`}
        aria-hidden={!showClickHint}
      >
        <div className="keyboard-bubble__motion">
          <img src="/assets/keyboard-bubble-click.svg" alt="" />
          <span>키보드 클릭해봐!</span>
        </div>
      </div>
      <div
        className={`keyboard-bubble keyboard-bubble--skill${showSkillHint ? ' is-visible' : ''}`}
        aria-hidden={!showSkillHint}
      >
        <div className="keyboard-bubble__motion">
          <img src="/assets/keyboard-bubble-skill.svg" alt="" />
          <span>난 이런걸 할 수 있지✨</span>
        </div>
      </div>
    </div>
  );
}
