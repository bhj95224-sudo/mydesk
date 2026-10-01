export type TabletPlaceholderSize = 'large' | 'medium' | 'small';

export interface TabletPhysicsItemBase {
  id: string;
  label: string;
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
  spawnX: number;
  spawnOffsetY: number;
  spawnDelay: number;
}

export interface TabletPlaceholderItem extends TabletPhysicsItemBase {
  kind: 'placeholder';
  size: TabletPlaceholderSize;
  // Card design. Once set, the card becomes clickable (hover grow + opens the preview
  // window); cards without one stay plain placeholders.
  src?: string;
  // Preview window copy/image for this card. previewSrc defaults to src.
  previewEyebrow?: string;
  previewTitle?: string;
  previewSrc?: string;
  previewAlt?: string;
  previewImages?: { src: string; alt: string }[];
  previewTone?: 'olive' | 'sky';
}

export interface TabletImageItem extends TabletPhysicsItemBase {
  kind: 'image';
  src: string;
}

export type TabletPhysicsItem = TabletPlaceholderItem | TabletImageItem;

const TABLET_PLACEHOLDER_WIDTH = 450;
const TABLET_PLACEHOLDER_HEIGHT = 300;

export const tabletPlaceholders: TabletPlaceholderItem[] = [
  {
    id: 'tablet-work-large',
    label: '큰 작업물 자리 표시자',
    kind: 'placeholder',
    size: 'large',
    width: TABLET_PLACEHOLDER_WIDTH,
    height: TABLET_PLACEHOLDER_HEIGHT,
    left: 180,
    top: 120,
    rotation: -5,
    spawnX: 0.27,
    spawnOffsetY: 70,
    spawnDelay: 0,
    src: '/assets/tablet/storyboard-preview.png',
    previewEyebrow: 'STORYBOARD',
    previewTitle: 'Sulwhasoo',
    previewAlt: '한국 홍보 영상 스토리보드 전체 이미지',
  },
  {
    id: 'tablet-work-medium',
    label: '중간 작업물 자리 표시자',
    kind: 'placeholder',
    size: 'medium',
    width: TABLET_PLACEHOLDER_WIDTH,
    height: TABLET_PLACEHOLDER_HEIGHT,
    left: 760,
    top: 470,
    rotation: 4,
    spawnX: 0.53,
    spawnOffsetY: 260,
    spawnDelay: 130,
    src: '/assets/tablet/jaduya-illustration-4.png',
    previewEyebrow: 'ILLUSTRATION',
    previewTitle: '자두야',
    previewTone: 'olive',
    previewImages: [
      { src: '/assets/tablet/jaduya-illustration-4.png', alt: '자두야 로고 디자인 아이디어와 적용안' },
      { src: '/assets/tablet/jaduya-illustration-3.png', alt: '자두야 캐릭터와 아이콘 디자인 과정' },
    ],
  },
  {
    id: 'tablet-work-small',
    label: '작은 작업물 자리 표시자',
    kind: 'placeholder',
    size: 'small',
    width: TABLET_PLACEHOLDER_WIDTH,
    height: TABLET_PLACEHOLDER_HEIGHT,
    left: 1360,
    top: 170,
    rotation: -2,
    spawnX: 0.78,
    spawnOffsetY: 440,
    spawnDelay: 260,
    src: '/assets/tablet/screen-background.png',
    previewEyebrow: 'ILLUSTRATION',
    previewTitle: '자두야',
    previewAlt: '하늘과 구름, 언덕과 꽃밭이 그려진 배경 일러스트',
    previewTone: 'sky',
  },
];

export const tabletImageItems: TabletImageItem[] = [
  {
    id: 'tablet-object-coffee',
    label: '아이스 커피 오브젝트',
    kind: 'image',
    src: '/assets/tablet/coffee.png',
    width: 225,
    height: 270,
    left: 40,
    top: 620,
    rotation: -7,
    spawnX: 0.12,
    spawnOffsetY: 120,
    spawnDelay: 60,
  },
  {
    id: 'tablet-object-youtube',
    label: '유튜브 오브젝트',
    kind: 'image',
    src: '/assets/tablet/youtube.png',
    width: 258,
    height: 190,
    left: 620,
    top: 110,
    rotation: 5,
    spawnX: 0.38,
    spawnOffsetY: 220,
    spawnDelay: 150,
  },
  {
    id: 'tablet-object-mouse',
    label: '마우스 오브젝트',
    kind: 'image',
    src: '/assets/tablet/mouse.png',
    width: 255,
    height: 255,
    left: 1180,
    top: 580,
    rotation: -4,
    spawnX: 0.64,
    spawnOffsetY: 340,
    spawnDelay: 240,
  },
  {
    id: 'tablet-object-shiba',
    label: '시바견 오브젝트',
    kind: 'image',
    src: '/assets/tablet/shiba.png',
    width: 300,
    height: 253,
    left: 1430,
    top: 560,
    rotation: 6,
    spawnX: 0.88,
    spawnOffsetY: 220,
    spawnDelay: 150,
  },
  {
    id: 'tablet-object-card-click-bubble',
    label: '카드 클릭하기 말풍선 오브젝트',
    kind: 'image',
    // 1830x794 source, scaled to the other objects' footprint.
    src: '/assets/tablet/card-click-bubble.webp',
    width: 300,
    height: 130,
    left: 900,
    top: 380,
    rotation: -4,
    spawnX: 0.47,
    spawnOffsetY: 380,
    spawnDelay: 200,
  },
];

export const tabletPhysicsItems: TabletPhysicsItem[] = [
  ...tabletPlaceholders,
  ...tabletImageItems,
];
