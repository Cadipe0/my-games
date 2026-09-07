/* SPEC §8 테스트 케이스.
   engine.ts 를 구현하기 전에 먼저 쓴다. 이 시점에는 전부 실패하는 게 정상이다.

   RNG 는 전부 주입한다. 확률에 기대지 않으려고
   · 확정 파괴가 일어나는 레벨 2 / 3 나 시전 지점을 쓰거나
   · 항상 0 을 돌려주는 RNG 로 판정을 고정한다. */

import { describe, expect, it } from 'vitest';

import { applyMove, reroll } from './engine';
import { createBoard, countOf, destroyAt } from './board';
import {
  distortedCountAt,
  endlessStage,
  ENDLESS_DISTORTED_MAX,
  ENDLESS_SIZE,
} from '../data/endless';
import type { Rng } from './rng';
import type {
  Blessing,
  Board,
  GameState,
  Pos,
  SpiritCard,
  SpiritId,
  SpiritLevel,
  StageConfig,
  Tile,
} from './types';

/* ---------- 테스트 도구 ---------- */

/** 항상 0. chance() 는 항상 통과하고, nextInt(a,b) 는 항상 a 가 된다 */
const ZERO_RNG: Rng = { next: () => 0 };

/** 정해둔 값을 순서대로 돌려준다 (끝나면 처음으로 돌아감) */
function seqRng(values: readonly number[]): Rng {
  let i = 0;
  return {
    next() {
      const v = values[i % values.length] ?? 0;
      i++;
      return v;
    },
  };
}

function card(id: SpiritId, level: SpiritLevel = 1): SpiritCard {
  return { id, level };
}

function stageOf(layout: string[], over: Partial<StageConfig> = {}): StageConfig {
  return {
    id: 'test',
    label: '테스트',
    width: (layout[0] ?? '').length,
    height: layout.length,
    layout,
    charges: 10,
    rerolls: 3,
    blessingCount: 0,
    gradeThresholds: { 3: 3, 2: 5 },
    ...over,
  };
}

/** blessing 은 무작위 부여가 아니라 테스트에서 직접 찍어 준다 */
function setBlessing(board: Board, p: Pos, blessing: Blessing): Board {
  const next = board.map((row) => row.map((t) => ({ ...t })));
  const row = next[p.y] as Tile[];
  row[p.x] = { kind: 'normal', blessing };
  return next;
}

interface StateOptions {
  hand?: [SpiritCard, SpiritCard];
  queue?: SpiritCard[];
  charges?: number;
  rerolls?: number;
  board?: Board;
}

function stateOf(layout: string[], opts: StateOptions = {}): GameState {
  const stage = stageOf(layout, { charges: opts.charges ?? 10, rerolls: opts.rerolls ?? 3 });
  return {
    board: opts.board ?? createBoard(stage),
    hand: opts.hand ?? [card('strike'), card('strike')],
    queue: opts.queue ?? [card('quake'), card('storm'), card('blaze'), card('purify')],
    chargesLeft: opts.charges ?? 10,
    rerollsLeft: opts.rerolls ?? 3,
    chargesUsed: 0,
    status: 'playing',
    stage,
    log: [],
  };
}

/* ---------- SPEC §8 ---------- */

