/* 게임 엔진. SPEC §4.
   applyMove 는 입력 state 를 절대 변형하지 않고 새 state 를 돌려준다.
   난수는 전부 인자로 받은 rng 에서만 꺼낸다. */

import type {
  Blessing,
  Board,
  GameState,
  HandSlot,
  Move,
  MoveLogEntry,
  Pos,
  SpiritCard,
  SpiritId,
  StageConfig,
  Tile,
} from './types';
import type { Rng } from './rng';
import { nextInt, chance, pickWeighted } from './rng';
import { canMerge, chanceAt, DRAW_POOL, getRange, merge, SPIRITS } from './spirits';
import {
  cloneBoard,
  countOf,
  createBoard,
  destroyAt,
  getTile,
  moveBlessings,
  pickRandomNormals,
  regenerateNormals,
  reshuffleBoard,
  sizeOf,
} from './board';
import { BOLT_COUNT_RANGE, DISTORTED_HIT_REGEN, QUEUE_PREVIEW } from '../data/config';

/* ---------- 카드와 큐 ---------- */

/** 일반 드로우 풀에서 가중치대로 한 장 (SPEC §4.4) */
function drawCard(rng: Rng): SpiritCard {
  const id = pickWeighted(rng, DRAW_POOL, (i) => SPIRITS[i].drawWeight);
  return { id: (id ?? 'strike') as SpiritId, level: 1 };
}

/** 큐 앞에서 한 장 빼고, 뒤에 새로 한 장을 채워 길이를 유지한다 */
function takeFromQueue(queue: readonly SpiritCard[], rng: Rng): { card: SpiritCard; queue: SpiritCard[] } {
  const rest = queue.slice();
  const front = rest.shift();
  const card = front ?? drawCard(rng);
  rest.push(drawCard(rng));
  return { card, queue: rest };
}

/* 합치기 (SPEC §4.4).

   문서는 "손패 2장이 같은 id 이고 같은 레벨이면 합쳐진다" 라고만 한다.
   그런데 손패가 2칸뿐이라 이 규칙만으로는 3레벨에 도달할 수 없다.
   [불꽃Lv2][X] 상태에서 두 번째 Lv2 를 만들려면 Lv1 두 장을 나란히 들어야 하는데
   한 칸이 이미 Lv2 로 차 있어서 그럴 수가 없기 때문이다. (큐에서 오는 카드는 항상 Lv1)

   TODO(확인): 그래서 합치기를 보는 범위를 "손패 2장 + 큐 맨 앞"까지로 넓혔다.
   미리보기 카드끼리는 합치지 않는다 — 큐에 Lv2 가 떠 있으면 아직 손에 들지도
   않은 카드가 이미 강화된 것처럼 보여 헷갈린다. 큐가 내놓는 카드는 항상 Lv1 이다.
   그래도 3레벨은 나온다: 손패 [불꽃Lv2][불꽃Lv1] 에 큐 맨 앞이 불꽃Lv1 이면
   먼저 손패의 Lv1 과 합쳐져 [불꽃Lv2][불꽃Lv2] 가 되고, 그 둘이 다시 합쳐진다. */
function resolveMerges(
  hand: [SpiritCard, SpiritCard],
  queue: readonly SpiritCard[],
  rng: Rng,
): { hand: [SpiritCard, SpiritCard]; queue: SpiritCard[] } {
  let a = hand[0];
  let b = hand[1];
  let q = queue.slice();

  /* 합치기는 손패 안에서만 일어난다. 큐에 있는 카드는 아직 손에 든 것이 아니므로
     손패와 합쳐지지 않는다 — 손에 들어온 뒤에야 강화된다.
     빈 자리를 큐에서 채우고 나서 다시 검사하므로, 채운 카드가 마침 같은 정령이면
     그 다음 바퀴에서 합쳐진다. 더 합칠 수 없을 때까지 반복한다. */
  for (let guard = 0; guard < 24; guard++) {
    if (!canMerge(a, b)) break;
    a = merge(a, b);
    const taken = takeFromQueue(q, rng);
    b = taken.card;
    q = taken.queue;
  }

  return { hand: [a, b], queue: q };
}

