export type KeyboardSkillKey = 'C' | 'V' | 'R' | 'F' | 'G' | 'I' | 'P';

export type KeyboardSkill = {
  title: string;
  proficiency: string;
  projectUsage: string;
  accent: string;
};

// Accent colors mirror PRESSABLE_KEY_COLORS in createKeyboardModel.ts -- each key's card
// icons are tinted to match that key's own highlight color.
export const KEYBOARD_SKILLS: Record<KeyboardSkillKey, KeyboardSkill> = {
  C: { title: 'CLAUDE', proficiency: '80%', projectUsage: '85%', accent: '#FF772E' },
  V: { title: 'VS CODE', proficiency: '80%', projectUsage: '80%', accent: '#47ACFF' },
  R: { title: 'REACT', proficiency: '70%', projectUsage: '85%', accent: '#087EA4' },
  F: { title: 'FIGMA', proficiency: '80%', projectUsage: '90%', accent: '#FE4307' },
  G: { title: 'CHATGPT', proficiency: '80%', projectUsage: '85%', accent: '#79DF6A' },
  I: { title: 'ILLUSTRATOR', proficiency: '85%', projectUsage: '90%', accent: '#E05D00' },
  P: { title: 'PHOTOSHOP', proficiency: '85%', projectUsage: '90%', accent: '#30A2FF' },
};