describe('SPEC §8 — 파괴 판정', () => {
  it('3×3 보드 전체가 normal 일 때 shockwave 레벨 2를 중앙에 쓰면 9칸 전부 파괴된다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], { hand: [card('shockwave', 2), card('strike')] });

    const next = applyMove(state, { slot: 0, at: { x: 1, y: 1 } }, ZERO_RNG);

    expect(countOf(next.board, 'normal')).toBe(0);
    expect(countOf(next.board, 'empty')).toBe(9);
  });

  it('범위 안에 distorted 가 있고 레벨 2로 시전하면, 왜곡이 피격되어 normal 1~3개가 재생성된다', () => {
    // 5×5 전부 normal, (1,1) 만 왜곡. 충격파를 (2,2) 에 쓰면 (1..3, 1..3) 이 범위다.
    const layout = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const state = stateOf(layout, { hand: [card('shockwave', 2), card('strike')] });
    const before = countOf(state.board, 'normal'); // 24

    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, ZERO_RNG);

    // 범위 9칸 중 왜곡 1칸을 뺀 8칸이 파괴되고, 왜곡 피격으로 1~3개가 되살아난다
    const regen = next.log.at(-1)?.regenerated.length ?? 0;
    expect(regen).toBeGreaterThanOrEqual(1);
    expect(regen).toBeLessThanOrEqual(3);
    expect(countOf(next.board, 'normal')).toBe(before - 8 + regen);
    // 왜곡 자체는 파괴되지 않는다
    expect(countOf(next.board, 'distorted')).toBe(1);
  });

  it('같은 상황에서 레벨 3으로 시전하면 왜곡은 피격되지 않고 재생성도 없다', () => {
    const layout = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const state = stateOf(layout, { hand: [card('shockwave', 3), card('strike')] });
    const before = countOf(state.board, 'normal'); // 24

    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, ZERO_RNG);

    expect(countOf(next.board, 'normal')).toBe(before - 8);
    expect(countOf(next.board, 'distorted')).toBe(1);
  });

  it('purify 로 distorted 를 파괴하면 재생성이 일어나지 않는다', () => {
    const layout = ['OOO', 'OXO', 'OOO'];
    const state = stateOf(layout, { hand: [card('purify', 1), card('strike')] });
    const beforeNormal = countOf(state.board, 'normal'); // 8

    // 시전 지점을 왜곡 위에 두면 확정 파괴다
    const next = applyMove(state, { slot: 0, at: { x: 1, y: 1 } }, ZERO_RNG);

    expect(countOf(next.board, 'distorted')).toBe(0);
    // 재생성이 없으므로 normal 은 절대 늘지 않는다
    expect(countOf(next.board, 'normal')).toBeLessThanOrEqual(beforeNormal);
  });

  it('bolt 는 최소 1개를 부수고, 그 1개는 지정한 칸이다', () => {
    const layout = ['OOO', 'OOO', 'OOO'];
    const state = stateOf(layout, { hand: [card('bolt', 1), card('strike')] });

    // ZERO_RNG 면 nextInt(1, 3) 이 1 이라 "1개 파괴"가 나온다
    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, ZERO_RNG);

    expect(next.log.at(-1)?.destroyed).toEqual([{ x: 2, y: 2 }]);
    expect(next.log.at(-1)?.regenerated.length).toBe(0);
    expect(countOf(next.board, 'normal')).toBe(8);
  });
});

describe('SPEC §8 — 특수 석판과 손패', () => {
  it('blessing(축복) 타일을 파괴한 턴은 chargesLeft 가 줄지 않는다', () => {
    const layout = ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const stage = stageOf(layout);
    const board = setBlessing(createBoard(stage), { x: 1, y: 1 }, 'blessing');
    const state = stateOf(layout, {
      board,
      hand: [card('strike', 2), card('quake')],
      charges: 10,
    });

    const next = applyMove(state, { slot: 0, at: { x: 1, y: 1 } }, ZERO_RNG);

    expect(next.chargesLeft).toBe(10);
  });

  it('손패에 같은 정령 같은 레벨 2장이 모이면 1장의 상위 레벨로 합쳐진다', () => {
    // 슬롯 1 을 쓰고 큐에서 blaze1 이 들어오면 손패가 blaze1 두 장이 된다
    const state = stateOf(['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'], {
      hand: [card('blaze', 1), card('strike', 1)],
      queue: [card('blaze', 1), card('quake', 1), card('storm', 1)],
    });

    const next = applyMove(state, { slot: 1, at: { x: 2, y: 2 } }, ZERO_RNG);

    const blaze = next.hand.filter((c) => c.id === 'blaze');
    expect(blaze).toHaveLength(1);
    expect(blaze[0]?.level).toBe(2);
    // 합쳐지며 빈 자리는 큐에서 채워진다
    expect(next.hand.some((c) => c.id === 'quake')).toBe(true);
  });
});