/* ---------- 파괴 판정 (SPEC §4.3) ---------- */

interface StrikeResult {
  /** 실제로 비워질 칸 */
  destroyed: Pos[];
  /** 파괴된 normal 타일에 붙어 있던 효과 */
  blessings: Blessing[];
  /** 재생성을 유발한 왜곡 피격 칸 (purify/resonance 로 부순 건 제외) */
  distortedHits: Pos[];
}

/** 이 칸이 파괴/피격 판정을 통과하는가. cellChance 는 그 칸에서 계산된 확률이다 */
function passes(isCastPoint: boolean, level: number, cellChance: number, rng: Rng): boolean {
  if (level >= 2) return true; // 레벨 2, 3 은 범위 내 확정
  if (isCastPoint) return true; // 시전 지점은 항상 확정
  return chance(rng, cellChance);
}

function resolveStrike(board: Board, card: SpiritCard, at: Pos, rng: Rng): StrikeResult {
  const def = SPIRITS[card.id];
  const cells = getRange(card, at, sizeOf(board));

  const destroyed: Pos[] = [];
  const blessings: Blessing[] = [];
  const distortedHits: Pos[] = [];

  for (const p of cells) {
    const tile = getTile(board, p);
    if (tile === undefined) continue;
    if (tile.kind === 'empty' || tile.kind === 'blocked') continue;

    const isCastPoint = p.x === at.x && p.y === at.y;
    const cellChance = chanceAt(def, at, p);

    if (tile.kind === 'distorted') {
      // 정화 · 공명은 왜곡을 부술 수 있고, 이 피격으로는 재생성이 없다
      if (def.canDestroyDistorted) {
        if (passes(isCastPoint, card.level, cellChance, rng)) destroyed.push(p);
        continue;
      }
      // 레벨 3 은 왜곡을 아예 건드리지 않는다 → 피격도 재생성도 없다
      if (card.level === 3) continue;
      // 레벨 1·2 는 피격될 수 있고, 피격되면 재생성을 부른다 (파괴는 안 된다)
      if (passes(isCastPoint, card.level, cellChance, rng)) distortedHits.push(p);
      continue;
    }

    // normal
    if (!passes(isCastPoint, card.level, cellChance, rng)) continue;
    destroyed.push(p);
    if (tile.blessing !== undefined) blessings.push(tile.blessing);
  }

  return { destroyed, blessings, distortedHits };
}

/* 벼락 — 범위 대신 파괴 "개수"를 뽑는다 (SPEC §4.4).
   시전 지점은 확정으로 부수고, 남은 개수만큼 무작위로 더 부순다.
   시전 지점이 왜곡이면(벼락은 왜곡을 건드리지 않는다) 확정 파괴 없이 전부 무작위다. */
function resolveBolt(board: Board, card: SpiritCard, at: Pos, rng: Rng): StrikeResult {
  const [min, max] = BOLT_COUNT_RANGE[card.level];
  const count = nextInt(rng, min, max);

  const aimed = getTile(board, at)?.kind === 'normal' ? at : undefined;
  const targets: Pos[] =
    aimed === undefined
      ? pickRandomNormals(board, count, rng)
      : [aimed, ...pickRandomNormals(board, count - 1, rng, aimed)];

  const blessings: Blessing[] = [];
  for (const p of targets) {
    const tile = getTile(board, p);
    if (tile?.blessing !== undefined) blessings.push(tile.blessing);
  }
  return { destroyed: targets, blessings, distortedHits: [] };
}

/* ---------- 특수 석판 (SPEC §4.5) ---------- */

interface BlessingOutcome {
  board: Board;
  /** 이번 턴에 쓰지 않은 나머지 한 장 */
  remaining: SpiritCard;
  rerollsLeft: number;
  /** 축복이 발동해 소환 횟수를 소모하지 않는가 */
  freeCast: boolean;
}

