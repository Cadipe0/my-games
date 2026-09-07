/* 보드 생성 · 조회 · 재생성 · 재배치. SPEC §4.3 / §4.5 / §4.6.
   모든 함수는 입력 보드를 변형하지 않고 새 보드를 돌려준다. */

import type { Blessing, Board, BoardSize, Pos, StageConfig, Tile, TileKind } from './types';
import { pick, pickWeighted, shuffled, type Rng } from './rng';
import { BLESSING_WEIGHT } from '../data/config';

const LAYOUT_CHAR: Record<string, TileKind> = {
  '.': 'blocked',
  O: 'normal',
  X: 'distorted',
};

/** 레이아웃 문자열로 보드를 만든다. blessing 은 아직 붙이지 않는다 */
export function createBoard(stage: StageConfig): Board {
  if (stage.layout.length !== stage.height) {
    throw new Error(
      `createBoard: layout 행 수(${stage.layout.length})가 height(${stage.height})와 다르다`,
    );
  }

  const board: Board = [];
  for (let y = 0; y < stage.height; y++) {
    const row = stage.layout[y] as string;
    if (row.length !== stage.width) {
      throw new Error(`createBoard: ${y}행 길이(${row.length})가 width(${stage.width})와 다르다`);
    }
    const tiles: Tile[] = [];
    for (let x = 0; x < stage.width; x++) {
      const ch = row[x] as string;
      const kind = LAYOUT_CHAR[ch];
      if (kind === undefined) throw new Error(`createBoard: 알 수 없는 문자 '${ch}'`);
      tiles.push({ kind });
    }
    board.push(tiles);
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((tile) => ({ ...tile })));
}

export function sizeOf(board: Board): BoardSize {
  return { width: board[0]?.length ?? 0, height: board.length };
}

export function inBounds(board: Board, p: Pos): boolean {
  const size = sizeOf(board);
  return p.x >= 0 && p.y >= 0 && p.x < size.width && p.y < size.height;
}

/** 보드 밖이면 undefined */
export function getTile(board: Board, p: Pos): Tile | undefined {
  return board[p.y]?.[p.x];
}

/** 조건에 맞는 칸의 좌표를 위에서 아래, 왼쪽에서 오른쪽 순서로 모은다 */
export function positionsWhere(board: Board, match: (tile: Tile, p: Pos) => boolean): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < board.length; y++) {
    const row = board[y] as Tile[];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x] as Tile;
      const p = { x, y };
      if (match(tile, p)) out.push(p);
    }
  }
  return out;
}

export function positionsOf(board: Board, kind: TileKind): Pos[] {
  return positionsWhere(board, (tile) => tile.kind === kind);
}

export function countOf(board: Board, kind: TileKind): number {
  let n = 0;
  for (const row of board) {
    for (const tile of row) if (tile.kind === kind) n++;
  }
  return n;
}

/** 특수 석판을 무작위로 부여한다 (SPEC §4.6 — 고정 배치 + 무작위 blessing) */
export function assignBlessings(board: Board, count: number, rng: Rng): Board {
  const next = cloneBoard(board);
  const kinds = Object.keys(BLESSING_WEIGHT) as Blessing[];
  const spots = shuffled(rng, positionsOf(next, 'normal')).slice(0, Math.max(0, count));

  for (const p of spots) {
    const blessing = pickWeighted(rng, kinds, (k) => BLESSING_WEIGHT[k]);
    if (blessing === undefined) break;
    const row = next[p.y] as Tile[];
    row[p.x] = { kind: 'normal', blessing };
  }
  return next;
}

/** 붙어 있는 특수 석판 표시를 모두 뗀다 */
export function clearBlessings(board: Board): Board {
  return board.map((row) =>
    row.map((tile) => (tile.kind === 'normal' ? { kind: 'normal' as const } : { ...tile })),
  );
}

/* SPEC §4.5 떠도는 특수 석판 —
   기존 표시를 모두 지우고, 남은 normal 타일 중 무작위 count 칸에 새 효과를 붙인다.
   매 시전이 끝날 때마다 불려서 "부수면 발동, 못 부수면 다른 칸으로 이동"이 된다. */
