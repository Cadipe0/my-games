/* 정령 데이터 테이블과 범위 계산. SPEC §4.4.
   범위 함수는 시전 지점을 포함해 보드 안쪽 좌표만 돌려준다.
   시전 지점을 확정 파괴로 따로 다루는 건 engine 의 몫이다. */

import type { BoardSize, Pos, SpiritCard, SpiritId, SpiritLevel } from './types';
import {
  BIG_BANG_FULL_DIAGONAL,
  DESTROY_CHANCE,
  DRAW_WEIGHT,
  FALLOFF_MIN,
  FALLOFF_STEP,
  RESONANCE_ARM,
  TWISTER_DIAGONAL_REACH,
} from '../data/config';

export type RangeFn = (center: Pos, size: BoardSize, level: SpiritLevel) => Pos[];

/** 타격 이펙트 계열 (SPEC §6). 규칙에는 영향을 주지 않고 화면 표현만 가른다.
 *  이름과 맞아떨어지게 묶었다 — 업화·분출은 불, 낙뢰·벼락은 번개, 하는 식이다. */
export type SpiritMotif = 'fire' | 'bolt' | 'blast' | 'wind' | 'earth' | 'water' | 'light';

export interface SpiritDef {
  id: SpiritId;
  /** 한국어 이름 (SPEC §10 — 이름은 한국어 그대로 써도 무방) */
  name: string;
  /** 벼락처럼 범위 개념이 없으면 null (SPEC §4.4 특수 규칙) */
  range: RangeFn | null;
  /** 1레벨 파괴 확률 [0,1]. 시전 지점에는 적용되지 않는다 */
  destroyChance: number;
  /** 참이면 시전 지점에서 멀수록 확률이 떨어진다 (destroyChance 대신 쓰인다) */
  falloff: boolean;
  /** 일반 드로우 가중치(%). 0이면 일반 풀에 없다 (신비 전용) */
  drawWeight: number;
  /** 왜곡 석판을 파괴할 수 있는가 (SPEC §4.3) */
  canDestroyDistorted: boolean;
  /** 강화 대상인가 (SPEC §4.4 — erupt, resonance 는 항상 레벨 1) */
  upgradable: boolean;
  /** 부술 때 어떤 모습으로 터지는가. 규칙과 무관한 표현용이다 */
  motif: SpiritMotif;
}

/* ---------- 범위 계산 헬퍼 ---------- */

function inBounds(p: Pos, size: BoardSize): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < size.width && p.y < size.height;
}