function applyBlessings(
  board: Board,
  blessings: readonly Blessing[],
  used: SpiritCard,
  remaining: SpiritCard,
  rerollsLeft: number,
  rng: Rng,
): BlessingOutcome {
  // 재배치를 먼저, 나머지는 모인 순서대로 (SPEC §4.5)
  const ordered = [
    ...blessings.filter((b) => b === 'reshuffle'),
    ...blessings.filter((b) => b !== 'reshuffle'),
  ];

  let nextBoard = board;
  let nextRemaining: SpiritCard = { ...remaining };
  let nextRerolls = rerollsLeft;
  let freeCast = false;

  for (const b of ordered) {
    switch (b) {
      case 'reshuffle':
        nextBoard = reshuffleBoard(nextBoard, rng);
        break;

      case 'blessing':
        freeCast = true;
        break;

      case 'extra':
        nextRerolls += 1;
        break;

      case 'mystery': {
        const id: SpiritId = rng.next() < 0.5 ? 'erupt' : 'resonance';
        nextRemaining = { id, level: 1 };
        break;
      }

      case 'upgrade':
        // 이미 3레벨이거나 신비 2종이면 효과 없음
        if (SPIRITS[nextRemaining.id].upgradable && nextRemaining.level < 3) {
          nextRemaining = {
            id: nextRemaining.id,
            level: (nextRemaining.level + 1) as SpiritCard['level'],
          };
        }
        break;

      case 'clone':
        nextRemaining = { ...used };
        break;
    }
  }

  return { board: nextBoard, remaining: nextRemaining, rerollsLeft: nextRerolls, freeCast };
}

/* ---------- 승패 (SPEC §4.1) ---------- */

function gradeFor(chargesUsed: number, stage: StageConfig): 1 | 2 | 3 {
  if (chargesUsed <= stage.gradeThresholds[3]) return 3;
  if (chargesUsed <= stage.gradeThresholds[2]) return 2;
  return 1;
}

function decideStatus(
  board: Board,
  chargesLeft: number,
  stage: StageConfig,
  chargesUsed: number,
): Pick<GameState, 'status' | 'grade'> {
  // distorted 가 남아 있어도 normal 이 0이면 클리어다
  if (countOf(board, 'normal') === 0) {
    return { status: 'cleared', grade: gradeFor(chargesUsed, stage) };
  }
  if (chargesLeft <= 0) return { status: 'failed' };
  return { status: 'playing' };
}

/* ---------- 공개 API ---------- */

export function createGame(stage: StageConfig, rng: Rng): GameState {
  // SPEC §4.5 — 판 시작 시점에는 특수 석판이 없다. 첫 시전이 끝난 뒤부터 생긴다.
  const board = createBoard(stage);

  const queue: SpiritCard[] = [];
  for (let i = 0; i < QUEUE_PREVIEW; i++) queue.push(drawCard(rng));

  const opening = resolveMerges([drawCard(rng), drawCard(rng)], queue, rng);

  return {
    board,
    hand: opening.hand,
    queue: opening.queue,
    chargesLeft: stage.charges,
    rerollsLeft: stage.rerolls,
    chargesUsed: 0,
    status: 'playing',
    stage,
    log: [],
  };
}

