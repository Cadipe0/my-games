/* M6 — 단계별 최고 기록 (SPEC §1, §5 StatsPanel).
   등급별 횟수 대신 "그 단계를 몇 성으로 깼는가" 한 값만 보여 준다.
   기록 자체는 store/stats.ts 에 그대로 쌓이므로 나중에 되살릴 수 있다. */

import { useEffect, useState } from 'react';

import { STAGES } from '../data/stages';
import { ENDLESS_ID } from '../data/endless';
import { savedNickname } from '../store/scores';
import { bestGrade, emptyStats, totalOf, type StageStats, type StatsTable } from '../store/stats';
import css from './ui.module.css';

interface Props {
  stats: StatsTable;
  onReset: () => void;
}

/** 세 칸 폭을 고정해 단계별 등급이 세로로 나란히 읽히게 한다 */
function Stars({ grade }: { grade: 1 | 2 | 3 | null }) {
  if (grade === null) {
    return (
      <span className={css.muted} title="아직 클리어하지 않았습니다">
        ☆☆☆
      </span>
    );
  }
  return <span title={`최고 ${grade}성`}>{'★'.repeat(grade) + '☆'.repeat(3 - grade)}</span>;
}

function Row({ label, s }: { label: string; s: StageStats }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        <Stars grade={bestGrade(s)} />
      </td>
      <td>{s.bestCharges ?? <span className={css.muted}>—</span>}</td>
    </tr>
  );
}

/* 두 번 눌러야 지워진다. 한 번 누르면 빨갛게 바뀌고, 그대로 두면 잠시 뒤
   저절로 원래대로 돌아간다. 다른 게임의 초기화 버튼(web/reset-ui.js)과
   같은 방식이다 — 지우는 건 되돌릴 수 없으니 손이 미끄러진 것과 정말
   누른 것을 구분해야 한다. */
const ARM_MS = 4000;

/* 무엇이 지워지는지 분명히 적는다. 로그인이 없어서 지워지는 단위는 사람이
   아니라 이 브라우저다 — 이름을 아직 정하지 않았으면 그대로 적는다.
   web/reset-ui.js 의 다른 초기화 버튼들과 같은 문구다. */
function confirmText(): string {
  const n = savedNickname();
  return (n ? n + '님의' : '이 브라우저의') + ' 기록을 삭제합니다';
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={[css.btn, armed ? css.btnDanger : css.btnQuiet].join(' ')}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onReset();
      }}
    >
      {armed ? confirmText() : '기록 지우기'}
    </button>
  );
}

export function StatsPanel({ stats, onReset }: Props) {
  const total = totalOf(stats);

  if (total.plays === 0) {
    return (
      <section className={css.panel}>
        <p className={css.muted}>아직 기록이 없습니다. 한 판 끝내면 여기에 쌓입니다.</p>
      </section>
    );
  }

  const clearedStages = STAGES.filter((s) => (stats[s.id]?.cleared ?? 0) > 0).length;
  const bestRound = stats[ENDLESS_ID]?.bestRound;

  return (
    <section className={css.panel}>
      <div className={css.head}>
        <strong>기록</strong>
        <ResetButton onReset={onReset} />
      </div>

      <table className={css.table}>
        <thead>
          <tr>
            <th scope="col">단계</th>
            <th scope="col">등급</th>
            <th scope="col">최소 소환</th>
          </tr>
        </thead>
        <tbody>
          {STAGES.map((stage) => (
            <Row key={stage.id} label={stage.label} s={stats[stage.id] ?? emptyStats()} />
          ))}
        </tbody>
      </table>

      <p className={css.muted} style={{ fontSize: '0.82rem' }}>
        클리어한 단계 {clearedStages} / {STAGES.length} · 등급과 최소 소환은 모두 최고 기록입니다.
        {bestRound !== undefined && bestRound > 0 && ` · 무한모드 최고 ${bestRound}라운드`}
      </p>
    </section>
  );
}
