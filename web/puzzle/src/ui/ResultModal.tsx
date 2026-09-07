/* 결과 화면 (SPEC §5 ResultModal).
   중단은 실패와 따로 표시한다 — 통계에서도 따로 세기 때문이다 (SPEC §4.1). */

import { useEffect, useRef } from 'react';

import { countOf } from '../core/board';
import type { GameState, StageConfig } from '../core/types';
import { ENDLESS_DISTORTED_STEP } from '../data/endless';
import type { Ending } from '../store/gameStore';
import css from './ui.module.css';

interface Props {
  state: GameState;
  ending: Exclude<Ending, null>;
  /** 이겨서 열린 다음 단계. 마지막 단계였으면 undefined */
  nextStage?: StageConfig | undefined;
  /** 무한모드면 방금 치른 라운드 번호 */
  round?: number | null;
  /** 이번 클리어로 최고 등급이 올랐으면 '올라오기 전 등급' */
  gradeUp?: 1 | 2 | 3 | null;
  onNext: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function ResultModal({
  state,
  ending,
  nextStage,
  round,
  gradeUp,
  onNext,
  onRetry,
  onClose,
}: Props) {
  const firstRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grade = state.grade ?? 1;
  const left = countOf(state.board, 'normal');

  const endless = round != null;
  /** 무한모드에서 실제로 돌파한 라운드 수 (이번 라운드는 못 깼으므로 하나 뺀다) */
  const cleared = (round ?? 1) - 1;

  const title = endless
    ? ending === 'cleared'
      ? `${round}라운드 돌파`
      : ending === 'aborted'
        ? '중단했습니다'
        : '여기까지'
    : ending === 'cleared'
      ? '석판을 모두 부쉈습니다'
      : ending === 'aborted'
        ? '중단했습니다'
        : '실패';

  const sub = endless
    ? ending === 'cleared'
      ? `소환 ${state.chargesUsed}회로 끝냈습니다 · 다음은 왜곡이 ${ENDLESS_DISTORTED_STEP}개 늘어납니다`
      : ending === 'aborted'
        ? cleared === 0
          ? '한 라운드도 돌파하지 못했습니다'
          : `${cleared}라운드까지 돌파했습니다`
        : `${round}라운드에서 석판 ${left}개를 남기고 소환이 떨어졌습니다 · 돌파 ${cleared}라운드`
    : ending === 'cleared'
      ? `${state.stage.label} · 소환 ${state.chargesUsed}회 (3성 ${state.stage.gradeThresholds[3]}회 이하, 2성 ${state.stage.gradeThresholds[2]}회 이하)`
      : ending === 'aborted'
        ? `${state.stage.label} · 석판 ${left}개를 남기고 그만뒀습니다`
        : `${state.stage.label} · 소환을 다 쓰고도 석판 ${left}개가 남았습니다`;

  return (
    <div className={css.modalBack} role="dialog" aria-modal="true" aria-label="판 결과">
      <div className={css.modal}>
        <h2 className={css.modalTitle}>{title}</h2>
        {ending === 'cleared' && !endless && (
          <p className={css.grade} aria-label={`${grade}성`}>
            {'★'.repeat(grade)}
            <span className={css.muted}>{'☆'.repeat(3 - grade)}</span>
          </p>
        )}
        {ending === 'cleared' && !endless && gradeUp != null && (
          <p className={css.gradeUp}>
            최고 등급이 올랐습니다
            <span className={css.gradeUpFrom}>
              {'★'.repeat(gradeUp)}
              {'☆'.repeat(3 - gradeUp)}
            </span>
            →
            <strong>
              {'★'.repeat(grade)}
              {'☆'.repeat(3 - grade)}
            </strong>
          </p>
        )}
        <p className={css.modalSub}>{sub}</p>
        {ending === 'cleared' && !endless && nextStage === undefined && (
          <p className={css.modalSub}>마지막 단계까지 모두 깼습니다.</p>
        )}

        <div className={css.row}>
          {/* 이겼으면 다음 단계로 바로 이어서 갈 수 있게 한다 */}
          {ending === 'cleared' && (endless || nextStage !== undefined) && (
            <button ref={firstRef} type="button" className={css.btn} onClick={onNext}>
              {endless ? `다음 라운드 (${(round ?? 0) + 1}) →` : `다음 단계 (${nextStage?.label}) →`}
            </button>
          )}
          <button
            ref={ending === 'cleared' && (endless || nextStage !== undefined) ? undefined : firstRef}
            type="button"
            className={[
              css.btn,
              ending === 'cleared' && (endless || nextStage !== undefined) ? css.btnQuiet : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onRetry}
          >
            {endless ? '1라운드부터 다시' : '같은 단계 다시'}
          </button>
          <button type="button" className={[css.btn, css.btnQuiet].join(' ')} onClick={onClose}>
            단계 고르기
          </button>
        </div>
      </div>
    </div>
  );
}
