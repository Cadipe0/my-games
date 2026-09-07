/* 격자 — 렌더링, 범위 미리보기, 클릭·키보드·탭 시전.

   SPEC §6
   · blocked 는 렌더링하지 않아 보드 실루엣이 드러난다
   · 확정 파괴와 확률 파괴를 시각적으로 구분한다
   · 범위 안에 왜곡이 있으면 경고색으로 — 이 게임의 핵심 판단 정보
   · 왜곡은 색만이 아니라 모양(육각 클립)과 글자로도 구분한다
   · 호버가 없는 기기에서는 탭 1회 = 미리보기, 탭 2회 = 시전
   · 키보드로 격자 이동과 시전이 가능하다 */

import { useEffect, useMemo, useState } from 'react';

import { previewMove } from '../core/engine';
import type { CellEffect, CellPreview } from '../core/engine';
import { SPIRITS, type SpiritMotif } from '../core/spirits';
import type { Board, GameState, HandSlot, MoveLogEntry, Pos, Tile } from '../core/types';
import { BLESSING_COLOR, BLESSING_INK, BLESSING_MARK, BLESSING_NAME } from './labels';
import css from './ui.module.css';

interface Props {
  state: GameState;
  /** 지금 고른 손패 자리. 미리보기가 이 카드 기준으로 계산된다 */
  slot: HandSlot;
  disabled: boolean;
  onCast: (at: Pos) => void;
  /** 미리보기 설명을 바깥(손패 아래)에 띄우기 위해 올려 준다 */
  onHint: (hint: string) => void;
}

const EFFECT_CLASS: Record<CellEffect, string> = {
  certain: css.fxCertain ?? '',
  chance: css.fxChance ?? '',
  'distorted-hit': css.fxDistortedHit ?? '',
  'distorted-destroy': css.fxDistortedDestroy ?? '',
  'distorted-safe': css.fxDistortedSafe ?? '',
};

const key = (p: Pos): string => `${p.x},${p.y}`;

/** 정령 계열마다 터지는 모습이 다르다 (SPEC §6). 격자에 붙여 한 번에 갈아 끼운다. */
const MOTIF_CLASS: Record<SpiritMotif, string> = {
  fire: css.mFire ?? '',
  bolt: css.mBolt ?? '',
  blast: css.mBlast ?? '',
  wind: css.mWind ?? '',
  earth: css.mEarth ?? '',
  water: css.mWater ?? '',
  light: css.mLight ?? '',
};

/** 칸 모서리에 붙는 짧은 표시. 무엇이 일어나는지 글자로도 알 수 있게 한다 */
function markOf(effect: CellEffect, chance: number): string {
  switch (effect) {
    case 'certain':
      return '확';
    case 'chance':
      return Math.round(chance * 100) + '%';
    case 'distorted-hit':
      // 시전 지점이거나 Lv2 면 확정, 아니면 그 확률로만 맞는다
      return chance >= 1 ? '⚠확' : `⚠${Math.round(chance * 100)}%`;
    case 'distorted-destroy':
      return '확';
    case 'distorted-safe':
      return '—';
  }
}

/** 정령을 놓을 수 있는 칸인가. 부서진 칸과 보드 밖에는 놓을 수 없다 */
function isCastable(board: Board, p: Pos): boolean {
  const kind = board[p.y]?.[p.x]?.kind;
  return kind === 'normal' || kind === 'distorted';
}

/* 커서 초기값을 (0,0) 으로 두면 그 칸이 보드 밖(blocked)일 때 격자에
   tabIndex 0 인 버튼이 하나도 없어 Tab 으로 들어갈 수 없다.
   그래서 처음 놓을 수 있는 칸을 찾아 커서를 얹는다. */
