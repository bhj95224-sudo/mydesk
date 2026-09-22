export type Project = {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  accent: string;
  theme: 'beplain' | 'sulwhasoo' | 'hourtention' | 'jaduya';
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
    theme: 'beplain',
  },
  {
    id: 'sulwhasoo',
    name: 'Sulwhasoo',
    displayName: '설화수',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#ee7729',
    theme: 'sulwhasoo',
  },
  {
    id: 'hourtention',
    name: 'hourtention',
    displayName: 'hourtention',
    category: 'PROJECT',
    description: '프로젝트 소개 문구와 담당 범위를 입력할 예정입니다.',
    accent: '#a875ff',
    theme: 'hourtention',
  },
  {
    id: 'jaduya',
    name: '자두야',
    displayName: '자두야',
    category: 'MOBILE APP',
    description: '혼자 사는 사람의 생활 관리를 돕는 모바일 서비스입니다. 포트폴리오에 표시할 개인 기여 범위는 확정 후 추가합니다.',
    accent: '#b43936',
    theme: 'jaduya',
  },
];
