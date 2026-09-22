export type DecorItem = {
  src: string;
  width: number;
  height: number;
  left: number;
  top: number;
  rotate?: number;
  flipY?: boolean;
};

export type Project = {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  accent: string;
  borderColor: string;
  theme: 'beplain' | 'sulwhasoo' | 'hourtention' | 'jaduya';
  /** CSS font-family stack matching the brand font assigned to this project in Figma. */
  titleFont: string;
  /** Middle/end stops of the page background tint gradient (white -> mid -> end), from Figma. */
  backgroundMid: string;
  backgroundEnd: string;
  /** Window content image exported from Figma. Undefined = plain color panel (design has no visual yet). */
  contentImage?: string;
  contentBg?: string;
  /** Floating decorative objects shown only while this project is active, at their Figma-specified position. */
  decor: DecorItem[];
};

// Copy and links are intentionally centralized here for later replacement with final case-study content.
export const projects: Project[] = [
  {
    id: 'beplain',
    name: 'beplain',
    displayName: '비플레인',
    category: 'WEB REDESIGN',
    description: '리디자인이 필요한 웹페이지를 작업하였습니다. 비플레인은 브랜드 소개 페이지가 없었기 때문에 저만의 방식으로 디자인을 변경하였습니다.',
    accent: '#62d91d',
    borderColor: '#137139',
    theme: 'beplain',
    titleFont: '"WILDgag", "Pretendard", sans-serif',
    backgroundMid: '#ebfbe6',
    backgroundEnd: '#a9ffa9',
    contentImage: '/assets/projects/beplain-content.png',
    decor: [
      { src: '/assets/projects/beplain-swirl.png', width: 455, height: 449, left: 160, top: 245, rotate: -49.91 },
      { src: '/assets/projects/beplain-orb.png', width: 107, height: 108, left: 508, top: 652 },
      { src: '/assets/projects/beplain-star.svg', width: 233, height: 233, left: 347, top: 836 },
      { src: '/assets/projects/beplain-swirl.png', width: 420, height: 421, left: 1457, top: 796, rotate: -44.55 },
    ],
  },
  {
    id: 'sulwhasoo',
    name: 'Sulwhasoo',
    displayName: '설화수',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#ee7729',
    borderColor: '#713f13',
    theme: 'sulwhasoo',
    titleFont: '"Cormorant Garamond", Georgia, serif',
    backgroundMid: '#f5e0cc',
    backgroundEnd: '#ffc266',
    contentImage: '/assets/projects/sulwhasoo-content.png',
    decor: [
      { src: '/assets/projects/sulwhasoo-flower.png', width: 667, height: 636, left: 1261, top: 687, rotate: -129.31, flipY: true },
      { src: '/assets/projects/sulwhasoo-flower.png', width: 667, height: 636, left: 140, top: 499, rotate: -50.69 },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: 249, height: 249, left: 402, top: 460 },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: 166, height: 166, left: 1287, top: 917 },
    ],
  },
  {
    id: 'hourtention',
    name: 'hourtention',
    displayName: 'hourtention',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#a875ff',
    borderColor: '#391f84',
    theme: 'hourtention',
    titleFont: '"Cafe24 Ssurround", "Pretendard", sans-serif',
    backgroundMid: '#ffd9cc',
    backgroundEnd: '#dfa9ff',
    contentBg: '#c1b0f2',
    decor: [],
  },
  {
    id: 'jaduya',
    name: '자두야',
    displayName: '자두야',
    category: 'MOBILE APP',
    description: '혼자 사는 사람의 생활 관리를 돕는 모바일 서비스입니다. 포트폴리오에 표시할 개인 기여 범위는 확정 후 추가합니다.',
    accent: '#b43936',
    borderColor: '#7c0e0b',
    theme: 'jaduya',
    titleFont: '"KERIS KEDU", "Pretendard", sans-serif',
    backgroundMid: '#ffefc0',
    backgroundEnd: '#ff7979',
    contentImage: '/assets/projects/jaduya-content.png',
    decor: [],
  },
];
