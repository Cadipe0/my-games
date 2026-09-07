/* 손패 카드에 붙는 범위 미리보기 (SPEC §6).

   글로만 "X자 — 양 대각선 전체"라고 적으면 머릿속에서 그려야 한다.
   7×7 축소판에 실제 범위를 찍어 한눈에 알아보게 한다.
   범위는 core 의 getRange 를 그대로 쓰므로 실제 판정과 어긋날 수 없다.

   색 규칙 — 확정으로 부수는 칸은 빨강, 확률로만 부수는 칸은 회색.
   회색은 진할수록 확률이 높다(거리 감쇠 정령은 바깥으로 갈수록 옅어진다). */

import { chanceAt, getRange, SPIRITS } from '../core/spirits';
import type { SpiritCard } from '../core/types';
import css from './ui.module.css';

/** 홀수여야 가운데 칸이 생긴다. 가로 한 줄·대각선 전체를 읽기에 7이면 충분하다 */
const N = 7;
const MID = (N - 1) / 2;

/** 벼락은 범위가 없다. "지정한 칸 + 흩어진 무작위"를 고정된 자리로 흉내 낸다 */
const BOLT_SCATTER: ReadonlyArray<[number, number]> = [
  [1, 0],
  [5, 1],
  [0, 4],
  [4, 5],
  [6, 6],
];

interface Mark {
  certain: boolean;
  /** 확률 칸일 때의 확률 [0,1] */
  chance: number;
}

export function RangeMini({ card }: { card: SpiritCard }) {
  const def = SPIRITS[card.id];
  const center = { x: MID, y: MID };
  const marks = new Map<string, Mark>();

  if (def.range === null) {
    // 벼락: 지정한 칸은 확정, 나머지는 무작위라 확률 칸으로 둔다
    marks.set(`${MID},${MID}`, { certain: true, chance: 1 });
    for (const [x, y] of BOLT_SCATTER) marks.set(`${x},${y}`, { certain: false, chance: 0.35 });
  } else {
    for (const p of getRange(card, center, { width: N, height: N })) {
      const isCenter = p.x === MID && p.y === MID;
      const certain = isCenter || card.level >= 2;
      marks.set(`${p.x},${p.y}`, { certain, chance: certain ? 1 : chanceAt(def, center, p) });
    }
  }

  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const m = marks.get(`${x},${y}`);
      cells.push(
        <span
          key={`${x},${y}`}
          className={[
            css.miniCell,
            m === undefined ? '' : m.certain ? css.miniCertain : css.miniChance,
          ]
            .filter(Boolean)
            .join(' ')}
          // 확률 칸은 확률만큼 진하게. 확정 칸은 늘 또렷하다.
          style={m !== undefined && !m.certain ? { opacity: 0.3 + m.chance * 0.7 } : undefined}
        />,
      );
    }
  }

  return (
    <span className={css.mini} aria-hidden="true">
      {cells}
    </span>
  );
}
