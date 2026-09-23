export type TabletPlaceholderSize = 'large' | 'medium' | 'small';

export interface TabletPlaceholderItem {
  id: string;
  label: string;
  size: TabletPlaceholderSize;
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
  spawnX: number;
  spawnOffsetY: number;
  spawnDelay: number;
}

export const tabletPlaceholders: TabletPlaceholderItem[] = [
  {
    id: 'tablet-work-large',
    label: '큰 작업물 자리 표시자',
    size: 'large',
    width: 420,
    height: 280,
    left: 180,
    top: 120,
    rotation: -5,
    spawnX: 0.27,
    spawnOffsetY: 70,
    spawnDelay: 0,
  },
  {
    id: 'tablet-work-medium',
    label: '중간 작업물 자리 표시자',
    size: 'medium',
    width: 340,
    height: 220,
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
    size: 'small',
    width: 260,
    height: 180,
    left: 1360,
    top: 170,
    rotation: -2,
    spawnX: 0.78,
    spawnOffsetY: 440,
    spawnDelay: 260,
  },
];
