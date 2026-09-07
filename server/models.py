"""주고받는 데이터의 모양.

핵심은 ScoreOut 이다. 이건 web/scores.js 의 build() 가 만들던 record 와
글자 하나까지 같은 모양이어야 한다. 게임들은 이 객체를 그대로 받아서
saved.id 를 읽고 (티카투카) detail.moves 를 화면에 뿌리므로 (허브),
필드가 하나라도 빠지거나 이름이 달라지면 조용히 깨진다.
"""

import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator

# 들어오는 값의 상한. 인터넷에 열어 두면 누구든 직접 요청을 보낼 수 있어서,
# 브라우저가 지키는 규칙(닉네임 12 자 등)을 서버도 다시 확인해야 한다.
# 상한이 없으면 5000 자 닉네임이나 2MB 짜리 detail 이 그대로 저장돼
# 공격이 아니라 단순한 실수로도 디스크가 찬다.
NICK_MAX = 12          # web/nickname.js 의 MAX 와 같은 값 — 이 길이로 자른다
NICK_ACCEPT_MAX = 200  # 이보다 길면 자르지 않고 거절한다 (사람이 적은 이름이 아니다)
GAME_MAX = 32
MODE_MAX = 32
OUTCOME_MAX = 16
ID_MAX = 64
AT_MAX = 40            # ISO8601 한 줄이면 충분하다
SCORE_ABS_MAX = 1e9
DETAIL_MAX_BYTES = 4096


def now_iso() -> str:
    # 브라우저의 new Date().toISOString() 과 같은 모양 (…Z)
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def tidy_score(v: float | None) -> float | int | None:
    """1000.0 이 아니라 1000 으로 돌려준다.

    REAL 컬럼에서 꺼내면 파이썬은 float 를 준다. 게임들은 전부 정수를
    점수로 쓰므로, 저장한 그대로 돌아가도록 정수면 정수로 되돌린다.
    """
    if v is None:
        return None
    return int(v) if float(v).is_integer() else v


class ScoreIn(BaseModel):
    """게임이 보내는 기록. web/scores.js 의 submit() 이 채워서 넘긴다.

    닉네임은 조금 길면 자르고, 나머지가 상한을 넘으면 요청을 거절한다(422).
    닉네임은 사람이 적는 값이라 길다고 판이 사라지면 곤란하지만, game 이나
    mode 는 게임 코드가 정하는 값이라 길다는 건 클라이언트가 망가졌거나
    남이 직접 찔러 보고 있다는 뜻이기 때문이다. 닉네임도 터무니없이 길면
    (NICK_ACCEPT_MAX 초과) 자르지 않고 거절한다 — 사람이 적은 이름이 아니다.
    """

    id: str = Field(default="", max_length=ID_MAX)   # 비어 있으면 서버가 만든다
    game: str = Field(min_length=1, max_length=GAME_MAX)
    nickname: str = Field(default="플레이어", max_length=NICK_ACCEPT_MAX)
    at: str = Field(default="", max_length=AT_MAX)   # 비어 있으면 서버 시각
    mode: str = Field(default="", max_length=MODE_MAX)
    outcome: str = Field(default="", max_length=OUTCOME_MAX)
    score: float | None = Field(default=None, ge=-SCORE_ABS_MAX, le=SCORE_ABS_MAX)
    detail: dict[str, Any] = Field(default_factory=dict)

    @field_validator("nickname")
    @classmethod
    def trim_nickname(cls, v: str) -> str:
        # 브라우저(GameNick.clean)와 같은 규칙으로 다듬는다
        v = " ".join(v.split()).strip()[:NICK_MAX]
        return v or "플레이어"

    @field_validator("detail")
    @classmethod
    def detail_not_too_big(cls, v: dict[str, Any]) -> dict[str, Any]:
        size = len(json.dumps(v, ensure_ascii=False).encode("utf-8"))
        if size > DETAIL_MAX_BYTES:
            raise ValueError(f"detail 이 너무 큽니다 ({size} > {DETAIL_MAX_BYTES} 바이트)")
        return v


class ScoreOut(BaseModel):
    """저장된 기록. LocalBackend 가 돌려주던 것과 같은 8 개 필드뿐이다.

    player_id 는 넣지 않는다 — 게임 코드가 모르는 필드이고, 응답 모양이
    예전과 같을수록 갈아끼울 때 놀랄 일이 없다.
    """

    id: str
    game: str
    nickname: str
    at: str
    mode: str
    outcome: str
    score: float | int | None
    detail: dict[str, Any]


class RankRow(BaseModel):
    """랭킹 한 줄. 순위와 "내 기록인지" 가 붙는 것만 다르다."""

    rank: int
    id: str
    nickname: str
    at: str
    mode: str
    outcome: str
    score: float | int | None
    detail: dict[str, Any]
    mine: bool = False


class BlobOut(BaseModel):
    """도감·퍼즐 통계처럼 통째로 넣었다 통째로 꺼내는 값."""

    key: str
    value: Any
