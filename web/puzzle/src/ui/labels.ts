/* 화면에 쓰는 한국어 이름표. 격자와 상태줄이 함께 쓴다. */

import type { Blessing } from '../core/types';

/** 칸 안에 넣는 한 글자 */
export const BLESSING_MARK: Record<Blessing, string> = {
  reshuffle: '재',
  blessing: '축',
  extra: '추',
  mystery: '신',
  upgrade: '강',
  clone: '복',
};

export const BLESSING_NAME: Record<Blessing, string> = {
  reshuffle: '재배치',
  blessing: '축복',
  extra: '추가',
  mystery: '신비',
  upgrade: '강화',
  clone: '복제',
};

export const BLESSING_HINT: Record<Blessing, string> = {
  reshuffle: '남은 석판이 전부 자리를 바꿉니다',
  blessing: '이번 시전은 소환 횟수를 쓰지 않습니다',
  extra: '카드 교체 횟수 +1',
  mystery: '남은 손패가 분출 또는 공명으로 바뀝니다',
  upgrade: '남은 손패의 레벨 +1',
  clone: '남은 손패가 방금 쓴 정령과 같아집니다',
};

/* 효과마다 다른 색 (SPEC §6).
   색은 보조 신호다 — 글자(재·축·추·신·강·복)와 aria-label 이 본체이므로
   색을 못 봐도 잃는 정보는 없다.

   붉은 계열과 흰색 계열은 쓰지 않는다. 판 위에서 이미 왜곡 경고(테라코타)와
   확정 파괴(흰색)에 쓰이고 있어, 가장 중요한 정보와 헷갈리면 안 되기 때문이다.

   계열 — 초록은 그냥 이득, 보라·파랑은 손패가 바뀜, 황금은 판이 흔들림. */
export const BLESSING_COLOR: Record<Blessing, string> = {
  blessing: '#4f9d63', // 축복 — 초록
  extra: '#3f9d93', // 추가 — 청록
  upgrade: '#8b6fd0', // 강화 — 보라
  clone: '#4b86d1', // 복제 — 파랑
  mystery: '#c05fae', // 신비 — 자홍
  reshuffle: '#d3a52e', // 재배치 — 황금 (혼자 성격이 다르니 색도 튄다)
};

/** 그 색 위에 얹을 글자색. 황금만 흰 글자로는 대비가 모자라 검은 글자를 쓴다 */
export const BLESSING_INK: Record<Blessing, string> = {
  blessing: '#ffffff',
  extra: '#ffffff',
  upgrade: '#ffffff',
  clone: '#ffffff',
  mystery: '#ffffff',
  reshuffle: '#241c07',
};
