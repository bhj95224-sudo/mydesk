export type DecorItem = {
  src: string;
  width: number | string;
  height: number | string;
  /** Original 1920x1080 page coordinates; ProjectDecor rebases them to the monitor screen. */
  left: string;
  top: string;
  rotate?: number;
  flipY?: boolean;
  /** Extra distance after viewport clamping, in reference-page pixels. */
  overflowOffsetX?: number;
  overflowOffsetY?: number;
};

export type Project = {
  id: string;
  enabled?: boolean;
  name: string;
  displayName: string;
  category: string;
  description: string;
  /** Optional second paragraph under the description, in muted gray. */
  note?: string;
  accent: string;
  idleAccent: string;
  borderColor: string;
  theme: 'beplain' | 'sulwhasoo' | 'hourtention' | 'jaduya';
  /** CSS font-family stack matching the brand font assigned to this project in Figma. */
  titleFont: string;
  /** Middle/end stops of the page background tint gradient (white -> mid -> end), from Figma. */
  backgroundMid: string;
  backgroundEnd: string;
  /** Left-edge scroll/position indicator colors, sampled from Figma mockups. */
  progressTrack: string;
  progressSegment: string;
  /** Window content image exported from Figma. Undefined = plain color panel (design has no visual yet). */
  contentImage?: string;
  contentVideo?: string;
  contentBg?: string;
  externalUrl?: string;
  /** Color blocks of the "프로젝트 보러가기" / "기획서 보러가기" tapes (top, bottom). */
  tapeColors?: [string, string];
  /** Hide the "기획서 보러가기" tape (proposal not ready yet); its slot is kept so the other tape stays put. */
  hideProposalTape?: boolean;
  /** In-app route of the proposal ("기획서") page opened by the "기획서 보러가기" tape. */
  proposalHref?: string;
  /** Floating decorative objects shown only while this project is active, at their Figma-specified position. */
  decor: DecorItem[];
};

