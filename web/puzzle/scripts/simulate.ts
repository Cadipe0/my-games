/* 자동 플레이로 클리어율과 등급 분포를 본다.
   SPEC §7 — "M2 가 끝난 시점에 CLI 로 1000판 자동 플레이를 돌려 클리어율을 확인한다.
   클리어율이 0% 나 100% 에 가까우면 charges 나 blessingCount 를 조정한다."

   정책 두 가지를 함께 돌린다.
   · 무작위 — SPEC 이 요구한 기준선
   · 탐욕   — 한 수 앞만 보고 기대 파괴량이 가장 큰 자리를 고른다.
             무작위가 못하는 건지 게임이 어려운 건지 구분하려고 같이 잰다.

   실행: npm run simulate            (기본 1000판)
        npm run simulate -- 5000    (판 수 지정) */

import { applyMove, createGame } from '../src/core/engine';
import { countOf, getTile, positionsWhere, sizeOf } from '../src/core/board';
import { chanceAt, getRange, SPIRITS } from '../src/core/spirits';
import { createRng, nextInt, type Rng } from '../src/core/rng';
import { BOLT_COUNT_RANGE, DISTORTED_HIT_REGEN } from '../src/data/config';
import { STAGES } from '../src/data/stages';
import type { GameState, HandSlot, Move, Pos, StageConfig } from '../src/core/types';

/** 한 판이 끝나지 않고 맴도는 걸 막는 상한. 축복이 소환 횟수를 안 깎아서 필요하다 */
const MAX_TURNS = 400;

type Policy = (state: GameState, rng: Rng) => Move;

/* ---------- 정책 1. 무작위 ----------
   석판이 남아 있는 칸 중에서 고른다. 이미 빈 칸에 쏘는 것도 규칙상 가능하지만
   항상 손해라서, 그것까지 섞으면 밸런싱 신호가 흐려진다. */
const randomPolicy: Policy = (state, rng) => {
  const targets = positionsWhere(state.board, (t) => t.kind === 'normal' || t.kind === 'distorted');
  const at = targets[nextInt(rng, 0, targets.length - 1)];
  if (at === undefined) throw new Error('randomPolicy: 쏠 곳이 없다');
  return { slot: nextInt(rng, 0, 1) as HandSlot, at };
};

/* ---------- 정책 2. 탐욕 ----------
   기대 파괴 수 - 왜곡 피격으로 되살아날 수. 한 수 앞만 본다. */
function scoreMove(state: GameState, slot: HandSlot, at: Pos): number {
  const card = state.hand[slot];
  const def = SPIRITS[card.id];

  // 벼락은 위치가 무관하므로 기대 개수에서 0개 확률만큼 빼준다
  if (def.range === null) {
    const [min, max] = BOLT_COUNT_RANGE[card.level];
    const mean = (min + max) / 2;
    const zeroChance = 1 / (max - min + 1);
    return mean - zeroChance;
  }

  let gain = 0;
  let penalty = 0;
  for (const p of getRange(card, at, sizeOf(state.board))) {
    const tile = getTile(state.board, p);
    if (tile === undefined) continue;

    const isCastPoint = p.x === at.x && p.y === at.y;
    const prob = card.level >= 2 || isCastPoint ? 1 : chanceAt(def, at, p);

    if (tile.kind === 'normal') {
      gain += prob;
    } else if (tile.kind === 'distorted') {
      if (def.canDestroyDistorted) continue; // 부숴도 승리 조건과는 무관
      if (card.level === 3) continue; // 건드리지 않는다
      // 재생성 개수가 1~3 랜덤이라 기댓값(2개)으로 값을 매긴다
      const expected = (DISTORTED_HIT_REGEN[0] + DISTORTED_HIT_REGEN[1]) / 2;
      penalty += prob * expected;
    }
  }
  return gain - penalty;
}

const greedyPolicy: Policy = (state) => {
  const cells = positionsWhere(state.board, (t) => t.kind !== 'blocked');
  let best: Move | undefined;
  let bestScore = -Infinity;

  for (const slot of [0, 1] as HandSlot[]) {
    for (const at of cells) {
      const score = scoreMove(state, slot, at);
      if (score > bestScore) {
        bestScore = score;
        best = { slot, at };
      }
    }
  }
  if (best === undefined) throw new Error('greedyPolicy: 쏠 곳이 없다');
  return best;
};

/* ---------- 한 판 ---------- */

interface Outcome {
  status: 'cleared' | 'failed' | 'stuck';
  grade: 1 | 2 | 3 | 0;
  turns: number;
  chargesUsed: number;
  destroyed: number;
  regenerated: number;
  distortedHits: number;
  freeCasts: number;
  leftover: number;
}

function playOnce(stage: StageConfig, policy: Policy, rng: Rng): Outcome {
  let state = createGame(stage, rng);
  let turns = 0;

  while (state.status === 'playing' && turns < MAX_TURNS) {
    state = applyMove(state, policy(state, rng), rng);
    turns++;
  }

  return {
    status: state.status === 'playing' ? 'stuck' : state.status,
    grade: state.grade ?? 0,
    turns,
    chargesUsed: state.chargesUsed,
    destroyed: state.log.reduce((s, e) => s + e.destroyed.length, 0),
    regenerated: state.log.reduce((s, e) => s + e.regenerated.length, 0),
    distortedHits: state.log.reduce((s, e) => s + e.distortedHits.length, 0),
    freeCasts: state.log.filter((e) => e.blessings.includes('blessing')).length,
    leftover: countOf(state.board, 'normal'),
  };
}

