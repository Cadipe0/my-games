/* 화면이 쓰는 상태 보관소. SPEC §2 — Zustand 또는 useReducer 중 하나면 충분하다.
   의존성을 늘리지 않으려고 React 훅만 쓴다.

   RNG 는 판 하나당 하나를 만들어 ref 에 들고 있는다. 이게 중요한 이유:
   mulberry32 는 호출할 때마다 내부 상태가 바뀌므로, setState 의 갱신 함수 안에서
   applyMove 를 부르면 StrictMode 개발 모드에서 두 번 실행돼 난수가 어긋난다.
   그래서 항상 갱신 함수 밖에서 한 번만 계산한 뒤 넣는다.

   통계 기록도 같은 이유로 effect 가 아니라 이벤트 처리 안에서 한 번만 한다. */

import { useEffect, useRef, useState } from 'react';

import { abort as abortGame, applyMove, createGame, reroll as rerollGame } from '../core/engine';
import { createRng, type Rng } from '../core/rng';
import type { GameState, HandSlot, Pos, StageConfig } from '../core/types';
import { endlessStage, ENDLESS_ID } from '../data/endless';
import { clearScores, stageScore, submitScore } from './scores';
import {
  bestGrade,
  clearStats,
  emptyStats,
  loadStats,
  recordEndless,
  recordResult,
  type StatsTable,
} from './stats';

/** 판이 어떻게 끝났는지. 중단은 실패와 구분해서 보여준다 (SPEC §4.1) */
export type Ending = 'cleared' | 'failed' | 'aborted' | null;

export interface GameStore {
  /** 아직 시작하지 않았으면 null */
  state: GameState | null;
  /** 지금 고른 손패 자리 */
  slot: HandSlot;
  /** 이 판의 시드. 같은 판을 다시 보고 싶을 때 쓴다 */
  seed: number | null;
  /** 끝난 방식. 진행 중이면 null */
  ending: Ending;
  stats: StatsTable;
  /** 기록을 다 불러왔는지. 불러오기 전에는 단계 개방을 판단할 수 없다 */
  statsReady: boolean;
  /** 무한모드일 때 지금 라운드. 일반 단계면 null */
  round: number | null;
  /** 이번 클리어로 그 단계의 최고 등급이 올랐으면 '올라오기 전 등급'. 아니면 null */
  gradeUp: 1 | 2 | 3 | null;

  selectSlot(slot: HandSlot): void;
  start(stage: StageConfig, seed?: number): void;
  /** 무한모드 한 라운드를 시작한다. 판은 그때그때 만들어진다 */
  startEndless(round: number, seed?: number): void;
  /** 같은 단계를 새 시드로 다시 */
  restart(): void;
  cast(at: Pos): void;
  reroll(): void;
  abort(): void;
  /** 결과 화면을 닫고 시작 화면으로 */
  dismiss(): void;
  resetStats(): void;
}

/* 같은 칸을 이 시간 안에 다시 누르면 무시한다.
   시전하면 빈 자리가 바로 새 카드로 채워지고 격자도 곧장 다시 눌리는 상태가 된다.
   그래서 실수로 더블클릭하면 두 번째 클릭이 새 카드를 그대로 써 버린다.
   윈도우 기본 더블클릭 간격이 500ms 라 그보다 짧게 잡아, 일부러 빠르게 두는
   플레이는 막지 않으면서 손이 미끄러진 경우만 걸러 낸다. */
const CAST_REPEAT_MS = 400;