/** 보드 밖으로 나가는 부분은 그냥 버린다 (SPEC §4.3 — 잘려도 페널티 없음) */
function clip(cells: Pos[], size: BoardSize): Pos[] {
  const seen = new Set<string>();
  const out: Pos[] = [];
  for (const p of cells) {
    if (!inBounds(p, size)) continue;
    const key = p.x + ',' + p.y;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** 맨해튼 거리 r 이내 (마름모) */
function diamond(r: number): RangeFn {
  return (center, size) => {
    const cells: Pos[] = [];
    for (let dy = -r; dy <= r; dy++) {
      const span = r - Math.abs(dy);
      for (let dx = -span; dx <= span; dx++) {
        cells.push({ x: center.x + dx, y: center.y + dy });
      }
    }
    return clip(cells, size);
  };
}

/** 체비쇼프 거리 r 이내 (정사각) */
function square(r: number): RangeFn {
  return (center, size) => {
    const cells: Pos[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        cells.push({ x: center.x + dx, y: center.y + dy });
      }
    }
    return clip(cells, size);
  };
}

/** 가로 한 줄 전체 */
const fullRow: RangeFn = (center, size) => {
  const cells: Pos[] = [];
  for (let x = 0; x < size.width; x++) cells.push({ x, y: center.y });
  return clip(cells, size);
};

/** 세로 한 줄 전체 */
const fullColumn: RangeFn = (center, size) => {
  const cells: Pos[] = [];
  for (let y = 0; y < size.height; y++) cells.push({ x: center.x, y });
  return clip(cells, size);
};

/** 십자. arm 이 0 이면 가로+세로 한 줄 전체, 아니면 팔 길이만큼 */
function cross(arm: number): RangeFn {
  return (center, size, level) => {
    if (arm <= 0) return clip([...fullRow(center, size, level), ...fullColumn(center, size, level)], size);
    const cells: Pos[] = [{ ...center }];
    for (let d = 1; d <= arm; d++) {
      cells.push({ x: center.x + d, y: center.y });
      cells.push({ x: center.x - d, y: center.y });
      cells.push({ x: center.x, y: center.y + d });
      cells.push({ x: center.x, y: center.y - d });
    }
    return clip(cells, size);
  };
}

/** X자. reach 가 0 이면 보드 끝까지 뻗는다 */
function diagonal(reach: number): RangeFn {
  return (center, size) => {
    const limit = reach > 0 ? reach : Math.max(size.width, size.height);
    const cells: Pos[] = [{ ...center }];
    for (let d = 1; d <= limit; d++) {
      cells.push({ x: center.x + d, y: center.y + d });
      cells.push({ x: center.x - d, y: center.y - d });
      cells.push({ x: center.x + d, y: center.y - d });
      cells.push({ x: center.x - d, y: center.y + d });
    }
    return clip(cells, size);
  };
}

/** 정화: 가로 3칸. 3레벨이면 위아래 1칸이 더 붙는다 (SPEC §4.3) */
const purifyRange: RangeFn = (center, size, level) => {
  const cells: Pos[] = [
    { x: center.x - 1, y: center.y },
    { x: center.x, y: center.y },
    { x: center.x + 1, y: center.y },
  ];
  if (level === 3) {
    cells.push({ x: center.x, y: center.y - 1 });
    cells.push({ x: center.x, y: center.y + 1 });
  }
  return clip(cells, size);
};

/** 분출: 지정한 1칸만 */
const singleCell: RangeFn = (center, size) => clip([{ ...center }], size);

/* ---------- 데이터 테이블 ---------- */

export const SPIRITS: Record<SpiritId, SpiritDef> = {
  blaze: {
    id: 'blaze',
    name: '업화',
    range: diamond(2),
    destroyChance: DESTROY_CHANCE.blaze,
    drawWeight: DRAW_WEIGHT.blaze,
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'fire',
  },
  bigBang: {
    id: 'bigBang',
    name: '대폭발',
    range: diagonal(BIG_BANG_FULL_DIAGONAL ? 0 : 1),
    destroyChance: DESTROY_CHANCE.bigBang,
    drawWeight: DRAW_WEIGHT.bigBang,
    falloff: true, // 거리 감쇠
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'blast',
  },
  bolt: {
    id: 'bolt',
    name: '벼락',
    range: null, // 위치 무관. 개수만 뽑는다 (SPEC §4.4)
    destroyChance: DESTROY_CHANCE.bolt,
    drawWeight: DRAW_WEIGHT.bolt,
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'bolt',
  },
  strike: {
    id: 'strike',
    name: '낙뢰',
    range: diamond(1),
    destroyChance: DESTROY_CHANCE.strike,
    drawWeight: DRAW_WEIGHT.strike,
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'bolt',
  },
  twister: {
    id: 'twister',
    name: '용오름',
    range: diagonal(TWISTER_DIAGONAL_REACH),
    destroyChance: DESTROY_CHANCE.twister,
    drawWeight: DRAW_WEIGHT.twister,
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'wind',
  },
  shockwave: {
    id: 'shockwave',
    name: '충격파',
    range: square(1),
    destroyChance: DESTROY_CHANCE.shockwave,
    drawWeight: DRAW_WEIGHT.shockwave,
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'blast',
  },
  quake: {
    id: 'quake',
    name: '지진',
    range: fullRow,
    destroyChance: DESTROY_CHANCE.quake,
    drawWeight: DRAW_WEIGHT.quake,
    falloff: true, // 거리 감쇠
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'earth',
  },
  tsunami: {
    id: 'tsunami',
    name: '해일',
    range: cross(0),
    destroyChance: DESTROY_CHANCE.tsunami,
    drawWeight: DRAW_WEIGHT.tsunami,
    falloff: true, // 거리 감쇠
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'water',
  },
  storm: {
    id: 'storm',
    name: '폭풍우',
    range: fullColumn,
    destroyChance: DESTROY_CHANCE.storm,
    drawWeight: DRAW_WEIGHT.storm,
    falloff: true, // 거리 감쇠
    canDestroyDistorted: false,
    upgradable: true,
    motif: 'wind',
  },
  purify: {
    id: 'purify',
    name: '정화',
    range: purifyRange,
    destroyChance: DESTROY_CHANCE.purify,
    drawWeight: DRAW_WEIGHT.purify,
    falloff: false, // 고정 확률
    canDestroyDistorted: true, // SPEC §4.3
    upgradable: true,
    motif: 'light',
  },
  erupt: {
    id: 'erupt',
    name: '분출',
    range: singleCell,
    destroyChance: DESTROY_CHANCE.erupt,
    drawWeight: DRAW_WEIGHT.erupt, // 0 — 신비 전용
    falloff: false, // 고정 확률
    canDestroyDistorted: false,
    upgradable: false, // SPEC §4.3
    motif: 'fire',
  },
  resonance: {
    id: 'resonance',
    name: '세계수의 공명',
    range: cross(RESONANCE_ARM),
    destroyChance: DESTROY_CHANCE.resonance,
    drawWeight: DRAW_WEIGHT.resonance, // 0 — 신비 전용
    falloff: false, // 고정 확률
    canDestroyDistorted: true, // SPEC §4.3
    upgradable: false,
    motif: 'light',
  },
};

/** 신비(mystery) 효과로만 등장하는 정령 2종 (SPEC §4.5) */
export const MYSTERY_SPIRITS: readonly SpiritId[] = ['erupt', 'resonance'];

/** 일반 드로우 풀. 가중치가 0보다 큰 정령만 들어간다 */
export const DRAW_POOL: readonly SpiritId[] = (
  Object.keys(SPIRITS) as SpiritId[]
).filter((id) => SPIRITS[id].drawWeight > 0);

export function getSpirit(id: SpiritId): SpiritDef {
  return SPIRITS[id];
}

/* 시전 지점에서 멀수록 떨어지는 확률.
   지진·폭풍우·대폭발·해일처럼 멀리 뻗는 정령에만 적용한다.
   거리는 체비쇼프로 잰다 — 가로 한 줄이면 |dx|, 세로면 |dy|,
   십자면 팔 길이, 대각선이면 대각 칸 수가 그대로 나온다. */
export function chanceAt(def: SpiritDef, center: Pos, p: Pos): number {
  if (!def.falloff) return def.destroyChance;
  const dist = Math.max(Math.abs(p.x - center.x), Math.abs(p.y - center.y));
  return Math.max(FALLOFF_MIN, 1 - FALLOFF_STEP * dist);
}

/** 카드가 실제로 때리는 칸들. 벼락은 범위가 없어 빈 배열 */
export function getRange(card: SpiritCard, center: Pos, size: BoardSize): Pos[] {
  const def = SPIRITS[card.id];
  if (def.range === null) return [];
  return def.range(center, size, card.level);
}

/** 강화할 수 있는가. 같은 id + 둘 다 3레벨 미만 + 강화 대상 (SPEC §4.4).
 *  레벨이 같을 필요는 없다 — Lv2 + Lv1 도 합쳐진다. */
export function canMerge(a: SpiritCard, b: SpiritCard): boolean {
  if (a.id !== b.id) return false;
  if (a.level >= 3 || b.level >= 3) return false;
  return SPIRITS[a.id].upgradable;
}

/** 두 장을 합친 결과 카드. 높은 쪽보다 한 단계 위가 되고 3레벨에서 멈춘다.
 *  Lv1+Lv1 → Lv2, Lv2+Lv1 → Lv3, Lv2+Lv2 → Lv3 */
export function merge(a: SpiritCard, b: SpiritCard): SpiritCard {
  if (!canMerge(a, b)) throw new Error('merge: 합칠 수 없는 조합');
  const level = Math.min(3, Math.max(a.level, b.level) + 1);
  return { id: a.id, level: level as SpiritLevel };
}