/* ---------- 집계 ---------- */

interface Summary {
  stage: StageConfig;
  runs: number;
  cleared: number;
  stuck: number;
  grades: Record<1 | 2 | 3, number>;
  avgTurns: number;
  avgChargesUsed: number;
  avgDestroyed: number;
  avgRegenerated: number;
  avgDistortedHits: number;
  avgFreeCasts: number;
  avgLeftoverOnFail: number;
}

function runStage(stage: StageConfig, policy: Policy, runs: number, seed: number): Summary {
  const grades: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  let cleared = 0;
  let stuck = 0;
  let turns = 0;
  let chargesUsed = 0;
  let destroyed = 0;
  let regenerated = 0;
  let distortedHits = 0;
  let freeCasts = 0;
  let leftover = 0;
  let failures = 0;

  for (let i = 0; i < runs; i++) {
    // 판마다 다른 시드를 주되 전체는 재현 가능하게 둔다
    const out = playOnce(stage, policy, createRng(seed + i * 7919));

    turns += out.turns;
    chargesUsed += out.chargesUsed;
    destroyed += out.destroyed;
    regenerated += out.regenerated;
    distortedHits += out.distortedHits;
    freeCasts += out.freeCasts;

    if (out.status === 'cleared') {
      cleared++;
      if (out.grade === 1 || out.grade === 2 || out.grade === 3) grades[out.grade]++;
    } else {
      if (out.status === 'stuck') stuck++;
      failures++;
      leftover += out.leftover;
    }
  }

  return {
    stage,
    runs,
    cleared,
    stuck,
    grades,
    avgTurns: turns / runs,
    avgChargesUsed: chargesUsed / runs,
    avgDestroyed: destroyed / runs,
    avgRegenerated: regenerated / runs,
    avgDistortedHits: distortedHits / runs,
    avgFreeCasts: freeCasts / runs,
    avgLeftoverOnFail: failures > 0 ? leftover / failures : 0,
  };
}

/* ---------- 출력 ---------- */

const pct = (n: number, total: number): string => ((n / total) * 100).toFixed(1) + '%';
const padR = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

function countChar(stage: StageConfig, ch: string): number {
  return stage.layout.join('').split(ch).length - 1;
}

function reportClearRate(title: string, summaries: readonly Summary[]): void {
  console.log(`\n${title}\n`);
  console.log(
    padR('단계', 8) +
      padL('석판', 6) +
      padL('왜곡', 6) +
      padL('소환', 6) +
      padL('클리어율', 11) +
      padL('3성', 8) +
      padL('2성', 8) +
      padL('1성', 8),
  );
  console.log('-'.repeat(61));
  for (const s of summaries) {
    console.log(
      padR(s.stage.label, 8) +
        padL(String(countChar(s.stage, 'O')), 6) +
        padL(String(countChar(s.stage, 'X')), 6) +
        padL(String(s.stage.charges), 6) +
        padL(pct(s.cleared, s.runs), 11) +
        padL(s.cleared ? pct(s.grades[3], s.cleared) : '-', 8) +
        padL(s.cleared ? pct(s.grades[2], s.cleared) : '-', 8) +
        padL(s.cleared ? pct(s.grades[1], s.cleared) : '-', 8),
    );
  }
}

function reportDetail(title: string, summaries: readonly Summary[]): void {
  console.log(`\n${title}\n`);
  console.log(
    padR('단계', 8) +
      padL('턴', 7) +
      padL('소환소모', 10) +
      padL('파괴', 8) +
      padL('재생성', 8) +
      padL('왜곡피격', 10) +
      padL('축복', 7) +
      padL('실패시남음', 12),
  );
  console.log('-'.repeat(70));
  for (const s of summaries) {
    console.log(
      padR(s.stage.label, 8) +
        padL(s.avgTurns.toFixed(1), 7) +
        padL(s.avgChargesUsed.toFixed(1), 10) +
        padL(s.avgDestroyed.toFixed(1), 8) +
        padL(s.avgRegenerated.toFixed(1), 8) +
        padL(s.avgDistortedHits.toFixed(2), 10) +
        padL(s.avgFreeCasts.toFixed(2), 7) +
        padL(s.avgLeftoverOnFail.toFixed(1), 12),
    );
  }
}

/* ---------- 진입점 ---------- */

const runs = Number(process.argv[2] ?? 1000) || 1000;

const randomRuns = STAGES.map((stage, i) =>
  runStage(stage, randomPolicy, runs, 20260903 + i * 1000003),
);
const greedyRuns = STAGES.map((stage, i) =>
  runStage(stage, greedyPolicy, runs, 20260903 + i * 1000003),
);

console.log(`\n자동 플레이 — 단계당 ${runs}판씩, 정책 2종`);
reportClearRate('[무작위] 전략 없이 남은 석판 중 아무 곳에나', randomRuns);
reportClearRate('[탐욕] 한 수 앞 기대 파괴량이 가장 큰 자리', greedyRuns);
reportDetail('[무작위] 한 판 평균', randomRuns);
reportDetail('[탐욕] 한 판 평균', greedyRuns);

const stuck = [...randomRuns, ...greedyRuns].reduce((n, s) => n + s.stuck, 0);
if (stuck > 0) console.log(`\n경고: ${MAX_TURNS}턴을 넘겨 강제 종료된 판 ${stuck}건`);
console.log('');