describe('SPEC §8 — 승패 판정', () => {
  it("normal 이 0이 되면 distorted 가 남아 있어도 status === 'cleared' 다", () => {
    // 가운데 3×3 만 살아 있고 (2,1) 이 왜곡
    const layout = ['.....', '.OXO.', '.OOO.', '.OOO.', '.....'];
    const state = stateOf(layout, { hand: [card('shockwave', 3), card('strike')] });

    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, ZERO_RNG);

    expect(countOf(next.board, 'normal')).toBe(0);
    expect(countOf(next.board, 'distorted')).toBe(1);
    expect(next.status).toBe('cleared');
  });

  it("chargesLeft 가 0이고 normal 이 남으면 status === 'failed' 다", () => {
    const layout = ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const state = stateOf(layout, { hand: [card('strike', 1), card('quake')], charges: 1 });

    const next = applyMove(state, { slot: 0, at: { x: 0, y: 0 } }, ZERO_RNG);

    expect(next.chargesLeft).toBe(0);
    expect(countOf(next.board, 'normal')).toBeGreaterThan(0);
    expect(next.status).toBe('failed');
  });
});

describe('SPEC §8 — 불변성', () => {
  it('applyMove 가 입력 state 를 변형하지 않는다', () => {
    const layout = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const state = stateOf(layout, {
      hand: [card('shockwave', 2), card('blaze', 1)],
      queue: [card('blaze', 1), card('quake', 1)],
    });
    const snapshot = JSON.stringify(state);

    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, seqRng([0.1, 0.9, 0.5, 0.3]));

    expect(JSON.stringify(state)).toBe(snapshot);
    expect(next).not.toBe(state);
    expect(next.board).not.toBe(state.board);
  });
});

/* ---------- 규칙 경계 (§8 밖이지만 헷갈리기 쉬운 지점) ---------- */

describe('왜곡 재생성의 두 경로를 구분한다', () => {
  const layout = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOOO', 'OOOOO']; // 왜곡 (1,1)

  it('레벨 1이라도 시전 지점이 왜곡이면 확정 피격이라 재생성이 일어난다', () => {
    const state = stateOf(layout, { hand: [card('strike', 1), card('quake')] });

    const next = applyMove(state, { slot: 0, at: { x: 1, y: 1 } }, ZERO_RNG);

    expect(next.log.at(-1)?.distortedHits.length).toBe(1);
    const regen = next.log.at(-1)?.regenerated.length ?? 0;
    expect(regen).toBeGreaterThanOrEqual(1);
    expect(regen).toBeLessThanOrEqual(3);
    expect(countOf(next.board, 'distorted')).toBe(1); // 피격일 뿐 파괴는 아니다
  });

  it('purify 는 레벨 3에서도 왜곡을 파괴하고 재생성을 일으키지 않는다', () => {
    const state = stateOf(layout, { hand: [card('purify', 3), card('quake')] });

    const next = applyMove(state, { slot: 0, at: { x: 1, y: 2 } }, ZERO_RNG);

    expect(countOf(next.board, 'distorted')).toBe(0);
    expect(next.log.at(-1)?.distortedHits.length).toBe(0);
    expect(next.log.at(-1)?.regenerated.length).toBe(0);
  });
});

