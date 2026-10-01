export type KeyboardSkillKey = 'C' | 'V' | 'R' | 'F' | 'G' | 'I' | 'P';

export type KeyboardSkill = {
  title: string;
  usage: [string, string];
  accent: string;
  enabled?: boolean;
};

// Keep disabled skills here so their cards can be restored without rewriting the copy.
export const KEYBOARD_SKILLS: Record<KeyboardSkillKey, KeyboardSkill> = {
  C: {
    title: 'CLAUDE',
    usage: [
      '포트폴리오에 사용할 3D 모델을 제작하는 데 활용했습니다.',
      '화면 전환과 인터랙션을 구현할 때 코드 구조를 검토하고 오류 원인을 찾았습니다.',
    ],
    accent: '#FF772E',
  },
  V: {
    title: 'VS CODE',
    usage: [
      '책상, 모니터, 키보드, 태블릿 페이지의 코드를 작성하고 수정했습니다.',
      '실행 결과를 확인하며 오브젝트 위치와 동작을 조정했습니다.',
    ],
    accent: '#47ACFF',
    enabled: false,
  },
  R: {
    title: 'REACT',
    usage: [
      '책상 위 오브젝트를 누르면 각 페이지로 이동하도록 만들었습니다.',
      '프로젝트 창 전환과 키보드 카드 표시처럼 사용자 행동에 따라 바뀌는 화면을 구현했습니다.',
    ],
    accent: '#087EA4',
  },
  F: {
    title: 'FIGMA',
    usage: [
      '웹사이트와 앱의 화면을 디자인하고 개발 전에 레이아웃과 화면 흐름의 기초 틀을 만들었습니다.',
      '색상, 크기, 간격을 실제 화면에 적용할 때 디자인 기준으로 사용했습니다.',
    ],
    accent: '#FE4307',
  },
  G: {
    title: 'CHATGPT',
    usage: [
      '페이지별 움직임과 사용 흐름에 대한 아이디어를 구체화하고, 구현된 화면을 확인하며 코드 수정과 오류 해결에 활용했습니다.',
      '필요한 이미지를 정확하게 뽑아내기 위해 검증 기준과 프롬프트를 직접 작성했습니다.',
    ],
    accent: '#79DF6A',
  },
  I: {
    title: 'ILLUSTRATOR',
    usage: [
      '웹앱에 필요한 아이콘을 직접 제작했습니다.',
      '특히 앱에서 메인 화면으로 돌아가는 내비게이션 아이콘을 만들고 벡터 에셋으로 내보내 적용했습니다.',
    ],
    accent: '#E05D00',
  },
  P: {
    title: 'PHOTOSHOP',
    usage: [
      '작업에 필요한 이미지를 추출하고 일부를 편집하거나 색감을 보정했습니다.',
      '다듬은 이미지를 웹앱 화면에 적용했습니다.',
    ],
    accent: '#30A2FF',
  },
};