function firstOpenCell(board: Board): Pos {
  for (let y = 0; y < board.length; y++) {
    const row = board[y];
    if (row === undefined) continue;
    for (let x = 0; x < row.length; x++) {
      if (isCastable(board, { x, y })) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

/** 석판마다 실금 각도를 조금씩 다르게 하려고 좌표로 흔든다 */
function crackSeed(x: number, y: number): number {
  return ((x * 7 + y * 13) % 21) - 10;
}

function describe(tile: Tile): string {
  if (tile.kind === 'distorted') return '왜곡된 고대 석판 — 파괴 대상이 아님';
  if (tile.kind === 'empty') return '빈 칸';
  if (tile.kind === 'normal') {
    return tile.blessing === undefined
      ? '고대 석판'
      : `고대 석판 · 특수(${BLESSING_NAME[tile.blessing]})`;
  }
  return '보드 밖';
}

/* ---------- 파괴 이펙트 (SPEC §6) ----------
   이전 판과 지금 판을 비교해 추측하지 않고, 엔진이 남긴 로그를 그대로 쓴다.
   비교 방식으로는 파괴와 재생성이 구분되지 않고, 왜곡 피격은 kind 가 그대로라
   아예 잡히지 않는다. */

/** 시전 지점에서 한 칸 멀어질 때마다 파괴가 이만큼 늦게 시작한다 (터져 나가 보이게) */
const BREAK_STEP = 30;
/** 아무리 멀어도 이보다 늦게 시작하지는 않는다. 15x15 에서 끝없이 늘어지는 걸 막는다 */
const BREAK_DELAY_MAX = 240;
/** 벼락은 범위가 없어 거리 대신 순번으로 늦춘다 — 차례로 내리치는 모양이 된다 */
const BOLT_STEP = 45;
/** 되살아나는 칸은 파괴가 어느 정도 끝난 뒤에 나타난다 */
const REGEN_BASE = 180;
const REGEN_STEP = 55;
/** 애니메이션 한 칸의 길이 */
const FX_DUR = 260;

interface TurnFx {
  /** 부서지는 칸 → 시작 지연(ms) */
  broke: Map<string, number>;
  /** 되살아나는 칸 → 시작 지연(ms) */
  grew: Map<string, number>;
  /** 때렸지만 부수지 못한 왜곡 칸 */
  hits: Set<string>;
  /** 왜곡을 때렸으면 격자 전체가 한 번 흔들린다 */
  shake: boolean;
  /** 이번에 쓴 정령의 계열. 없으면 이펙트가 없는 상태다 */
  motif: SpiritMotif | null;
}

const NO_FX: TurnFx = {
  broke: new Map(),
  grew: new Map(),
  hits: new Set(),
  shake: false,
  motif: null,
};

/** 거리 감쇠와 같은 자로 잰다 — 가로·세로·대각 모두 한 칸이 1 */
function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function useTurnFx(log: readonly MoveLogEntry[]): TurnFx {
  const [fx, setFx] = useState<TurnFx>(NO_FX);
  const turn = log.length;

  useEffect(() => {
    const entry = log[turn - 1];
    if (entry === undefined) {
      setFx(NO_FX);
      return;
    }

    /* 재배치가 터진 턴은 좌표를 쓸 수 없다. 엔진이 파괴·재생성을 먼저 처리하고
       그 뒤에 판을 통째로 섞기 때문에(engine.applyMove 2~3단계), 로그의 좌표가
       가리키는 칸에는 이미 다른 석판이 앉아 있다. 엉뚱한 칸이 터지느니 넘긴다.
       왜곡 피격 표시도 같은 이유로 뺀다. */
    if (entry.blessings.includes('reshuffle')) {
      setFx(NO_FX);
      return;
    }

    const isBolt = SPIRITS[entry.card.id].range === null;

    const broke = new Map<string, number>();
    entry.destroyed.forEach((p, i) => {
      const delay = isBolt ? i * BOLT_STEP : chebyshev(entry.at, p) * BREAK_STEP;
      broke.set(key(p), Math.min(delay, BREAK_DELAY_MAX));
    });

    const grew = new Map<string, number>();
    entry.regenerated.forEach((p, i) => grew.set(key(p), REGEN_BASE + i * REGEN_STEP));

    const hits = new Set(entry.distortedHits.map(key));

    if (broke.size === 0 && grew.size === 0 && hits.size === 0) {
      setFx(NO_FX);
      return;
    }
    setFx({ broke, grew, hits, shake: hits.size > 0, motif: SPIRITS[entry.card.id].motif });

    const last = Math.max(0, ...broke.values(), ...grew.values());
    const timer = window.setTimeout(() => setFx(NO_FX), last + FX_DUR + 40);
    return () => window.clearTimeout(timer);
    // 로그가 한 줄 늘어날 때만 다시 돈다. 정령 교체는 turn 을 바꾸지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  return fx;
}

export function BoardView({ state, slot, disabled, onCast, onHint }: Props) {
  const board = state.board;
  const width = board[0]?.length ?? 0;

  // 호버가 없는 기기인지 (SPEC §6 — 모바일은 탭 두 번)
  const coarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
    [],
  );

  const [hover, setHover] = useState<Pos | null>(null);
  const [armed, setArmed] = useState<Pos | null>(null);
  const [cursor, setCursor] = useState<Pos>(() => firstOpenCell(board));
  const fx = useTurnFx(state.log);

  // 판이 바뀌어 커서가 보드 밖에 얹혔으면 놓을 수 있는 첫 칸으로 되돌린다
  const activeCursor = isCastable(board, cursor) ? cursor : firstOpenCell(board);

  const focus = coarse ? armed : hover;
  const preview = focus === null || disabled ? null : previewMove(state, slot, focus);

  useEffect(() => {
    if (focus === null || preview === null) {
      onHint('');
      return;
    }
    if (preview.isBolt) {
      const [min, max] = preview.boltRange ?? [0, 0];
      // 시전 지점이 석판이면 그 칸은 확정이고, 나머지만 무작위다
      const aimed = preview.cells.length > 0;
      onHint(
        aimed
          ? `벼락 — 이 칸은 확정으로 부숩니다. 남은 석판 중 ${min - 1}~${max - 1}개를 무작위로 더 부숩니다.`
          : `벼락 — 왜곡은 부술 수 없습니다. 남은 석판 중 ${min}~${max}개를 무작위로 부숩니다.`,
      );
      return;
    }

    const certain = preview.cells.filter(
      (c) => c.effect === 'certain' || c.effect === 'distorted-destroy',
    ).length;
    const chance = preview.cells.filter((c) => c.effect === 'chance').length;

    const parts: string[] = [];
    parts.push(certain > 0 ? `확실히 부숨 ${certain}칸` : '확실히 부수는 칸 없음');
    if (chance > 0) {
      const [lo, hi] = preview.chanceRange ?? [0, 0];
      const pct = (v: number) => Math.round(v * 100);
      // 거리에 따라 떨어지는 정령은 칸마다 확률이 다르다
      const range = lo === hi ? `${pct(hi)}%` : `${pct(hi)}~${pct(lo)}%`;
      parts.push(`${range} 확률 ${chance}칸`);
    }
    if (preview.willRegenerate) {
      const p = preview.distortedHitChance ?? 1;
      parts.push(
        p >= 1
          ? '⚠ 왜곡을 확정으로 때립니다 — 석판 1~3개가 되살아납니다'
          : `⚠ 왜곡을 ${Math.round(p * 100)}% 확률로 때립니다 — 맞으면 석판 1~3개가 되살아납니다`,
      );
    }
    onHint(parts.join('  ·  '));
  }, [focus, preview, onHint]);

  const cellAt = new Map<string, CellPreview>();
  if (preview !== null) {
    for (const c of preview.cells) cellAt.set(key(c.pos), c);
  }

  function activate(at: Pos): void {
    if (disabled) return;
    if (!coarse) {
      onCast(at);
      return;
    }
    // 탭 1회 = 미리보기, 탭 2회 = 시전
    if (armed !== null && armed.x === at.x && armed.y === at.y) {
      setArmed(null);
      onCast(at);
    } else {
      setArmed(at);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = step[e.key];
    if (move === undefined) return;
    e.preventDefault();

    // 보드 밖과 부서진 칸은 건너뛰고 다음 놓을 수 있는 칸으로 간다
    let { x, y } = activeCursor;
    for (let i = 0; i < Math.max(width, board.length) + 1; i++) {
      x += move[0];
      y += move[1];
      if (x < 0 || y < 0 || y >= board.length || x >= width) return;
      if (isCastable(board, { x, y })) break;
    }
    if (!isCastable(board, { x, y })) return;
    setCursor({ x, y });
    setHover({ x, y });
    const el = document.getElementById(`cell-${x}-${y}`);
    el?.focus();
  }

  return (
    <div
      className={[
        css.board,
        preview !== null && !preview.isBolt ? css.previewing : '',
        fx.shake ? css.shaking : '',
        fx.motif !== null ? MOTIF_CLASS[fx.motif] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="grid"
      aria-label="석판 격자"
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        // 칸이 --tile 보다 커지지는 않게 막는다
        maxWidth: `calc(${width} * var(--tile) + ${width + 1} * var(--gap))`,
      }}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(null)}
    >
      {board.flatMap((row, y) =>
        row.map((tile, x) => {
          const at = { x, y };
          const k = key(at);

          if (tile.kind === 'blocked') {
            return <span key={k} className={css.void} aria-hidden="true" />;
          }

          const cell = cellAt.get(k);
          const effect = cell?.effect;
          const isOrigin = focus !== null && focus.x === x && focus.y === y;
          const isArmed = armed !== null && armed.x === x && armed.y === y;

          const classes = [
            css.cell,
            tile.kind === 'distorted' ? css.distorted : '',
            tile.kind === 'empty' ? css.empty : '',
            tile.kind === 'normal' && tile.blessing !== undefined ? css.hasBlessing : '',
            effect !== undefined ? css.inRange : '',
            effect !== undefined ? EFFECT_CLASS[effect] : '',
            isOrigin ? css.origin : '',
            isArmed && !isOrigin ? css.armed : '',
            fx.broke.has(k) ? css.breaking : '',
            fx.grew.has(k) ? css.appearing : '',
            fx.hits.has(k) ? css.hitting : '',
          ]
            .filter(Boolean)
            .join(' ');

          const label = describe(tile);

          return (
            <button
              key={k}
              id={`cell-${x}-${y}`}
              type="button"
              className={classes}
              disabled={disabled || tile.kind === 'empty'}
              tabIndex={activeCursor.x === x && activeCursor.y === y ? 0 : -1}
              aria-label={`${x + 1}열 ${y + 1}행, ${label}`}
              title={label}
              style={{
                ['--seed' as string]: crackSeed(x, y),
                ['--fx-delay' as string]: `${fx.broke.get(k) ?? fx.grew.get(k) ?? 0}ms`,
                // 특수칸이면 효과마다 다른 색으로 테두리와 배지를 칠한다
                ...(tile.kind === 'normal' && tile.blessing !== undefined
                  ? {
                      ['--bless' as string]: BLESSING_COLOR[tile.blessing],
                      ['--bless-ink' as string]: BLESSING_INK[tile.blessing],
                    }
                  : {}),
              }}
              onMouseEnter={() => !coarse && setHover(at)}
              onFocus={() => setHover(at)}
              onClick={() => activate(at)}
            >
              <span className={css.stone} aria-hidden="true" />
              {/* 부서지는 칸에만 잠깐 얹힌다. 칸은 이미 empty 라서 .stone 만으로는
                  아무것도 보이지 않는다 — 석판의 잔상과 튀는 파편을 여기서 그린다 */}
              {fx.broke.has(k) && <span className={css.shards} aria-hidden="true" />}
              {effect !== undefined && (
                <span
                  className={[css.mark, effect === 'distorted-hit' ? css.markWarn : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden="true"
                >
                  {markOf(effect, cell?.chance ?? 0)}
                </span>
              )}
              {tile.kind === 'normal' && tile.blessing !== undefined ? (
                <span className={css.blessing}>{BLESSING_MARK[tile.blessing]}</span>
              ) : (
                <span
                  className={[
                    css.glyph,
                    tile.kind === 'distorted' ? css.glyphDistorted : '',
                    tile.kind === 'empty' ? css.glyphEmpty : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {tile.kind === 'distorted' ? '✕' : tile.kind === 'empty' ? '·' : ''}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
