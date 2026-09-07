/* M6 — 통계. SPEC §1 "로컬 통계(플레이 횟수, 성공률, 등급 분포) 저장".
   키 하나에 모아 두고, 실제 저장은 storage.ts 가 맡는다 (지금은 localStorage).

   중단은 실패와 따로 센다. SPEC §4.1 이 "중단하면 통계에 '중단'으로 기록된다"고
   구분하기 때문이다. GameState.status 에는 'aborted' 가 없으므로(§3 의 타입이
   'playing' | 'cleared' | 'failed' 로 고정) 판정은 이 층에서만 나눈다. */

import { loadBlob, removeBlob, saveBlob } from './storage';

const KEY = 'puzzle:stats:v1';

export interface StageStats {
  plays: number; // 끝까지 간 판 (중단 포함)
  cleared: number;
  failed: number;
  aborted: number;
  grades: Record<1 | 2 | 3, number>;
  /** 클리어한 판의 최소 소환 소모. 아직 없으면 null */
  bestCharges: number | null;
  /** 무한모드에서 돌파한 최고 라운드. 일반 단계에는 없다.
   *  예전에 저장된 기록에는 이 항목이 없으므로 선택 항목이다. */
  bestRound?: number;
}

export type StatsTable = Record<string, StageStats>;

export type Result = { kind: 'cleared'; grade: 1 | 2 | 3; chargesUsed: number } | { kind: 'failed' } | { kind: 'aborted' };

export function emptyStats(): StageStats {
  return { plays: 0, cleared: 0, failed: 0, aborted: 0, grades: { 1: 0, 2: 0, 3: 0 }, bestCharges: null };
}

/* 저장 형식과 키는 예전 그대로다. 저장 '위치'만 storage.ts 를 거치게 해서
   나중에 서버로 옮길 때 통계가 함께 넘어가게 한다. 그래서 Promise 다. */
export function loadStats(): Promise<StatsTable> {
  return loadBlob<unknown>(KEY, null).then((parsed) => {
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as StatsTable;
  });
}

/* 쓰기는 결과를 기다릴 일이 없다. 실패해도 이번 판은 그대로 이어진다. */
function save(table: StatsTable): void {
  void saveBlob(KEY, table);
}

export function recordResult(table: StatsTable, stageId: string, result: Result): StatsTable {
  const before = table[stageId] ?? emptyStats();
  const next: StageStats = {
    ...before,
    grades: { ...before.grades },
    plays: before.plays + 1,
  };

  if (result.kind === 'cleared') {
    next.cleared += 1;
    next.grades[result.grade] += 1;
    next.bestCharges =
      before.bestCharges === null ? result.chargesUsed : Math.min(before.bestCharges, result.chargesUsed);
  } else if (result.kind === 'failed') {
    next.failed += 1;
  } else {
    next.aborted += 1;
  }

  const updated: StatsTable = { ...table, [stageId]: next };
  save(updated);
  return updated;
}

/** 무한모드 한 판이 끝났을 때. round 는 '돌파한' 라운드 수다 (0 이면 첫 판에서 끝) */
export function recordEndless(table: StatsTable, id: string, round: number): StatsTable {
  const before = table[id] ?? emptyStats();
  const next: StageStats = {
    ...before,
    grades: { ...before.grades },
    plays: before.plays + 1,
    bestRound: Math.max(before.bestRound ?? 0, round),
  };
  const updated: StatsTable = { ...table, [id]: next };
  save(updated);
  return updated;
}

export function clearStats(): StatsTable {
  void removeBlob(KEY);
  return {};
}

/** 여러 단계를 하나로 합친다 */
export function totalOf(table: StatsTable): StageStats {
  const sum = emptyStats();
  for (const s of Object.values(table)) {
    sum.plays += s.plays;
    sum.cleared += s.cleared;
    sum.failed += s.failed;
    sum.aborted += s.aborted;
    sum.grades[1] += s.grades[1];
    sum.grades[2] += s.grades[2];
    sum.grades[3] += s.grades[3];
    if (s.bestCharges !== null) {
      sum.bestCharges = sum.bestCharges === null ? s.bestCharges : Math.min(sum.bestCharges, s.bestCharges);
    }
  }
  return sum;
}

/** 그 단계에서 받은 가장 높은 등급. 한 번도 클리어하지 못했으면 null.
 *  등급별 횟수에서 뽑아내므로 저장 형식을 건드리지 않는다. */
export function bestGrade(s: StageStats): 1 | 2 | 3 | null {
  if (s.grades[3] > 0) return 3;
  if (s.grades[2] > 0) return 2;
  if (s.grades[1] > 0) return 1;
  return null;
}

/** 성공률(%). 중단은 분모에 넣지 않는다 — 실력이 아니라 그만둔 것이므로 */
export function successRate(s: StageStats): number | null {
  const decided = s.cleared + s.failed;
  return decided === 0 ? null : (s.cleared / decided) * 100;
}

/* SPEC §1 — 단계 개방.
   처음에는 첫 단계만 열려 있고, 어떤 단계를 한 번이라도 클리어하면 다음이 열린다.
   따로 저장하지 않고 단계별 클리어 횟수로 판단하므로, 기록을 지우면 다시 잠긴다. */
export function unlockedIds(order: readonly string[], table: StatsTable): Set<string> {
  const open = new Set<string>();
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (id === undefined) continue;
    if (i === 0) {
      open.add(id);
      continue;
    }
    const prev = order[i - 1];
    if (prev === undefined) continue;
    if ((table[prev]?.cleared ?? 0) > 0) open.add(id);
    else break; // 앞 단계를 못 깼으면 그 뒤로는 전부 잠긴다
  }
  return open;
}
