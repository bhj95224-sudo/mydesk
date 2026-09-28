import { forwardRef } from 'react';
import { StickyNote, type Position, type StickyNoteHandle } from './StickyNote';

const LINKS = [
  { label: '오픈카카오톡', href: 'https://open.kakao.com/o/sBsQAQPi' },
  { label: '커미션링크', href: 'https://crepe.cm/ko/@Magnolia3_' },
] as const;

type ContactNoteProps = {
  getInitialPosition: (element: HTMLElement) => Position;
  onClose: () => void;
  onPlus?: () => void;
};

export const ContactNote = forwardRef<StickyNoteHandle, ContactNoteProps>(function ContactNote({
  getInitialPosition,
  onClose,
  onPlus,
}, ref) {
  return (
    <StickyNote
      ref={ref}
      className="sticky-note--contact"
      accent="#f7ec9d"
      ariaLabel="연락 문의"
      getInitialPosition={getInitialPosition}
      onClose={onClose}
      onPlus={onPlus}
    >
      <h2 className="sticky-note__title">연락문의</h2>
      {LINKS.map((link) => (
        <div className="sticky-note__entry" key={link.href}>
          <p className="sticky-note__label">{link.label}</p>
          <a
            className="sticky-note__link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.href}
          </a>
        </div>
      ))}
    </StickyNote>
  );
});
