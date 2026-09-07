/* M4~M6 — 판정과 흐름, 다듬은 화면, 통계까지. */

import { useCallback, useState } from 'react';

import { STAGES } from '../data/stages';
import { distortedCountAt, ENDLESS_ID, ENDLESS_SIZE } from '../data/endless';
import { useGame } from '../store/gameStore';
import { unlockedIds } from '../store/stats';
import { BoardView } from './BoardView';
import { HandView } from './HandView';
import { ResultModal } from './ResultModal';
import { StatsPanel } from './StatsPanel';
import { StatusBar } from './StatusBar';
import css from './ui.module.css';

export function App() {
  const game = useGame();
  const [stageId, setStageId] = useState(STAGES[0]?.id ?? '');
  const [hint, setHint] = useState('');

  /* SPEC §1 — 클리어한 단계의 다음이 열린다.
     기록을 지우면 다시 잠기므로, 고른 단계가 잠겼으면 첫 단계로 되돌린다. */
  const unlocked = unlockedIds(
    STAGES.map((s) => s.id),
    game.stats,
  );
  /* 무한모드는 마지막 단계를 클리어해야 열린다 */
  const lastStage = STAGES[STAGES.length - 1];
  const endlessOpen = lastStage !== undefined && (game.stats[lastStage.id]?.cleared ?? 0) > 0;

  const pickedEndless = stageId === ENDLESS_ID && endlessOpen;
  const openStageId = pickedEndless
    ? ENDLESS_ID
    : unlocked.has(stageId)
      ? stageId
      : (STAGES[0]?.id ?? '');
  const stage = STAGES.find((s) => s.id === openStageId) ?? STAGES[0];

  // BoardView 의 effect 의존성이 매 렌더마다 바뀌지 않도록 고정한다
  const onHint = useCallback((h: string) => setHint(h), []);

  if (stage === undefined) return <p>단계 데이터가 없습니다.</p>;
  // 기록이 오기 전에 그리면 열려 있던 단계가 잠긴 채로 한 번 보인다
  if (!game.statsReady) return <p className={css.loading}>기록을 불러오는 중…</p>;

  const state = game.state;
  const over = state !== null && state.status !== 'playing';

  // 이겨서 이어 갈 다음 단계 (마지막 단계면 없음)
  const nextStage =
    state === null || game.round !== null
      ? undefined
      : STAGES[STAGES.findIndex((s) => s.id === state.stage.id) + 1];

  return (
    <main className={[css.page, state !== null ? css.pageWide : ''].filter(Boolean).join(' ')}>
      <div className={css.head}>
        <h1 className={css.title}>석판 부수기</h1>
        {/* 빌드 결과는 web/puzzle/dist/ 에 놓이므로 허브는 두 단계 위다 */}
        <a className={css.back} href="../../index.html">
          ← 게임 목록
        </a>
      </div>

      {state === null ? (
        <>
          <p className={css.intro}>
            정령을 소환해 격자의 고대 석판을 모두 부수면 이깁니다. 왜곡된 석판은 부술 수 없고,
            잘못 건드리면 석판 1~3개가 되살아납니다. 시전을 한 번 할 때마다 석판 하나가 무작위로
            특수 석판이 되는데, 그 칸을 부수면 효과가 터지고 못 부수면 다른 칸으로 옮겨 갑니다.
          </p>
          <div className={css.row}>
            <label>
              <span className={css.statLabel}>단계 </span>
              <select
                className={css.select}
                value={openStageId}
                onChange={(e) => setStageId(e.target.value)}
              >
                {STAGES.map((s, i) => {
                  const open = unlocked.has(s.id);
                  const prev = STAGES[i - 1];
                  return (
                    <option key={s.id} value={s.id} disabled={!open}>
                      {open ? s.label : `🔒 ${s.label} — ${prev?.label ?? ''} 클리어 필요`}
                    </option>
                  );
                })}
                <option value={ENDLESS_ID} disabled={!endlessOpen}>
                  {endlessOpen
                    ? '∞ 무한모드'
                    : `🔒 ∞ 무한모드 — ${lastStage?.label ?? ''} 클리어 필요`}
                </option>
              </select>
            </label>
            <button
              type="button"
              className={css.btn}
              onClick={() => (pickedEndless ? game.startEndless(1) : game.start(stage))}
            >
              시작
            </button>
          </div>

          <p className={css.lockNote}>
            열린 단계 {unlocked.size} / {STAGES.length} — 한 단계를 클리어하면 다음이 열립니다.
            {endlessOpen && ' · 무한모드가 열렸습니다.'}
          </p>

          {pickedEndless && (
            <p className={css.intro}>
              {ENDLESS_SIZE}×{ENDLESS_SIZE} 판에서 라운드를 이어 갑니다. 1라운드는 왜곡이 없고,
              라운드마다 왜곡이 {distortedCountAt(2)}개씩 늘어나며 자리는 매번 새로 정해집니다.
              <strong> 소환 횟수 안에 다 부수지 못하면 그 자리에서 끝납니다.</strong>
            </p>
          )}

          <StatsPanel stats={game.stats} onReset={game.resetStats} />
        </>
      ) : (
        <>
          <StatusBar state={state} round={game.round} />

          {/* 격자 위에는 상태줄만 둔다. 상태줄 높이는 플레이 중 변하지 않으므로
              격자는 구조적으로 움직이지 않는다. 길이가 들쭉날쭉한 힌트는
              격자 아래로 내려 아래쪽만 늘어나게 한다. */}
          <div className={css.play}>
            <div className={css.playMain}>
              <BoardView
                state={state}
                slot={game.slot}
                disabled={over}
                onCast={game.cast}
                onHint={onHint}
              />

              <p className={hint.includes('⚠') ? css.warnLine : css.hintLine}>
                {hint || '석판에 커서를 올리면 부술 범위를 보여 줍니다.'}
              </p>
            </div>

            <aside className={css.playSide}>
              <HandView
                hand={state.hand}
                queue={state.queue}
                selected={game.slot}
                disabled={over}
                onSelect={game.selectSlot}
              />

              <div className={css.sideBtns}>
                <button
                  type="button"
                  className={css.btn}
                  onClick={game.reroll}
                  disabled={over || state.rerollsLeft <= 0}
                >
                  선택한 카드 교체 ({state.rerollsLeft})
                </button>
                <button
                  type="button"
                  className={[css.btn, css.btnQuiet].join(' ')}
                  onClick={game.restart}
                >
                  처음부터
                </button>
                <button
                  type="button"
                  className={[css.btn, css.btnQuiet].join(' ')}
                  onClick={game.abort}
                  disabled={over}
                >
                  게임 중단
                </button>
              </div>
            </aside>
          </div>

          <details className={css.log}>
            <summary>진행 기록 ({state.log.length}턴)</summary>
            <ol>
              {state.log.map((e, i) => (
                <li key={i}>
                  {e.card.id} Lv{e.card.level} → ({e.at.x}, {e.at.y}) · 파괴 {e.destroyed.length}
                  {e.distortedHits.length > 0 && ` · 왜곡 피격 ${e.distortedHits.length}`}
                  {e.regenerated.length > 0 && ` · 재생성 ${e.regenerated.length}`}
                  {e.blessings.length > 0 && ` · ${e.blessings.join(', ')}`}
                </li>
              ))}
            </ol>
            {game.seed !== null && <p>시드 {game.seed}</p>}
          </details>

          {over && game.ending !== null && (
            <ResultModal
              state={state}
              ending={game.ending}
              nextStage={nextStage}
              round={game.round}
              gradeUp={game.gradeUp}
              onNext={() => {
                if (game.round !== null) {
                  game.startEndless(game.round + 1);
                  return;
                }
                if (nextStage === undefined) return;
                setStageId(nextStage.id);
                game.start(nextStage);
              }}
              onRetry={game.restart}
              onClose={game.dismiss}
            />
          )}
        </>
      )}
    </main>
  );
}
