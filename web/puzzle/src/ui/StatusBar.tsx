/* 남은 횟수, 교체 횟수, 예상 등급 (SPEC §5 StatusBar) */

import { countOf, positionsWhere } from '../core/board';
import { projectedGrade } from '../core/engine';
import { getTile } from '../core/board';
import type { Blessing, GameState } from '../core/types';
import { BLESSING_COLOR, BLESSING_NAME } from './labels';
import css from './ui.module.css';

interface Props {
  state: GameState;
  /** 무한모드면 지금 라운드 */
  round?: number | null;
}

function Stat({
  label,
  value,
  low,
  color,
}: {
  label: string;
  value: string;
  low?: boolean;
  /** 특수칸처럼 판 위의 색과 짝지어야 할 때 쓴다 */
  color?: string;
}) {
  return (
    <span className={css.stat}>
      <span className={css.statLabel}>{label}</span>
      <span
        className={[css.statValue, low === true ? css.statLow : ''].filter(Boolean).join(' ')}
        style={color === undefined ? undefined : { color }}
      >
        {value}
      </span>
    </span>
  );
}

export function StatusBar({ state, round }: Props) {
  const normals = countOf(state.board, 'normal');
  const distorted = countOf(state.board, 'distorted');
  const grade = projectedGrade(state);

  /* SPEC §4.5 — 특수 석판은 매 턴 자리와 효과가 바뀐다. 지금 무엇들이 있는지 적어 준다.
     단계에 따라 둘 이상일 수 있으므로(7단계·무한모드) 하나만 보여주면 나머지를 놓친다. */
  const present = positionsWhere(
    state.board,
    (t) => t.kind === 'normal' && t.blessing !== undefined,
  )
    .map((p) => getTile(state.board, p)?.blessing)
    .filter((b): b is Blessing => b !== undefined);

  return (
    <div className={css.status}>
      {round != null && <Stat label="라운드" value={String(round)} />}
      <Stat label="남은 소환" value={String(state.chargesLeft)} low={state.chargesLeft <= 2} />
      <Stat label="남은 석판" value={String(normals)} />
      <Stat label="왜곡" value={String(distorted)} />
      <Stat label="남은 교체" value={String(state.rerollsLeft)} />
      {round == null && (
        <Stat label="지금 끝내면" value={'★'.repeat(grade) + '☆'.repeat(3 - grade)} />
      )}
      {/* 판 위의 테두리 색과 같은 색으로 적어, 무슨 색이 무슨 효과인지 저절로 익게 한다 */}
      <span className={css.stat}>
        <span className={css.statLabel}>특수칸</span>
        <span className={css.statValue}>
          {present.length === 0
            ? '없음'
            : present.map((b, i) => (
                <span key={i} style={{ color: BLESSING_COLOR[b] }}>
                  {i > 0 && <span className={css.muted}> · </span>}
                  {BLESSING_NAME[b]}
                </span>
              ))}
        </span>
      </span>
    </div>
  );
}
