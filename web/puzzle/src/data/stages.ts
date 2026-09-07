/* 난이도 프리셋. SPEC §4.6 — 무작위 생성이 아니라 고정 배치 + 무작위 blessing 부여.
   '.' = blocked, 'O' = normal, 'X' = distorted

   blessingCount 는 SPEC §4.5 에 따라 "보드에 동시에 존재하는 특수 석판 수"다.
   판 시작 시 배치하는 개수가 아니라, 매 시전 뒤 새로 얹히는 개수다.

   TODO(확인): 아래 배치·소환 횟수·교체 횟수·등급 기준선은 전부 SPEC §9 의 불확실
   항목이다. 원작 재현이 아니라 밸런싱 대상이므로 시뮬레이션 결과를 보고 조정한다.
   단계가 올라갈수록 왜곡이 늘고 소환 횟수가 빡빡해지는 방향만 지켰다. */

import type { StageConfig } from '../core/types';

export const STAGES: readonly StageConfig[] = [
  {
    id: 'stage-1',
    label: '1단계',
    width: 8,
    height: 7,
    layout: [
      '..OOOO..',
      '.OOOOOO.',
      'OOOOOOOO',
      'OOOOOOOO',
      'OOOOOOOO',
      '.OOOOOO.',
      '..OOOO..',
    ],
    charges: 15,
    rerolls: 3,
    blessingCount: 1,
    gradeThresholds: { 3: 11, 2: 13 },
  },
  {
    id: 'stage-2',
    label: '2단계',
    width: 8,
    height: 7,
    layout: [
      '..OOOO..',
      '.OOOOOO.',
      'OOXOOOOO',
      'OOOOOOOO',
      'OOOOOXOO',
      '.OOOOOO.',
      '..OOOO..',
    ],
    charges: 14,
    rerolls: 3,
    blessingCount: 1,
    gradeThresholds: { 3: 11, 2: 13 },
  },
  {
    id: 'stage-3',
    label: '3단계',
    width: 8,
    height: 7,
    layout: [
      '..OOOO..',
      '.OXOOOO.',
      'OOOOOOOO',
      'OOOOXOOO',
      'OOOOOOOO',
      '.OOOOOX.',
      '..OOOO..',
    ],
    charges: 14,
    rerolls: 2,
    blessingCount: 1,
    gradeThresholds: { 3: 11, 2: 13 },
  },
  {
    id: 'stage-4',
    label: '4단계',
    width: 8,
    height: 7,
    layout: [
      '..OXOO..',
      '.OOOOOX.',
      'OOOOOOOO',
      'XOOOOOOO',
      'OOOOOOOO',
      '.OXOOOO.',
      '..OOOX..',
    ],
    charges: 14,
    rerolls: 2,
    blessingCount: 1,
    gradeThresholds: { 3: 11, 2: 13 },
  },
  {
    id: 'stage-5',
    label: '5단계',
    width: 8,
    height: 7,
    layout: [
      '..OOXO..',
      '.XOOOOO.',
      'OOOOOOXO',
      'OOOXOOOO',
      'OOOOOOOX',
      '.OXOOOO.',
      '..OOOX..',
    ],
    charges: 14,
    rerolls: 2,
    blessingCount: 1,
    gradeThresholds: { 3: 11, 2: 13 },
  },
  {
    id: 'stage-6',
    label: '6단계',
    width: 10,
    height: 9,
    layout: [
      '...OXOO...',
      '..OOXOOO..',
      '.OOOOOOXO.',
      'OOXOOOOOOO',
      'OOOOOXOOOO',
      'OOOOOOOOXO',
      '.OXOOOOOO.',
      '..OOOXOO..',
      '...OXOO...',
    ],
    charges: 18,
    rerolls: 2,
    blessingCount: 1,
    gradeThresholds: { 3: 15, 2: 17 },
  },
  {
    id: 'stage-7',
    label: '7단계',
    /* 가운데가 뚫린 고리 모양. 지진·폭풍우처럼 한 줄을 훑는 정령이 빈 공간에서
       헛돌기 때문에, 앞 단계와 같은 수로는 풀리지 않는다. */
    width: 12,
    height: 11,
    layout: [
      '....OXOO....',
      '..OOOXOOOO..',
      '.OOOOOOOXOO.',
      'OOXOOOOOOOXO',
      'OOOO....OOXO',
      'OOX......OOO',
      'OXOO....OOOO',
      'OOOOOOOXOOOO',
      '.OOXOOOOOOO.',
      '..OOOOOXOO..',
      '....OXOO....',
    ],
    charges: 22,
    rerolls: 3,
    blessingCount: 2,
    gradeThresholds: { 3: 19, 2: 21 },
  },
];

export function stageById(id: string): StageConfig | undefined {
  return STAGES.find((s) => s.id === id);
}
