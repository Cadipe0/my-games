/* 무한모드 — 15×15 고정 판에서 라운드를 이어 간다.

   고정 배치인 일반 단계(stages.ts)와 달리 판을 그때그때 찍어낸다.
   손으로 15×15 배치를 라운드마다 짤 수는 없기 때문이다.
   Rng 를 주입받으므로 시드가 같으면 같은 판이 나온다 — 엔진과 같은 규칙이다.

   규칙 (사용자 확정)
   · 1라운드는 왜곡 0개. 라운드가 오를 때마다 3개씩 늘어난다.
   · 왜곡 위치는 매 라운드 무작위.
   · 소환 횟수가 곧 3성 기준선이다. 다 쓰면 그대로 실패고 판이 끝난다.
     "3성으로 못 깨면 게임오버"를 따로 만들지 않고 이 한 줄로 표현한다. */

import { shuffled, type Rng } from '../core/rng';
import type { StageConfig } from '../core/types';

export const ENDLESS_ID = 'endless';

/** 판 한 변의 칸 수 */
export const ENDLESS_SIZE = 15;

/** 라운드마다 늘어나는 왜곡 석판 수 */
export const ENDLESS_DISTORTED_STEP = 3;

/** 왜곡이 판을 뒤덮어 손쓸 수 없어지는 걸 막는 상한 (판의 40%) */
export const ENDLESS_DISTORTED_MAX = Math.floor(ENDLESS_SIZE * ENDLESS_SIZE * 0.4);

/** 소환 횟수 = 남은 석판 ÷ 이 값. 시뮬레이션으로 맞춘 수다. */
export const ENDLESS_CHARGE_DIVISOR = 3.4;

/** 판이 작아져도 최소한 이만큼은 준다 */
export const ENDLESS_MIN_CHARGES = 10;

/** 그 라운드의 왜곡 석판 수 */
export function distortedCountAt(round: number): number {
  return Math.min(ENDLESS_DISTORTED_MAX, Math.max(0, round - 1) * ENDLESS_DISTORTED_STEP);
}

/** 라운드 하나의 판을 만든다. round 는 1부터. */
export function endlessStage(round: number, rng: Rng): StageConfig {
  const size = ENDLESS_SIZE;
  const total = size * size;
  const distorted = distortedCountAt(round);

  const cells: string[] = new Array<string>(total).fill('O');
  const spots = shuffled(
    rng,
    Array.from({ length: total }, (_, i) => i),
  ).slice(0, distorted);
  for (const i of spots) cells[i] = 'X';

  const layout: string[] = [];
  for (let y = 0; y < size; y++) layout.push(cells.slice(y * size, (y + 1) * size).join(''));

  const normals = total - distorted;
  const charges = Math.max(ENDLESS_MIN_CHARGES, Math.ceil(normals / ENDLESS_CHARGE_DIVISOR));

  return {
    id: ENDLESS_ID,
    label: `무한 ${round}라운드`,
    width: size,
    height: size,
    layout,
    charges,
    rerolls: 3,
    blessingCount: 2,
    // 소환 횟수 안에 끝내면 무조건 3성이다. 못 끝내면 실패라 등급 자체가 없다.
    gradeThresholds: { 3: charges, 2: charges },
  };
}