// Copy and links are intentionally centralized here for later replacement with final case-study content.
const projectCatalog: Project[] = [
  {
    id: 'sulwhasoo',
    name: 'Sulwhasoo',
    displayName: 'Sulwhasoo',
    category: 'PROJECT',
    description: '한국의 전통성과 예술성, 설화수만의 뚜렷한 정체성과 오래도록\n이어져온 브랜드의 역사를 더욱 표현하고자 리디자인한 프로젝트\n입니다.',
    accent: '#ee7729',
    idleAccent: '#FCD3B7',
    borderColor: '#c6ad96',
    theme: 'sulwhasoo',
    titleFont: '"Cormorant Garamond", Georgia, serif',
    backgroundMid: '#f5e0cc',
    backgroundEnd: '#ffc266',
    progressTrack: '#DFC4B3',
    progressSegment: '#E37D34',
    contentImage: '/assets/projects/sulwhasoo-project-preview.jpeg',
    contentVideo: '/assets/projects/sulwhasoo-preview.mp4',
    externalUrl: 'https://harperppppppp.github.io/sulwhasoo/',
    tapeColors: ['#FF932D', '#E8B171'],
    proposalHref: '#/sulwhasoo-proposal',
    decor: [
      { src: '/assets/projects/sulwhasoo-flower.png', width: '61.73vh', height: '58.89vh', left: '66.41%', top: '67.78%', rotate: -129.31, flipY: true, overflowOffsetX: 270, overflowOffsetY: 310 },
      { src: '/assets/projects/sulwhasoo-flower.png', width: '61.73vh', height: '58.89vh', left: '8.02%', top: '50.37%', rotate: -50.69 },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: '23.06vh', height: '23.06vh', left: '21.67%', top: '38.76%' },
      { src: '/assets/projects/sulwhasoo-sprig.png', width: '15.37vh', height: '15.37vh', left: '67.76%', top: '81.07%' },
    ],
  },
  {
    id: 'jaduya',
    name: '자두야',
    displayName: '자두야',
    category: 'MOBILE APP',
    description: '혼자 사는 사람의 생활 관리를 돕는 모바일 서비스입니다. 자취에\n필요한 모든 것들을 한 앱에 담아 실용적이고 친근하게 다가갈 수\n있도록 디자인하고 개발하였습니다.',
    accent: '#b43936',
    idleAccent: '#E8C3C2',
    borderColor: '#e4908e',
    theme: 'jaduya',
    titleFont: '"KERIS KEDU", "Pretendard", sans-serif',
    backgroundMid: '#ffefc0',
    backgroundEnd: '#ff7979',
    progressTrack: '#F0AF64',
    progressSegment: '#B43936',
    contentImage: '/assets/projects/jaduya-content.png',
    contentVideo: '/assets/projects/jaduya-preview.mp4',
    externalUrl: 'https://jaduya.vercel.app/login',
    tapeColors: ['#DF4F4C', '#B4C62D'],
    hideProposalTape: true,
    // Positions converted from the Figma 3840x1906 frame (node 361:102) onto the 1920x1080 reference page.
    decor: [
      { src: '/assets/projects/jaduya-flower.png', width: '17.26vh', height: '17.26vh', left: '22.00%', top: '26.82%', rotate: 36.15 },
      { src: '/assets/projects/jaduya-plum.png', width: '14.50vh', height: '14.50vh', left: '80.56%', top: '50.05%', rotate: 157.86, flipY: true },
      { src: '/assets/projects/jaduya-sprout.png', width: '14.54vh', height: '14.54vh', left: '74.54%', top: '82.55%', rotate: -35.09 },
      { src: '/assets/projects/jaduya-character.svg', width: '24.38vh', height: '13.61vh', left: '29.41%', top: '78.88%' },
    ],
  },
  {
    id: 'beplain',
    name: 'beplain',
    displayName: '비플레인',
    category: 'WEB REDESIGN',
    description: '개인적으로도 매우 잘 쓰는 제품의 브랜드 소개 페이지가 없었기\n때문에 브랜드의 컬러와 저만의 스타일을 접목시켜 브랜드 소개\n페이지를 제작하였습니다.',
    note: '팀 프로젝트와 기존 작업 브랜드의 이미지가 겹치는 것이 많았기 때문에,\n제가 꾸준히 사용하던 브랜드를 골라 사이트 페이지를\n제작하게 되었습니다.',
    accent: '#62d91d',
    idleAccent: '#D7F4BC',
    borderColor: '#85a793',
    theme: 'beplain',
    titleFont: '"WILDgag", "Pretendard", sans-serif',
    backgroundMid: '#ebfbe6',
    backgroundEnd: '#a9ffa9',
    progressTrack: '#B5D59A',
    progressSegment: '#DF2684',
    contentImage: '/assets/projects/beplain-content.png',
    tapeColors: ['#FF9FC7', '#90FF00'],
    hideProposalTape: true,
    decor: [
      { src: '/assets/projects/beplain-swirl.png', width: '40vh', height: '40vh', left: '11.09%', top: '25.00%', rotate: -49.91 },
      { src: '/assets/projects/beplain-orb.png', width: '7vh', height: '7vh', left: '27.81%', top: '57.87%' },
      { src: '/assets/projects/beplain-star.svg', width: '20vh', height: '20vh', left: '20.73%', top: '75.83%' },
      { src: '/assets/projects/beplain-swirl.png', width: '40vh', height: '40vh', left: '69.27%', top: '76.30%', rotate: -44.55, overflowOffsetX: 180, overflowOffsetY: 130 },
    ],
  },
  {
    id: 'hourtention',
    enabled: false,
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
    progressTrack: '#F9BA8F',
    progressSegment: '#7145F0',
    contentBg: '#c1b0f2',
    decor: [],
  },
];

export const projects: Project[] = projectCatalog.filter((project) => project.enabled !== false);