export function applyMove(state: GameState, move: Move, rng: Rng): GameState {
  if (state.status !== 'playing') {
    throw new Error(`applyMove: 이미 끝난 판이다 (${state.status})`);
  }
  const tile = getTile(state.board, move.at);
  if (tile === undefined) {
    throw new Error(`applyMove: 보드 밖 좌표 (${move.at.x}, ${move.at.y})`);
  }

  const used = state.hand[move.slot];
  const otherSlot = move.slot === 0 ? 1 : 0;
  const isBolt = SPIRITS[used.id].range === null;

  /* 1) 파괴 판정 */
  const strike = isBolt
    ? resolveBolt(state.board, used, move.at, rng)
    : resolveStrike(state.board, used, move.at, rng);

  let board = destroyAt(state.board, strike.destroyed);

  /* 2) 재생성 — 왜곡 피격 1개당 normal 3개. 벼락이 0개를 뽑았으면 1개. */
  let regenerated: Pos[] = [];
  // 피격 하나마다 따로 뽑는다. 둘을 때리면 각각 1~3 이라 2~6 개가 된다.
  let regenCount = 0;
  for (let i = 0; i < strike.distortedHits.length; i++) {
    regenCount += nextInt(rng, DISTORTED_HIT_REGEN[0], DISTORTED_HIT_REGEN[1]);
  }

  if (regenCount > 0) {
    // 방금 부순 칸은 뒷순위로 민다 (SPEC §4.3)
    const result = regenerateNormals(board, regenCount, rng, strike.destroyed);
    board = result.board;
    regenerated = result.cells;
  }

  /* 3) 특수 석판 — 파괴 처리가 모두 끝난 뒤에 적용한다 */
  const outcome = applyBlessings(
    board,
    strike.blessings,
    used,
    state.hand[otherSlot],
    state.rerollsLeft,
    rng,
  );
  board = outcome.board;

  /* 4) 소환 횟수. 축복이 터졌으면 소모하지 않는다 */
  const chargesLeft = outcome.freeCast ? state.chargesLeft : state.chargesLeft - 1;
  const chargesUsed = outcome.freeCast ? state.chargesUsed : state.chargesUsed + 1;

  /* 5) 쓴 자리를 큐에서 채우고, 같은 카드가 모이면 강화 */
  const taken = takeFromQueue(state.queue, rng);
  const refilled: [SpiritCard, SpiritCard] =
    move.slot === 0 ? [taken.card, outcome.remaining] : [outcome.remaining, taken.card];
  const merged = resolveMerges(refilled, taken.queue, rng);

  /* 6) 떠도는 특수 석판 (SPEC §4.5)
     기존 표시를 지우고 남은 석판 중 무작위 칸에 새 효과를 얹는다.
     방금 부순 칸은 이미 사라졌으므로, 부순 경우엔 효과가 터진 뒤 새 자리에 생기고
     못 부순 경우엔 표시만 다른 칸으로 옮겨 간다. */
  board = moveBlessings(board, state.stage.blessingCount, rng);

  /* 7) 승패 */
  const verdict = decideStatus(board, chargesLeft, state.stage, chargesUsed);

  const entry: MoveLogEntry = {
    turn: state.log.length + 1,
    card: { ...used },
    at: { ...move.at },
    destroyed: strike.destroyed.map((p) => ({ ...p })),
    distortedHits: strike.distortedHits.map((p) => ({ ...p })),
    regenerated: regenerated.map((p) => ({ ...p })),
    blessings: strike.blessings.slice(),
  };

  return {
    board,
    hand: merged.hand,
    queue: merged.queue,
    chargesLeft,
    rerollsLeft: outcome.rerollsLeft,
    chargesUsed,
    stage: state.stage,
    log: [...state.log, entry],
    ...verdict,
  };
}

/** 카드 교체 — 고른 자리 한 장만 새로 뽑는다. 나머지 한 장은 그대로 남고,
 *  소환 횟수는 소모되지 않는다 (SPEC §4.2) */
export function reroll(state: GameState, slot: HandSlot, rng: Rng): GameState {
  if (state.status !== 'playing') throw new Error('reroll: 이미 끝난 판이다');
  if (state.rerollsLeft <= 0) throw new Error('reroll: 남은 교체 횟수가 없다');

  const taken = takeFromQueue(state.queue, rng);
  const kept = state.hand[slot === 0 ? 1 : 0];
  const pair: [SpiritCard, SpiritCard] =
    slot === 0 ? [taken.card, kept] : [kept, taken.card];
  // 새로 온 카드가 남긴 카드와 같으면 평소처럼 합쳐진다
  const merged = resolveMerges(pair, taken.queue, rng);

  return {
    ...state,
    board: cloneBoard(state.board),
    hand: merged.hand,
    queue: merged.queue,
    rerollsLeft: state.rerollsLeft - 1,
  };
}

/** 중단 — 판을 실패로 끝낸다 (SPEC §4.1) */
export function abort(state: GameState): GameState {
  return { ...state, board: cloneBoard(state.board), status: 'failed' };
}

/* ---------- 미리보기 (SPEC §6) ----------
   난수를 쓰지 않는 순수 계산이다. 화면이 규칙을 다시 구현하지 않도록 여기에 둔다. */