describe('벼락은 범위 정령이 아니다', () => {
  it('개수를 뽑아 부수되 distorted 는 절대 고르지 않는다', () => {
    const layout = ['OOO', 'OXO', 'OOO'];
    // 항상 최대값을 뽑는 RNG → 레벨 3 이면 7개
    const maxRng: Rng = { next: () => 0.999999 };
    const state = stateOf(layout, { hand: [card('bolt', 3), card('quake')] });

    const next = applyMove(state, { slot: 0, at: { x: 0, y: 0 } }, maxRng);

    // normal 8개 중 정확히 7개가 파괴된다 (레벨 3 최대치)
    expect(next.log.at(-1)?.destroyed.length).toBe(7);
    expect(countOf(next.board, 'normal')).toBe(1);
    expect(countOf(next.board, 'distorted')).toBe(1); // 왜곡은 손대지 않는다
    expect(next.log.at(-1)?.regenerated.length).toBe(0);
  });

  it('지정한 칸은 반드시 부순다', () => {
    const layout = ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'];
    const maxRng: Rng = { next: () => 0.999999 };
    for (const at of [{ x: 0, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 4 }]) {
      const state = stateOf(layout, { hand: [card('bolt', 1), card('quake')] });
      const next = applyMove(state, { slot: 0, at }, maxRng);
      const hit = next.log.at(-1)?.destroyed ?? [];
      expect(hit).toContainEqual(at);
    }
  });

  it('지정한 칸이 왜곡이면 확정 파괴 없이 전부 무작위다', () => {
    const layout = ['OOO', 'OXO', 'OOO'];
    const state = stateOf(layout, { hand: [card('bolt', 1), card('quake')] });

    const next = applyMove(state, { slot: 0, at: { x: 1, y: 1 } }, ZERO_RNG);

    // 왜곡은 그대로 남고, 다른 칸 1개가 무작위로 부서진다
    expect(countOf(next.board, 'distorted')).toBe(1);
    expect(next.log.at(-1)?.destroyed).toHaveLength(1);
    expect(next.log.at(-1)?.destroyed[0]).not.toEqual({ x: 1, y: 1 });
  });
});

describe('SPEC §4.3 — 재생성은 방금 부순 칸을 뒷순위로 민다', () => {
  it('다른 빈 칸이 넉넉하면 방금 부순 칸은 되살아나지 않는다', () => {
    // 5×5 중 왼쪽 두 줄을 미리 비워 둔다 (되살아날 후보 10칸)
    const layout = ['OOOOO', 'OOOOO', 'OXOOO', 'OOOOO', 'OOOOO'];
    const stage = stageOf(layout);
    const pre: Pos[] = [];
    for (let y = 0; y < 5; y++) for (let x = 3; x < 5; x++) pre.push({ x, y });
    const board = destroyAt(createBoard(stage), pre);

    // 충격파 Lv2 를 왜곡 옆에 써서 파괴 + 왜곡 피격을 함께 일으킨다
    const state = stateOf(layout, { board, hand: [card('shockwave', 2), card('strike')] });
    const next = applyMove(state, { slot: 0, at: { x: 1, y: 2 } }, ZERO_RNG);

    const e = next.log.at(-1);
    expect(e?.distortedHits.length).toBe(1);
    expect(e?.regenerated.length).toBeGreaterThan(0);

    // 되살아난 칸은 전부 '미리 비워 둔 칸' 쪽이어야 한다
    const justBroke = new Set((e?.destroyed ?? []).map((p) => `${p.x},${p.y}`));
    for (const p of e?.regenerated ?? []) {
      expect(justBroke.has(`${p.x},${p.y}`)).toBe(false);
    }
  });
});

/* ---------- 지시받은 추가 검증 ----------
   "강화 2단계가 3단계보다 위험한 상황이 존재해야 한다" (SPEC §4.3 각주)
   같은 판, 같은 자리에 레벨만 바꿔서 시전했을 때 결과가 뒤집히는지 본다. */

describe('강화 2단계가 3단계보다 위험한 역전', () => {
  const layout = ['.....', '.OXO.', '.OOO.', '.OOO.', '.....'];
  const at: Pos = { x: 2, y: 2 };

  it('레벨 3은 왜곡을 건드리지 않아 판을 끝내지만, 레벨 2는 왜곡을 때려 석판을 되살린다', () => {
    const lv2 = stateOf(layout, { hand: [card('shockwave', 2), card('strike')] });
    const lv3 = stateOf(layout, { hand: [card('shockwave', 3), card('strike')] });

    const after2 = applyMove(lv2, { slot: 0, at }, ZERO_RNG);
    const after3 = applyMove(lv3, { slot: 0, at }, ZERO_RNG);

    // 레벨 3: 왜곡을 제외한 8칸을 부수고 클리어
    expect(countOf(after3.board, 'normal')).toBe(0);
    expect(after3.status).toBe('cleared');

    // 레벨 2: 같은 8칸을 부수지만 왜곡이 피격돼 1~3개가 되살아난다
    const regen = after2.log.at(-1)?.regenerated.length ?? 0;
    expect(regen).toBeGreaterThanOrEqual(1);
    expect(countOf(after2.board, 'normal')).toBe(regen);
    expect(after2.status).toBe('playing');

    // 핵심 — 더 높은 강화 단계가 오히려 유리하다
    expect(countOf(after2.board, 'normal')).toBeGreaterThan(countOf(after3.board, 'normal'));
  });
});

