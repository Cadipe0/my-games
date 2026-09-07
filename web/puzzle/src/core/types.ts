/* 도메인 타입. SPEC §3 을 그대로 옮기고, 스펙이 참조만 하고 정의하지 않은
   타입(StageConfig / Move / MoveLogEntry)은 아래에 최소 형태로 둔다. */

/** 격자 좌표. 왼쪽 위가 (0,0), x=열, y=행 */
export interface Pos {
  x: number;
  y: number;
}

/** 보드 크기. 범위 계산이 보드 밖을 잘라내는 데 쓴다 */
export interface BoardSize {
  width: number;
  height: number;
}

export type TileKind =
  | 'empty' // 파괴됐거나 처음부터 비어 있는 칸
  | 'blocked' // 보드 밖(비활성 영역). 석판이 재생성될 수 없다
  | 'normal' // 고대 석판 — 파괴 대상
  | 'distorted'; // 왜곡된 고대 석판 — 파괴 대상이 아님

/** 정령이 머무른 석판에 깃든 효과. normal 타일에만 부여된다 */
export type Blessing =
  | 'reshuffle' // 재배치
  | 'blessing' // 축복
  | 'extra' // 추가
  | 'mystery' // 신비
  | 'upgrade' // 강화
  | 'clone'; // 복제

export interface Tile {
  kind: TileKind;
  blessing?: Blessing; // kind === 'normal' 일 때만 존재
}

export type Board = Tile[][]; // [y][x]

export type SpiritId =
  | 'blaze' // 업화
  | 'bigBang' // 대폭발
  | 'bolt' // 벼락
  | 'strike' // 낙뢰
  | 'twister' // 용오름
  | 'shockwave' // 충격파
  | 'quake' // 지진
  | 'tsunami' // 해일
  | 'storm' // 폭풍우
  | 'purify' // 정화
  | 'erupt' // 분출      (신비 전용)
  | 'resonance'; // 세계수의 공명 (신비 전용)

export type SpiritLevel = 1 | 2 | 3;

export interface SpiritCard {
  id: SpiritId;
  level: SpiritLevel;
}

/** 손패 자리. SPEC §3 은 손패를 2장으로 고정한다 */
export type HandSlot = 0 | 1;

/* SPEC §5 는 applyMove(state, move, rng) 의 시그니처만 정하고 Move 의 내용은
   정의하지 않는다. §4.2 턴 진행("손패 2장 중 하나를 고른다" + "보드의 한 칸을
   클릭해 시전 지점을 정한다")에서 필요한 최소한만 담았다.
   TODO(확인): Move 에 시전 외의 행동(정령 교체, 중단)도 포함시킬지, 아니면
   reroll()/abort() 를 별도 함수로 둘지? 현재는 시전 전용으로 두고 교체는
   별도 함수로 뺄 예정이다. */
export interface Move {
  /** 사용할 손패 자리 */
  slot: HandSlot;
  /** 시전 지점 */
  at: Pos;
}

/* SPEC §3 GameState.log 가 MoveLogEntry[] 를 참조하지만 내용은 정의돼 있지 않다.
   TODO(확인): 로그에 어떤 항목이 필요한가? (리플레이 재현용인지, 화면 표시용인지에
   따라 필요한 필드가 달라진다) 지금은 재현에 필요한 최소 정보만 담아 둔다. */
export interface MoveLogEntry {
  /** 몇 번째 시전인지 (1부터) */
  turn: number;
  /** 사용한 정령 */
  card: SpiritCard;
  /** 시전 지점 */
  at: Pos;
  /* 아래 셋은 개수가 아니라 좌표 목록이다.
     화면이 이전 판과 지금 판을 비교해 추측하면 파괴와 재생성을 구분할 수 없고,
     왜곡 피격은 kind 가 그대로라 아예 잡히지 않는다. 그래서 엔진이 직접 알려 준다. */

  /** 이번 시전으로 비워진 칸 (정화·공명이 부순 왜곡 포함) */
  destroyed: Pos[];
  /** 이번 시전으로 피격된 왜곡 칸 (purify/resonance 파괴는 제외) */
  distortedHits: Pos[];
  /** 이번 시전으로 되살아난 칸 */
  regenerated: Pos[];
  /** 발동한 특수 석판 효과 */
  blessings: Blessing[];
}

/** SPEC §4.6. 실제 단계 목록은 src/data/stages.ts 에 둔다 */
export interface StageConfig {
  id: string; // 'stage-3' 등
  label: string; // '3단계'
  width: number;
  height: number;
  /** 문자열 맵. '.' = blocked, 'O' = normal, 'X' = distorted */
  layout: string[];
  charges: number; // 총 정령 소환 횟수
  rerolls: number; // 정령 교체 횟수
  blessingCount: number; // 시작 시 무작위로 부여할 특수 석판 개수
  gradeThresholds: { 3: number; 2: number };
}

export interface GameState {
  board: Board;
  /** 지금 사용할 수 있는 정령 2장 */
  hand: [SpiritCard, SpiritCard];
  /** 다음에 들어올 정령 미리보기 큐 */
  queue: SpiritCard[];
  /** 남은 정령 소환 횟수 */
  chargesLeft: number;
  /** 남은 정령 교체(리롤) 횟수 */
  rerollsLeft: number;
  /** 지금까지 소모한 소환 횟수 */
  chargesUsed: number;
  status: 'playing' | 'cleared' | 'failed';
  /** cleared 일 때만 채워짐 */
  grade?: 1 | 2 | 3;
  stage: StageConfig;
  log: MoveLogEntry[];
}