export type CellEffect =
  | 'certain' // 확정 파괴 (시전 지점, 또는 레벨 2·3)
  | 'chance' // 확률 파괴
  | 'distorted-destroy' // 왜곡을 부순다 (정화·공명). 재생성 없음
  | 'distorted-hit' // 왜곡 피격 → 석판 재생성. 이 게임의 핵심 경고
  | 'distorted-safe'; // 레벨 3이라 왜곡을 건드리지 않는다

export interface CellPreview {
  pos: Pos;
  effect: CellEffect;
  /** 이 칸의 파괴 확률 [0,1]. 확정 파괴 칸은 1 */
  chance: number;
}

export interface MovePreview {
  /** 벼락은 범위가 없다 */
  isBolt: boolean;
  /** 벼락일 때 뽑히는 개수 범위 */
  boltRange?: [number, number];
  /** 확률 판정을 받는 칸들의 확률 범위 [최소, 최대]. 없으면 undefined */
  chanceRange?: [number, number];
  cells: CellPreview[];
  /** 왜곡 피격으로 석판이 되살아나는가 */
  willRegenerate: boolean;
  /** 왜곡을 때릴 확률. 1 이면 확정. 왜곡을 안 건드리면 undefined.
   *  범위 안 왜곡이 여럿이면 가장 높은 확률을 쓴다 (제일 위험한 쪽). */
  distortedHitChance?: number;
}

export function previewMove(state: GameState, slot: HandSlot, at: Pos): MovePreview {
  const card = state.hand[slot];
  const def = SPIRITS[card.id];

  if (def.range === null) {
    // 시전 지점은 확정 파괴다. 왜곡이면 벼락이 건드리지 않으므로 표시하지 않는다.
    const aimed = getTile(state.board, at)?.kind === 'normal';
    return {
      isBolt: true,
      boltRange: BOLT_COUNT_RANGE[card.level],
      cells: aimed ? [{ pos: at, effect: 'certain', chance: 1 }] : [],
      willRegenerate: false,
    };
  }

  const cells: CellPreview[] = [];
  let willRegenerate = false;
  let hitChance = 0;
  let lo = 1;
  let hi = 0;

  for (const pos of getRange(card, at, sizeOf(state.board))) {
    const tile = getTile(state.board, pos);
    if (tile === undefined) continue;
    if (tile.kind === 'empty' || tile.kind === 'blocked') continue;

    const isCastPoint = pos.x === at.x && pos.y === at.y;
    const certain = card.level >= 2 || isCastPoint;
    const cellChance = certain ? 1 : chanceAt(def, at, pos);

    if (tile.kind === 'distorted') {
      if (def.canDestroyDistorted) {
        cells.push({ pos, effect: 'distorted-destroy', chance: cellChance });
      } else if (card.level === 3) {
        cells.push({ pos, effect: 'distorted-safe', chance: 0 });
      } else {
        cells.push({ pos, effect: 'distorted-hit', chance: cellChance });
        willRegenerate = true;
        hitChance = Math.max(hitChance, cellChance);
      }
      continue;
    }

    cells.push({ pos, effect: certain ? 'certain' : 'chance', chance: cellChance });
    if (!certain) {
      lo = Math.min(lo, cellChance);
      hi = Math.max(hi, cellChance);
    }
  }

  const chanceRange: [number, number] | undefined = hi > 0 ? [lo, hi] : undefined;
  return {
    isBolt: false,
    cells,
    willRegenerate,
    ...(chanceRange ? { chanceRange } : {}),
    ...(willRegenerate ? { distortedHitChance: hitChance } : {}),
  };
}

/** 지금 클리어하면 몇 성인가 (SPEC §4.1). 진행 중 예상 등급 표시에 쓴다 */
export function projectedGrade(state: GameState): 1 | 2 | 3 {
  return gradeFor(state.chargesUsed, state.stage);
}

/** 타일 종류를 세는 짧은 헬퍼. UI 와 시뮬레이터가 함께 쓴다 */
export function remainingNormals(board: Board): number {
  return countOf(board, 'normal');
}

/** 아직 손대지 않은 칸인지 (UI 미리보기용) */
export function isPlayable(tile: Tile): boolean {
  return tile.kind === 'normal' || tile.kind === 'distorted';
}