export function moveBlessings(board: Board, count: number, rng: Rng): Board {
  return assignBlessings(clearBlessings(board), count, rng);
}

/** 좌표들을 빈 칸으로 만든다 */
export function destroyAt(board: Board, targets: readonly Pos[]): Board {
  const next = cloneBoard(board);
  for (const p of targets) {
    const row = next[p.y];
    if (row === undefined || row[p.x] === undefined) continue;
    row[p.x] = { kind: 'empty' };
  }
  return next;
}

/* SPEC §4.3 — 왜곡 석판이 피격되면 normal 타일이 빈 칸 중 무작위 위치에 재생성된다.
   · 재생성될 빈 칸이 부족하면 가능한 만큼만
   · 재생성된 타일에는 blessing 이 붙지 않는다
   · blocked 에는 재생성되지 않는다 */
export function regenerateNormals(
  board: Board,
  count: number,
  rng: Rng,
  /** 되살릴 자리를 고를 때 뒷순위로 미룰 칸들 (보통 이번 시전으로 막 부순 칸) */
  later: readonly Pos[] = [],
): { board: Board; cells: Pos[] } {
  if (count <= 0) return { board: cloneBoard(board), cells: [] };

  const next = cloneBoard(board);

  /* 방금 부순 칸은 뒷순위로 민다. 애써 부순 자리가 그 자리에서 되살아나면
     한 일이 없던 것처럼 보이기 때문이다. 다른 빈 칸이 모자랄 때만 쓴다. */
  const low = new Set(later.map((p) => `${p.x},${p.y}`));
  const empties = positionsOf(next, 'empty');
  const spots = [
    ...shuffled(rng, empties.filter((p) => !low.has(`${p.x},${p.y}`))),
    ...shuffled(rng, empties.filter((p) => low.has(`${p.x},${p.y}`))),
  ].slice(0, count);
  for (const p of spots) {
    const row = next[p.y] as Tile[];
    row[p.x] = { kind: 'normal' };
  }
  return { board: next, cells: spots };
}

/* SPEC §4.5 재배치 — 남은 모든 석판(normal + distorted)의 위치를 무작위로 바꾼다.
   종류별 개수는 유지되고, blessing 은 타일을 따라 함께 이동한다.
   blocked 은 대상이 아니며 후보 칸에도 들어가지 않는다. */
export function reshuffleBoard(board: Board, rng: Rng): Board {
  const next = cloneBoard(board);

  const tiles: Tile[] = [];
  const slots: Pos[] = [];
  for (let y = 0; y < next.length; y++) {
    const row = next[y] as Tile[];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x] as Tile;
      if (tile.kind === 'blocked') continue;
      slots.push({ x, y });
      if (tile.kind === 'normal' || tile.kind === 'distorted') tiles.push(tile);
    }
  }

  const targets = shuffled(rng, slots);
  for (const p of targets) {
    (next[p.y] as Tile[])[p.x] = { kind: 'empty' };
  }
  for (let i = 0; i < tiles.length; i++) {
    const p = targets[i] as Pos;
    (next[p.y] as Tile[])[p.x] = tiles[i] as Tile;
  }
  return next;
}

/** 벼락용 — 남은 normal 타일 중 무작위로 n개를 고른다 (SPEC §4.4) */
export function pickRandomNormals(
  board: Board,
  n: number,
  rng: Rng,
  /** 후보에서 뺄 칸 (벼락이 이미 확정한 시전 지점 등) */
  exclude?: Pos,
): Pos[] {
  const all = positionsOf(board, 'normal').filter(
    (p) => exclude === undefined || p.x !== exclude.x || p.y !== exclude.y,
  );
  return shuffled(rng, all).slice(0, Math.max(0, n));
}

/** 빈 칸 하나를 무작위로 고른다. 없으면 undefined */
export function pickEmpty(board: Board, rng: Rng): Pos | undefined {
  return pick(rng, positionsOf(board, 'empty'));
}