describe('SPEC §4.2 — 정령 교체는 고른 한 장만 바꾼다', () => {
  it('1번 자리를 교체하면 0번 자리는 그대로 남고 1번만 큐 맨 앞으로 바뀐다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('blaze'), card('strike')],
      queue: [card('tsunami'), card('storm'), card('purify')],
    });

    const next = reroll(state, 1, ZERO_RNG);

    expect(next.hand[0]).toEqual(card('blaze')); // 안 고른 자리는 그대로
    expect(next.hand[1]).toEqual(card('tsunami')); // 고른 자리만 큐 맨 앞으로
    expect(next.rerollsLeft).toBe(state.rerollsLeft - 1);
  });

  it('0번 자리를 교체해도 마찬가지로 1번 자리는 그대로다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('blaze'), card('strike')],
      queue: [card('tsunami'), card('storm'), card('purify')],
    });

    const next = reroll(state, 0, ZERO_RNG);

    expect(next.hand[0]).toEqual(card('tsunami'));
    expect(next.hand[1]).toEqual(card('strike'));
  });

  it('새로 온 카드가 남긴 카드와 같으면 합쳐진다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('blaze'), card('strike')],
      queue: [card('blaze'), card('storm'), card('purify')],
    });

    const next = reroll(state, 1, ZERO_RNG);

    // 불꽃 Lv1 둘이 만나 Lv2 한 장이 되고, 빈 자리는 큐에서 채워진다
    const levels = next.hand.map((c) => `${c.id}Lv${c.level}`);
    expect(levels).toContain('blazeLv2');
  });

  it('입력 state 를 변형하지 않는다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('blaze'), card('strike')],
      queue: [card('tsunami'), card('storm'), card('purify')],
    });
    const snapshot = JSON.stringify(state);

    reroll(state, 1, ZERO_RNG);

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('SPEC §4.4 — 레벨이 달라도 합쳐진다', () => {
  it('Lv2 + Lv1 이 손패에 모이면 Lv3 이 된다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('strike', 2), card('blaze')],
      queue: [card('strike'), card('quake'), card('storm')],
    });

    // 1번 자리를 교체하면 큐 맨 앞 낙뢰Lv1 이 들어와 낙뢰Lv2 와 합쳐진다
    const next = reroll(state, 1, ZERO_RNG);

    const levels = next.hand.map((c) => `${c.id}Lv${c.level}`);
    expect(levels).toContain('strikeLv3');
  });

  it('Lv3 은 더 이상 합쳐지지 않는다', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('strike', 3), card('blaze')],
      queue: [card('strike'), card('quake'), card('storm')],
    });

    const next = reroll(state, 1, ZERO_RNG);

    // 낙뢰Lv3 은 그대로 남고, 새 낙뢰Lv1 이 옆자리에 그냥 들어온다
    expect(next.hand.map((c) => `${c.id}Lv${c.level}`).sort()).toEqual([
      'strikeLv1',
      'strikeLv3',
    ]);
  });

  it('Lv2 + Lv2 도 여전히 Lv3 이다 (3을 넘지 않는다)', () => {
    const state = stateOf(['OOO', 'OOO', 'OOO'], {
      hand: [card('strike', 2), card('blaze')],
      queue: [card('strike', 2), card('quake'), card('storm')],
    });

    const next = reroll(state, 1, ZERO_RNG);

    expect(next.hand.map((c) => c.level).some((l) => l > 3)).toBe(false);
    expect(next.hand.map((c) => `${c.id}Lv${c.level}`)).toContain('strikeLv3');
  });
});

