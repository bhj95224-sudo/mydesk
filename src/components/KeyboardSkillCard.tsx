import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { gsap } from 'gsap';
import { KEYBOARD_SKILLS, type KeyboardSkillKey } from '../data/keyboardSkills';

const METRIC_ICONS = ['/assets/claude-proficiency.svg', '/assets/claude-project-usage.svg'] as const;

// Enter/exit motion tuned to match https://reactbits.dev/c/animations/animated-content
// (direction=horizontal, distance=90, duration=2.3, disappearEase=bounce.in). Animated
// directly on this section's own ref -- not wrapped in a separate transformed container --
// because a transform on an ancestor becomes the containing block for this section's
// position: absolute placement (see the .project-progress containing-block bug from
// earlier in this project), which would break its fixed top/right positioning.
const DISTANCE = 90;
const ENTER_DURATION = 1.2;
const ENTER_EASE = 'power3.out';
const EXIT_DURATION = 0.5;
const EXIT_EASE = 'bounce.in';

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
  const metrics = [
    { label: 'Proficiency', value: skill.proficiency, icon: METRIC_ICONS[0] },
    { label: 'Project Usage', value: skill.projectUsage, icon: METRIC_ICONS[1] },
  ];
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (show) {
      gsap.set(el, { x: DISTANCE, opacity: 0 });
      const tween = gsap.to(el, { x: 0, opacity: 1, duration: ENTER_DURATION, ease: ENTER_EASE });
      return () => { tween.kill(); };
    }

    // bounce.in on opacity as well would make it flicker (bounce eases overshoot/oscillate
    // before settling), so the bounce is only applied to the slide -- opacity fades smoothly
    // on its own timeline.
    const timeline = gsap.timeline({ onComplete: () => onExited?.() });
    timeline.to(el, { x: DISTANCE, duration: EXIT_DURATION, ease: EXIT_EASE }, 0);
    timeline.to(el, { opacity: 0, duration: EXIT_DURATION, ease: 'power1.in' }, 0);
    return () => { timeline.kill(); };
  }, [show, skillKey, onExited]);

  return (
    <section
      ref={sectionRef}
      className="keyboard-skill-card"
      aria-label={`${skill.title} 활용 정보`}
      style={{ '--skill-accent': skill.accent } as CSSProperties}
    >
      <h2 className="keyboard-skill-card__title">{skill.title}</h2>
      <div className="keyboard-skill-card__metrics">
        {metrics.map((metric) => (
          <div className="keyboard-skill-card__metric" key={metric.label}>
            <span
              className="keyboard-skill-card__icon"
              style={{ '--icon-mask': `url(${metric.icon})` } as CSSProperties}
              aria-hidden="true"
            />
            <span className="keyboard-skill-card__value">{metric.value}</span>
            <span className="keyboard-skill-card__label">{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
