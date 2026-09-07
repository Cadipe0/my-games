/* 손패 2장과 다음 큐 미리보기 (SPEC §6 — 강화 레벨은 배지로 표시).

   넓은 화면에서는 격자 옆 세로 칸에 놓인다. 그래서 가로로 늘어놓지 않고
   위에서 아래로 쌓는다 — 다음 정령의 순서도 위→아래로 자연스럽게 읽힌다. */

import { SPIRITS } from '../core/spirits';
import { FALLOFF_MIN, FALLOFF_STEP, QUEUE_PREVIEW } from '../data/config';
import type { HandSlot, SpiritCard } from '../core/types';
import { RangeMini } from './RangeMini';
import css from './ui.module.css';

interface Props {
  hand: readonly [SpiritCard, SpiritCard];
  queue: readonly SpiritCard[];
  selected: HandSlot;
  disabled: boolean;
  onSelect: (slot: HandSlot) => void;
}

/** 벼락은 범위가 없어 설명이 다르다 (SPEC §4.4) */
function hint(card: SpiritCard): string {
  const def = SPIRITS[card.id];
  if (def.range === null) return '지정한 칸 확정 · 나머지는 무작위';

  const parts: string[] = [];
  if (card.level >= 2) parts.push('범위 전체 확정');
  else if (def.falloff)
    parts.push(
      `멀수록 약함 100→${Math.round(FALLOFF_MIN * 100)}% (칸당 -${Math.round(FALLOFF_STEP * 100)}%p)`,
    );
  else parts.push(`나머지 ${Math.round(def.destroyChance * 100)}%`);
  if (def.canDestroyDistorted) parts.push('왜곡 파괴 가능');
  else if (card.level === 3) parts.push('왜곡 건드리지 않음');
  return parts.join(' · ');
}

/** 순서를 알 수 있게 번호를 붙인다 */
const ORDER = ['①', '②', '③', '④'];

export function HandView({ hand, queue, selected, disabled, onSelect }: Props) {
  const next = queue.slice(0, QUEUE_PREVIEW);

  return (
    <>
      <h2 className={css.sideTitle}>손패</h2>
      <div className={css.hand}>
        {hand.map((card, i) => {
          const slot = i as HandSlot;
          const on = slot === selected;
          return (
            <button
              key={slot}
              type="button"
              className={[css.card, on ? css.cardOn : ''].filter(Boolean).join(' ')}
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onSelect(slot)}
            >
              <RangeMini card={card} />
              <span className={css.cardBody}>
                <span className={css.cardName}>
                  {SPIRITS[card.id].name}
                  <span
                    className={[css.lv, card.level === 3 ? css.lv3 : ''].filter(Boolean).join(' ')}
                  >
                    Lv{card.level}
                  </span>
                </span>
                <small className={css.cardHint}>{hint(card)}</small>
              </span>
            </button>
          );
        })}
      </div>

      <h2 className={css.sideTitle}>다음</h2>
      {next.length === 0 ? (
        <p className={css.muted}>(없음)</p>
      ) : (
        <ol className={css.queue}>
          {next.map((c, i) => (
            <li key={i} className={css.queueItem}>
              <span className={css.queueNo} aria-hidden="true">
                {ORDER[i]}
              </span>
              <span className={css.queueName}>{SPIRITS[c.id].name}</span>
              <span className={css.lv}>Lv{c.level}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
