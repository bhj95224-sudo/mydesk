import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { gsap } from 'gsap';
import { KEYBOARD_SKILLS, type KeyboardSkillKey } from '../data/keyboardSkills';

// Animate directly on this section's own ref -- not inside a transformed container --
// because a transform on an ancestor becomes the containing block for this section's
// position: absolute placement (see the .project-progress containing-block bug from
// earlier in this project), which would break its fixed top/right positioning.
const DISTANCE = 90;
const ENTER_DURATION = 1.2;
const ENTER_EASE = 'power3.out';
const EXIT_DURATION = 0.8;
const EXIT_EASE = 'power2.inOut';

export function KeyboardSkillCard({
  skillKey,
  show = true,
  onExited,
}: {
  skillKey: KeyboardSkillKey;
  show?: boolean;
  onExited?: () => void;
}) {
  const skill = KEYBOARD_SKILLS[skillKey];
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (show) {
      gsap.set(el, { x: DISTANCE, opacity: 0 });
      const tween = gsap.to(el, { x: 0, opacity: 1, duration: ENTER_DURATION, ease: ENTER_EASE });
      return () => { tween.kill(); };
    }

    const tween = gsap.to(el, {
      x: DISTANCE,
      opacity: 0,
      duration: EXIT_DURATION,
      ease: EXIT_EASE,
      onComplete: () => onExited?.(),
    });
    return () => { tween.kill(); };
  }, [show, skillKey, onExited]);

  return (
    <section
      ref={sectionRef}
      className="keyboard-skill-card"
      aria-label={`${skill.title} 활용 정보`}
      style={{ '--skill-accent': skill.accent } as CSSProperties}
    >
      <h2 className="keyboard-skill-card__title">{skill.title}</h2>
      <div className="keyboard-skill-card__usage">
        {skill.usage.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
