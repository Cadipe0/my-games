/* 판 기록 — 다른 게임과 같은 표에 쌓는다 (server/ 의 scores 테이블).

   통계(stats.ts)는 "몇 판 했고 성공률이 얼마인가" 를 통째로 쌓는 것이고,
   여기는 "이 한 판이 몇 점이었나" 를 한 줄씩 남기는 것이다. 용도가 달라서
   둘 다 둔다 — 통계는 지금까지처럼 화면에 쓰이고, 판 기록은 랭킹에 쓰인다.

   퍼즐은 따로 번들되는 앱이라 web/scores.js 를 가져다 쓸 수 없다. 그래서
   보내는 모양(id · game · nickname · at · mode · outcome · score · detail)만
   저기와 똑같이 맞춘다. 사람을 가르는 값은 storage.ts 의 playerId 를
   그대로 쓴다 — 그래야 허브·랭킹에서 같은 사람으로 묶인다.

   대표 점수는 클수록 좋아야 한다는 게 저쪽의 규약이다. 최소 소환은
   작을수록 좋으므로 "남긴 소환량" 으로 뒤집어서 담는다. */

import { playerId } from './storage';

const API = '/api';
const GAME = 'puzzle';
const NICK_KEY = 'gm:nickname'; // web/nickname.js 와 같은 키
const FALLBACK_NICK = '플레이어';

export type PuzzleOutcome = 'clear' | 'fail' | 'abort' | '';

export interface PuzzleRecord {
  /** 단계 id ("stage-1" … "stage-7", "endless"). 단계마다 예산과 기준이
   *  달라서 섞어 줄 세우면 안 되므로, 랭킹은 이 값으로 나눈다. */
  mode: string;
  outcome: PuzzleOutcome;
  /** 겨룰 점수가 없으면(실패·중단) null. 0 점과는 다르다. */
  score: number | null;
  detail: Record<string, unknown>;
}

/** 일반 단계의 대표 점수.
 *
 *  등급 × 1000 + 남긴 소환량.
 *  등급이 절대 우선이고, 같은 등급 안에서는 소환을 아낀 쪽이 높다.
 *  남긴 소환량은 예산(charges)보다 클 수 없어 1000 을 넘지 않는다. */
export function stageScore(grade: 1 | 2 | 3, chargesUsed: number, charges: number): number {
  return grade * 1000 + Math.max(0, charges - chargesUsed);
}

/** 저장된 이름. 아직 정하지 않았으면 빈 문자열. */
export function savedNickname(): string {
  try {
    return (localStorage.getItem(NICK_KEY) || '').trim();
  } catch {
    return '';
  }
}

function nickname(): string {
  return savedNickname() || FALLBACK_NICK;
}

function newId(): string {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* 기록을 남기는 데 실패해도 판은 그대로 이어져야 한다. 그래서 기다리지
   않고, 실패하면 조용히 넘어간다 (통계는 이미 따로 쌓였다). */
export function submitScore(r: PuzzleRecord): void {
  const body = {
    id: newId(),
    game: GAME,
    nickname: nickname(),
    at: new Date().toISOString(),
    mode: r.mode,
    outcome: r.outcome,
    score: r.score,
    detail: r.detail,
  };

  void fetch(API + '/scores', {
    method: 'POST',
    headers: { 'X-Player-Id': playerId(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    /* 서버가 없으면 이 판은 랭킹에 오르지 않는다. 통계는 남는다. */
  });
}

/** 서버에 쌓인 내 퍼즐 기록을 지운다. 기록 초기화 버튼이 쓴다. */
export function clearScores(): Promise<void> {
  return fetch(API + '/scores?game=' + encodeURIComponent(GAME), {
    method: 'DELETE',
    headers: { 'X-Player-Id': playerId() },
  })
    .then(() => undefined)
    .catch(() => undefined);
}