export function useGame(): GameStore {
  const rngRef = useRef<Rng | null>(null);
  const lastCastRef = useRef<{ at: Pos; at_t: number } | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [slot, setSlot] = useState<HandSlot>(0);
  const [seed, setSeed] = useState<number | null>(null);
  const [ending, setEnding] = useState<Ending>(null);
  /* 기록은 이제 비동기로 온다(서버로 옮겨도 같은 코드가 되도록).
     오기 전에는 빈 표라서 단계가 전부 잠긴 것처럼 보이므로,
     다 불러왔는지를 statsReady 로 알려 화면이 기다리게 한다. */
  const [stats, setStats] = useState<StatsTable>({});
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadStats().then((table) => {
      if (!alive) return;
      setStats(table);
      setStatsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [round, setRound] = useState<number | null>(null);
  const [gradeUp, setGradeUp] = useState<1 | 2 | 3 | null>(null);

  function start(stage: StageConfig, given?: number): void {
    const s = given ?? (Date.now() >>> 0);
    const rng = createRng(s);
    rngRef.current = rng;
    lastCastRef.current = null;
    setSeed(s);
    setSlot(0);
    setEnding(null);
    setGradeUp(null);
    setRound(null);
    setState(createGame(stage, rng));
  }

  /* 무한모드. 판 생성도 같은 rng 로 하므로 시드가 같으면 판까지 똑같이 재현된다. */
  function startEndless(n: number, given?: number): void {
    const s = given ?? (Date.now() >>> 0);
    const rng = createRng(s);
    rngRef.current = rng;
    lastCastRef.current = null;
    setSeed(s);
    setSlot(0);
    setEnding(null);
    setGradeUp(null);
    setRound(n);
    setState(createGame(endlessStage(n, rng), rng));
  }

  function restart(): void {
    if (state === null) return;
    if (round !== null) {
      // 무한모드에서 '다시'는 1라운드부터다 — 이어서 하면 무한모드가 아니다
      startEndless(1);
      return;
    }
    start(state.stage);
  }

  function cast(at: Pos): void {
    const rng = rngRef.current;
    if (state === null || rng === null || state.status !== 'playing') return;

    // 같은 칸을 연달아 눌렀으면 손이 미끄러진 것으로 본다
    const last = lastCastRef.current;
    const now = Date.now();
    if (last !== null && last.at.x === at.x && last.at.y === at.y && now - last.at_t < CAST_REPEAT_MS) {
      return;
    }
    lastCastRef.current = { at: { ...at }, at_t: now };

    const next = applyMove(state, { slot, at }, rng);
    setState(next);
    setSlot(0);

    if (next.status === 'cleared') {
      setEnding('cleared');
      // 무한모드는 클리어해도 아직 안 끝난다. 기록은 판이 끝날 때 한 번만 남긴다.
      if (round === null) {
        /* 기록을 갱신하기 '전'의 최고 등급과 견줘야 이번에 올랐는지 알 수 있다.
           갱신 뒤에 보면 방금 딴 등급이 이미 최고로 들어가 있어 늘 같아진다. */
        const before = bestGrade(stats[next.stage.id] ?? emptyStats());
        const now = next.grade ?? 1;
        setGradeUp(before !== null && now > before ? before : null);

        setStats((t) =>
          recordResult(t, next.stage.id, {
            kind: 'cleared',
            grade: next.grade ?? 1,
            chargesUsed: next.chargesUsed,
          }),
        );

        // 랭킹에 올릴 한 줄. 통계와 별개로 판마다 하나씩 남는다.
        const grade = next.grade ?? 1;
        submitScore({
          mode: next.stage.id,
          outcome: 'clear',
          score: stageScore(grade, next.chargesUsed, next.stage.charges),
          detail: {
            stage: next.stage.label,
            grade,
            chargesUsed: next.chargesUsed,
            charges: next.stage.charges,
          },
        });
      }
    } else if (next.status === 'failed') {
      setEnding('failed');
      setStats((t) =>
        round === null
          ? recordResult(t, next.stage.id, { kind: 'failed' })
          : // 이번 라운드는 못 깼으므로 돌파한 건 직전 라운드까지다
            recordEndless(t, ENDLESS_ID, round - 1),
      );
      submitEnd(next.stage.id, 'fail');
    }
  }

  function reroll(): void {
    const rng = rngRef.current;
    if (state === null || rng === null || state.status !== 'playing') return;
    if (state.rerollsLeft <= 0) return;
    // 바뀐 카드를 바로 볼 수 있게 고른 자리는 그대로 둔다
    setState(rerollGame(state, slot, rng));
  }

  /* SPEC §4.1 — 중단하면 판이 리셋되고 통계에 '중단'으로 기록된다.
     엔진의 abort() 는 status 를 failed 로 만든다. 통계에서만 실패와 나눠 센다.
     판이 실제로 사라지는 건 결과 화면을 닫을 때다. */
  function abort(): void {
    if (state === null || state.status !== 'playing') return;
    setState(abortGame(state));
    setEnding('aborted');
    setStats((t) =>
      round === null
        ? recordResult(t, state.stage.id, { kind: 'aborted' })
        : recordEndless(t, ENDLESS_ID, round - 1),
    );
    submitEnd(state.stage.id, 'abort');
  }

  /* 판이 끝났는데 클리어가 아닌 경우의 기록.

     일반 단계는 겨룰 점수가 없어서 score 를 null 로 둔다 — 0 점이 아니다.
     무한모드는 다르다. 소환 안에 끝내면 무조건 3성이라 등급으로 겨룰 수
     없고, 대신 "몇 라운드까지 갔나" 가 곧 실력이다. 그래서 돌파한 라운드
     수를 점수로 남긴다. 무한모드는 언젠가 반드시 끝나므로 승패로 나누지
     않고 outcome 을 비워 둔다 (티카투카의 세션 기록과 같은 처지다). */
  function submitEnd(stageId: string, kind: 'fail' | 'abort'): void {
    if (round === null) {
      submitScore({ mode: stageId, outcome: kind, score: null, detail: {} });
      return;
    }
    const cleared = round - 1;
    submitScore({
      mode: ENDLESS_ID,
      outcome: '',
      score: cleared,
      detail: { round: cleared, ended: kind },
    });
  }

  function dismiss(): void {
    setState(null);
    setEnding(null);
    setSeed(null);
    setRound(null);
    setGradeUp(null);
  }

  function resetStats(): void {
    setStats(clearStats());
    void clearScores();   // 서버에 쌓인 판 기록도 함께 지운다
  }

  return {
    state,
    slot,
    seed,
    ending,
    stats,
    statsReady,
    round,
    gradeUp,
    selectSlot: setSlot,
    start,
    startEndless,
    restart,
    cast,
    reroll,
    abort,
    dismiss,
    resetStats,
  };
}
