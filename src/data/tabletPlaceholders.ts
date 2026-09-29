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
  src?: string;
}

export interface TabletImageItem extends TabletPhysicsItemBase {
  kind: 'image';
  src: string;
}

export type TabletPhysicsItem = TabletPlaceholderItem | TabletImageItem;

const TABLET_PLACEHOLDER_WIDTH = 420;
const TABLET_PLACEHOLDER_HEIGHT = 280;

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
];

export const tabletPhysicsItems: TabletPhysicsItem[] = [
  ...tabletPlaceholders,
  ...tabletImageItems,
];
