import { forwardRef, useState } from 'react';
import type { FormEvent } from 'react';
import { StickyNote, type Position, type StickyNoteHandle } from './StickyNote';

const LINKS = [
  { label: '오픈카카오톡', href: 'https://open.kakao.com/o/sBsQAQPi', qr: '/assets/contact/kakao-qr.png' },
  { label: '커미션링크', href: 'https://crepe.cm/ko/@Magnolia3_', qr: '/assets/contact/crepe-qr.png' },
] as const;

// Where the inquiry goes. A form endpoint (e.g. Formspree's https://formspree.io/f/xxxx) is
// posted to as JSON; otherwise, with only an address, the visitor's mail app opens with the
// inquiry filled in.
const CONTACT_FORM_ENDPOINT = '';
const CONTACT_EMAIL = 'syeom0000@gmail.com';

type Status = 'idle' | 'sending' | 'sent' | 'mail-app' | 'error' | 'unconfigured';

// Module-level on purpose (like the desk stickers): the note unmounts with DeskPage, so this
// brings it back where it was -- position, folded or not, and whatever was typed -- after
// visiting another page. A page reload resets it.
const saved: {
  position: Position | null;
  collapsed: boolean;
  fields: { name: string; email: string; message: string; consent: boolean };
} = {
  position: null,
  collapsed: false,
  fields: { name: '', email: '', message: '', consent: false },
};

/** Closing the note: the next open starts at its default spot, unfolded (typed text stays). */
export function resetContactNoteLayout() {
  saved.position = null;
  saved.collapsed = false;
}

function clearSavedFields() {
  saved.fields = { name: '', email: '', message: '', consent: false };
}

type ContactNoteProps = {
  getInitialPosition: (element: HTMLElement) => Position;
  onClose: () => void;
};

export const ContactNote = forwardRef<StickyNoteHandle, ContactNoteProps>(function ContactNote({
  getInitialPosition,
  onClose,
}, ref) {
  const [status, setStatus] = useState<Status>('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const fields = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      message: String(data.get('message') ?? ''),
    };

    if (CONTACT_FORM_ENDPOINT) {
      setStatus('sending');
      try {
        const response = await fetch(CONTACT_FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(fields),
        });
        if (!response.ok) throw new Error(String(response.status));
        form.reset();
        clearSavedFields();
        setStatus('sent');
      } catch {
        setStatus('error');
      }
      return;
    }

    if (CONTACT_EMAIL) {
      const subject = `[포트폴리오 문의] ${fields.name}`;
      const body = [
        `이름: ${fields.name}`,
        `답장받을 이메일: ${fields.email}`,
        '',
        fields.message,
      ].join('\n');
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus('mail-app');
      return;
    }

    setStatus('unconfigured');
  };

  return (
    <StickyNote
      ref={ref}
      className="sticky-note--contact"
      accent="#f7ec9d"
      ariaLabel="연락 문의"
      getInitialPosition={(element) => saved.position ?? getInitialPosition(element)}
      onClose={onClose}
      initialCollapsed={saved.collapsed}
      onCollapsedChange={(collapsed) => { saved.collapsed = collapsed; }}
      onPositionChange={(position) => { saved.position = position; }}
    >
      <form
        className="contact-form"
        onSubmit={handleSubmit}
        onChange={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && target.name === 'consent') {
            saved.fields.consent = target.checked;
          } else if (
            (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
            && (target.name === 'name' || target.name === 'email' || target.name === 'message')
          ) {
            saved.fields[target.name] = target.value;
          }
        }}
      >
        <h2 className="contact-form__title">연락문의</h2>

        <label className="contact-form__field">
          <span className="contact-form__label">이름 (필수)</span>
          <input className="contact-form__input" name="name" type="text" autoComplete="name" required defaultValue={saved.fields.name} />
        </label>
        <label className="contact-form__field">
          <span className="contact-form__label">답장받을 이메일 (필수)</span>
          <input className="contact-form__input" name="email" type="email" autoComplete="email" required defaultValue={saved.fields.email} />
        </label>
        <label className="contact-form__field">
          <span className="contact-form__label">문의 내용 (필수)</span>
          <textarea
            className="contact-form__input contact-form__textarea"
            name="message"
            placeholder="함께하고 싶은 일과 희망 일정을 알려주세요."
            required
            defaultValue={saved.fields.message}
          />
        </label>

        <label className="contact-form__consent">
          <input type="checkbox" name="consent" required defaultChecked={saved.fields.consent} />
          <span>정보 전달하는 데에 동의합니다.</span>
        </label>
        <p className="contact-form__notice">개인정보나 민감한 정보는 적지 말아 주세요.</p>

        <button className="contact-form__submit" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? '보내는 중...' : '문의 보내기'}
        </button>
        {status !== 'idle' && status !== 'sending' && (
          <p className="contact-form__status" role="status">
            {status === 'sent' && '문의가 전달됐어요. 곧 답장드릴게요!'}
            {status === 'mail-app' && (
              <>
                메일 앱에 문의 내용이 채워졌어요. 보내기를 눌러 주세요. 메일 앱이 열리지 않으면{' '}
                <a className="contact-form__mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                로 직접 보내 주세요.
              </>
            )}
            {status === 'error' && '보내지 못했어요. 잠시 후 다시 시도하거나 아래 링크로 연락해 주세요.'}
            {status === 'unconfigured' && '아직 문의 받을 곳이 연결되지 않았어요. 아래 링크로 연락해 주세요.'}
          </p>
        )}
      </form>

      <div className="contact-links">
        <p className="contact-links__lead">다른 방법으로 연락하셔도 됩니다.</p>
        {LINKS.map((link) => (
          <div className="sticky-note__entry" key={link.href}>
            <p className="sticky-note__label">{link.label}</p>
            <img className="contact-links__qr" src={link.qr} alt={`${link.label} QR 코드`} width={1024} height={1024} />
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
      </div>
    </StickyNote>
  );
});
