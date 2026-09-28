import { StickyNote, type Position } from './StickyNote';

export function HobbyNote({
  getInitialPosition,
  onClose,
}: {
  getInitialPosition: (element: HTMLElement) => Position;
  onClose: () => void;
}) {
  return (
    <StickyNote
      className="sticky-note--hobby"
      accent="#fbd7e6"
      ariaLabel="취미"
      getInitialPosition={getInitialPosition}
      onClose={onClose}
    >
      <h2 className="sticky-note__title">취미</h2>
      <p className="sticky-note__text">그림그리기 / 음악 듣기</p>
    </StickyNote>
  );
}
