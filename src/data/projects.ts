export type DecorItem = {
  src: string;
  width: number | string;
  height: number | string;
  /** Percentage of the page (relative to the 1920x1080 reference frame) so position holds across viewport sizes. */
  left: string;
  top: string;
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
  idleAccent: string;
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
    description: '리디자인이 필요한 웹페이지를 작업하였습니다.\n비플레인은 브랜드 소개 페이지가 없었기 때문에 저만의 방식으로\n디자인을 변경하였습니다.',
    accent: '#62d91d',
    idleAccent: '#D7F4BC',
    borderColor: '#137139',
    theme: 'beplain',
    titleFont: '"WILDgag", "Pretendard", sans-serif',
    backgroundMid: '#ebfbe6',
    backgroundEnd: '#a9ffa9',
    contentImage: '/assets/projects/beplain-content.png',
    decor: [
      { src: '/assets/projects/beplain-swirl.png', width: '40vh', height: '40vh', left: '11.09%', top: '25.00%', rotate: -49.91 },
      { src: '/assets/projects/beplain-orb.png', width: '7vh', height: '7vh', left: '27.81%', top: '57.87%' },
      { src: '/assets/projects/beplain-star.svg', width: '20vh', height: '20vh', left: '20.73%', top: '75.83%' },
      { src: '/assets/projects/beplain-swirl.png', width: '40vh', height: '40vh', left: '69.27%', top: '76.30%', rotate: -44.55 },
    ],
  },
  {
    id: 'sulwhasoo',
    name: 'Sulwhasoo',
    displayName: 'Sulwhasoo',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#ee7729',
    idleAccent: '#FCD3B7',
    borderColor: '#713f13',
    theme: 'sulwhasoo',
    titleFont: '"Cormorant Garamond", Georgia, serif',
    backgroundMid: '#f5e0cc',
    backgroundEnd: '#ffc266',
    contentImage: '/assets/projects/sulwhasoo-content.png',
    decor: [
      { src: '/assets/projects/sulwhasoo-flower.png', width: '61.73vh', height: '58.89vh', left: '66.41%', top: '59.78%', rotate: -129.31, flipY: true },
      { src: '/assets/projects/sulwhasoo-flower.png', width: '61.73vh', height: '58.89vh', left: '8.02%', top: '42.37%', rotate: -50.69 },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: '23.06vh', height: '23.06vh', left: '21.67%', top: '38.76%' },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: '15.37vh', height: '15.37vh', left: '67.76%', top: '81.07%' },
    ],
  },
  {
    id: 'hourtention',
    name: 'hourtention',
    displayName: 'hourtention',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#a875ff',
    idleAccent: '#E4D6FD',
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
    idleAccent: '#E8C3C2',
    borderColor: '#7c0e0b',
    theme: 'jaduya',
    titleFont: '"KERIS KEDU", "Pretendard", sans-serif',
    backgroundMid: '#ffefc0',
    backgroundEnd: '#ff7979',
    contentImage: '/assets/projects/jaduya-content.png',
    decor: [],
  },
];