describe('SPEC §4.3 — 왜곡 피격 재생성은 1~3 랜덤', () => {
  const layout = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOOO', 'OOOOO'];

  /** nextInt(rng,1,3) 은 next() 값을 3등분한다. 0→1, 0.4→2, 0.9→3 */
  function regenWith(first: number): number {
    // 첫 호출만 원하는 값을 주고 나머지는 0 (파괴 판정이 전부 통과하도록)
    let i = 0;
    const rng = { next: () => (i++ === 0 ? first : 0) };
    const state = stateOf(layout, { hand: [card('shockwave', 2), card('strike')] });
    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, rng);
    return next.log.at(-1)?.regenerated.length ?? 0;
  }

  it('난수에 따라 1, 2, 3 이 모두 나온다', () => {
    // 레벨 2 는 확정 파괴라 파괴 판정에서 난수를 쓰지 않는다.
    // 그래서 첫 난수 호출이 곧 재생성 개수 뽑기다.
    expect(regenWith(0)).toBe(1);
    expect(regenWith(0.5)).toBe(2);
    expect(regenWith(0.99)).toBe(3);
  });

  it('왜곡 둘을 한 번에 때리면 각각 따로 뽑아 2~6개가 된다', () => {
    // (1,1) 과 (3,3) 이 왜곡. 충격파 Lv2 를 (2,2) 에 쓰면 둘 다 범위 안이다.
    const two = ['OOOOO', 'OXOOO', 'OOOOO', 'OOOXO', 'OOOOO'];
    const state = stateOf(two, { hand: [card('shockwave', 2), card('strike')] });

    const next = applyMove(state, { slot: 0, at: { x: 2, y: 2 } }, ZERO_RNG);

    expect(next.log.at(-1)?.distortedHits.length).toBe(2);
    const regen = next.log.at(-1)?.regenerated.length ?? 0;
    expect(regen).toBeGreaterThanOrEqual(2);
    expect(regen).toBeLessThanOrEqual(6);
  });
});

describe('무한모드 판 생성', () => {
  it('1라운드는 왜곡이 없고, 라운드마다 3개씩 늘어난다', () => {
    expect(distortedCountAt(1)).toBe(0);
    expect(distortedCountAt(2)).toBe(3);
    expect(distortedCountAt(5)).toBe(12);
  });

  it('왜곡이 판을 뒤덮지 않도록 상한이 있다', () => {
    expect(distortedCountAt(999)).toBe(ENDLESS_DISTORTED_MAX);
    expect(ENDLESS_DISTORTED_MAX).toBeLessThan(ENDLESS_SIZE * ENDLESS_SIZE);
  });

  it('판은 15×15 이고 왜곡 개수가 정확히 맞는다', () => {
    const stage = endlessStage(4, seqRng([0.1, 0.7, 0.3, 0.9, 0.5]));
    expect(stage.width).toBe(ENDLESS_SIZE);
    expect(stage.height).toBe(ENDLESS_SIZE);
    expect(stage.layout).toHaveLength(ENDLESS_SIZE);
    expect(stage.layout.every((r) => r.length === ENDLESS_SIZE)).toBe(true);

    const board = createBoard(stage);
    expect(countOf(board, 'distorted')).toBe(distortedCountAt(4));
    expect(countOf(board, 'normal')).toBe(ENDLESS_SIZE * ENDLESS_SIZE - distortedCountAt(4));
  });

  it('소환 횟수가 곧 3성 기준선이다 — 다 쓰면 실패고 등급이 갈리지 않는다', () => {
    const stage = endlessStage(3, seqRng([0.2, 0.6]));
    expect(stage.gradeThresholds[3]).toBe(stage.charges);
    expect(stage.gradeThresholds[2]).toBe(stage.charges);
  });

  it('같은 난수면 같은 판이 나온다 (재현 가능)', () => {
    const a = endlessStage(6, seqRng([0.3, 0.8, 0.1, 0.55]));
    const b = endlessStage(6, seqRng([0.3, 0.8, 0.1, 0.55]));
    expect(a.layout).toEqual(b.layout);
  });
});
