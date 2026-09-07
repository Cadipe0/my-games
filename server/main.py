"""게임 모음 점수 서버 — FastAPI.

브라우저 localStorage 에 쌓던 기록을 여기로 옮긴다. 웹 폴더(web/)도 이
서버가 같이 내보내므로, 정적 서버를 따로 띄울 필요도 CORS 를 열 필요도 없다.

누가 남긴 기록인지는 X-Player-Id 헤더 하나로만 가른다. 로그인은 두지
않았다 — 집에서 돌리는 게임 모음에 계정 체계는 과하다. 대신 닉네임을
소유자로 쓰지는 않는다. 닉네임은 겹치고("철수" 두 명), 허브에서 바꿀 수
있어서(이름을 바꾸면 예전 기록이 남의 것이 된다) 소유를 맡길 수 없다.
닉네임은 랭킹에 띄우는 표시용 스냅샷일 뿐이다.
"""

import json
import os
import sqlite3
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import APIRouter, Body, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from db import KEEP as db_KEEP
from db import get_db, init_db, trim
from models import BlobOut, RankRow, ScoreIn, ScoreOut, now_iso, tidy_score

WEB_DIR = Path(__file__).resolve().parent.parent / "web"

# 통짜 저장값(도감 · 퍼즐 통계)의 상한. 실제로 쓰는 건 몇 KB 안 되므로
# 넉넉하지만, 없으면 아무나 메가바이트 단위를 밀어 넣을 수 있다.
BLOB_MAX_BYTES = 64 * 1024
BLOB_KEY_MAX = 128

# API 문서는 기본으로 닫는다. 공개 주소에서 굳이 내부 구조를 보여줄 이유가
# 없다. 개발 중에 보고 싶으면 ENABLE_DOCS=1 로 띄운다.
ENABLE_DOCS = os.environ.get("ENABLE_DOCS", "").lower() in ("1", "true", "yes")


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()          # 서버가 뜰 때 테이블이 없으면 만든다
    yield


app = FastAPI(
    title="게임 모음 점수 서버",
    lifespan=lifespan,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)
api = APIRouter(prefix="/api")


# ---------- 요청 크기 제한 ----------
#
# 항목별 상한(models.py, BLOB_MAX_BYTES)이 있지만, 그건 본문을 다 읽어 JSON 으로
# 푼 다음에야 걸린다. 100MB 짜리 본문이 오면 거절하기 전에 이미 다 읽은 뒤다.
# 그래서 길이를 미리 보고 문 앞에서 돌려보낸다.

MAX_BODY_BYTES = env_int("MAX_BODY_BYTES", 128 * 1024)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "요청이 너무 큽니다"}, status_code=413)
    return await call_next(request)


# ---------- 요청 수 제한 ----------
#
# 한 사람이 쉬지 않고 밀어 넣는 걸 막는다. 평범하게 놀면 1 분에 수십 건이라
# 기본값은 넉넉하다. 인터넷에 열어 두면 사람이 아니라 자동 프로그램이
# 두드리기 때문에 필요하다.
#
# 메모리에만 두므로 서버를 여러 대로 늘리면 대수만큼 느슨해진다. 그만큼
# 커지면 앞단(리버스 프록시)에서 막는 게 맞다.

RATE_LIMIT = env_int("RATE_LIMIT", 240)      # 창 하나당 허용 요청 수
RATE_WINDOW = env_int("RATE_WINDOW", 60)     # 창 길이(초)
RATE_MAX_KEYS = 10_000                       # 기억해 둘 사람 수 상한

_hits: dict[str, deque] = {}
_hits_lock = Lock()


def rate_limit(pid: str) -> None:
    now = time.monotonic()
    with _hits_lock:
        # 오래 안 온 사람은 잊는다. 안 그러면 dict 가 계속 자란다.
        if len(_hits) > RATE_MAX_KEYS:
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > RATE_WINDOW]:
                _hits.pop(k, None)

        q = _hits.setdefault(pid, deque())
        while q and now - q[0] > RATE_WINDOW:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="요청이 너무 잦습니다. 잠시 뒤에 다시 시도해 주세요.",
            )
        q.append(now)


def player_id(x_player_id: str = Header(default="")) -> str:
    """이 요청이 누구 것인지. 브라우저가 만들어 보관하는 값이다."""
    pid = (x_player_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="X-Player-Id 헤더가 필요합니다")
    pid = pid[:64]
    rate_limit(pid)     # API 는 모두 이 의존성을 지나므로 여기서 한 번만 건다
    return pid


def row_to_out(row: sqlite3.Row) -> ScoreOut:
    return ScoreOut(
        id=row["id"],
        game=row["game"],
        nickname=row["nickname"],
        at=row["at"],
        mode=row["mode"],
        outcome=row["outcome"],
        score=tidy_score(row["score"]),
        detail=json.loads(row["detail"]),
    )


# ---------- 저장 ----------

UPSERT_SQL = """
INSERT INTO scores (id, player_id, game, nickname, at, mode, outcome, score, detail)
VALUES (:id, :player_id, :game, :nickname, :at, :mode, :outcome, :score, :detail)
ON CONFLICT(id) DO UPDATE SET
    nickname = excluded.nickname,
    at       = excluded.at,
    mode     = excluded.mode,
    outcome  = excluded.outcome,
    score    = excluded.score,
    detail   = excluded.detail
 WHERE scores.player_id = excluded.player_id
"""


@api.post("/scores", response_model=ScoreOut)
def put_score(
    record: ScoreIn,
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> ScoreOut:
    """한 판(또는 한 세션)의 결과를 남긴다. 저장된 기록을 그대로 돌려준다.

    같은 id 로 다시 넣으면 덮어쓴다. 티카투카가 진행 중인 세션을 갱신할
    때 이 동작에 기대고 있어서(sessionId 를 계속 재사용한다), 서버가 id 를
    새로 발급하면 한 세션이 매 판마다 새 기록으로 쌓인다.

    UPSERT 의 WHERE 절은 남의 id 를 알아내 덮어쓰는 걸 막는다. 주인이
    다르면 갱신이 일어나지 않는다.
    """
    row = record.model_dump()
    row["id"] = row["id"] or ("s" + uuid.uuid4().hex[:12])
    row["at"] = row["at"] or now_iso()
    row["player_id"] = pid
    row["detail"] = json.dumps(record.detail, ensure_ascii=False)

    conn.execute(UPSERT_SQL, row)
    trim(conn, pid, record.game)
    conn.commit()          # 잠금은 여기서 바로 푼다 (get_db 의 설명 참고)

    saved = conn.execute(
        "SELECT * FROM scores WHERE id = ? AND player_id = ?", (row["id"], pid)
    ).fetchone()
    if saved is None:
        # id 가 이미 남의 것이었다는 뜻 — 위 WHERE 절에 막혀 아무 일도 없었다
        raise HTTPException(status_code=409, detail="다른 사람이 쓰고 있는 기록 id 입니다")
    return row_to_out(saved)


# ---------- 내 기록 조회 ----------


@api.get("/scores", response_model=list[ScoreOut])
def list_scores(
    game: str,
    mode: str | None = None,
    outcome: str | None = None,
    limit: int = Query(default=db_KEEP, ge=1, le=1000),
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[ScoreOut]:
    """내 기록만 최신순으로. 남의 기록은 랭킹에서만 보인다.

    브라우저에 쌓던 시절엔 저장소가 사람마다 따로여서 "내 기록" 이 곧
    "전체 기록" 이었다. 서버에서는 한 테이블에 다 섞이므로, 전적(5 승 3 패)과
    허브 카드의 최고 기록은 여기서 player_id 로 걸러야 예전과 같아진다.

    mode / outcome 필터를 서버에도 둔 건 랭킹과 모양을 맞추기 위해서다.
    web/scores.js 는 이 필터를 지금처럼 자기가 계속 걸러도 된다.
    """
    sql = "SELECT * FROM scores WHERE player_id = ? AND game = ?"
    args: list[object] = [pid, game]
    if mode is not None:
        sql += " AND mode = ?"
        args.append(mode)
    if outcome is not None:
        sql += " AND outcome = ?"
        args.append(outcome)
    sql += " ORDER BY at DESC, rowid DESC LIMIT ?"
    args.append(limit)

    return [row_to_out(r) for r in conn.execute(sql, args)]


@api.delete("/scores")
def clear_scores(
    game: str,
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, int]:
    """내 기록만 지운다 (어드벤처 도감 초기화가 쓴다)."""
    cur = conn.execute("DELETE FROM scores WHERE player_id = ? AND game = ?", (pid, game))
    conn.commit()
    return {"deleted": cur.rowcount}


# ---------- 랭킹 ----------

RANK_SQL = """
SELECT *
  FROM scores
 WHERE game = :game AND score IS NOT NULL {filters}
 ORDER BY score {dir}, at ASC
 LIMIT :limit
"""

# 사람마다 한 줄만 올리는 판. 누적 점수를 매번 새 기록으로 남기는 게임을 위한 것이다.
RANK_SQL_PER_PLAYER = """
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (
               PARTITION BY player_id ORDER BY score {dir}, at ASC
           ) AS rn
      FROM scores
     WHERE game = :game AND score IS NOT NULL {filters}
)
WHERE rn = 1
ORDER BY score {dir}, at ASC
LIMIT :limit
"""


@api.get("/ranking", response_model=list[RankRow])
def ranking(
    game: str,
    mode: str | None = None,
    outcome: str | None = None,
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=10, ge=1, le=100),
    per_player: bool = False,
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[RankRow]:
    """게임별 랭킹. 기록 하나가 한 줄이고, 같은 사람이 여러 번 올라올 수 있다.

    한 사람이 1 위와 2 위를 같이 차지하는 게 실제로 일어난 일이므로 그대로
    보여준다. db.py 의 정리 규칙이 (mode, outcome) 그룹별 상위 10 개를
    지키는 것도 이 화면을 위해서다 — 오래됐다고 지워지면 순위에 구멍이 난다.

    점수가 없는 기록(score IS NULL)은 후보에서 뺀다. "0 점" 이 아니라
    "겨룰 점수가 아예 없음" 이라서 0 점으로 끼워 넣으면 안 된다.
    web/scores.js 의 best() 가 쓰던 것과 같은 판단이다.

    점수가 같으면 먼저 세운 쪽이 위다 (at ASC).

    per_player=true 는 사람마다 한 줄만 올린다. 어드벤처처럼 "지금까지 발견한
    엔딩 수" 를 볼 때마다 새 기록으로 남기는 게임을 위한 것이다 — 그대로 두면
    한 사람의 1, 2, 3, 4, 5 개가 순위를 통째로 차지해 버린다. 한 판에 한 줄인
    나머지 게임들은 이 옵션이 필요 없다.

    order=asc 는 적을수록 좋은 점수를 위해 남겨 둔다. 지금 게임들은
    전부 클수록 좋아서 기본은 desc 다.
    """
    filters = ""
    args: dict[str, object] = {"game": game, "limit": limit}
    if mode is not None:
        filters += " AND mode = :mode"
        args["mode"] = mode
    if outcome is not None:
        filters += " AND outcome = :outcome"
        args["outcome"] = outcome

    direction = "ASC" if order == "asc" else "DESC"
    sql = RANK_SQL_PER_PLAYER if per_player else RANK_SQL
    rows = conn.execute(sql.format(dir=direction, filters=filters), args).fetchall()

    return [
        RankRow(
            rank=i + 1,
            id=r["id"],
            nickname=r["nickname"],
            at=r["at"],
            mode=r["mode"],
            outcome=r["outcome"],
            score=tidy_score(r["score"]),
            detail=json.loads(r["detail"]),
            mine=(r["player_id"] == pid),
        )
        for i, r in enumerate(rows)
    ]


# ---------- blob (도감 · 퍼즐 통계) ----------
#
# 판 기록이 아니라 계속 덮어쓰는 상태 한 덩어리라서 테이블도 통로도 따로다.
# 형식은 예전 그대로 두고 저장 위치만 서버로 옮긴다.


@api.get("/blobs/{key}", response_model=BlobOut)
def get_blob(
    key: str,
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> BlobOut:
    row = conn.execute(
        "SELECT value FROM blobs WHERE player_id = ? AND key = ?", (pid, key)
    ).fetchone()
    if row is None:
        # 없으면 404. 클라이언트는 이걸 받고 fallback 을 쓴다 (loadBlob 의 약속)
        raise HTTPException(status_code=404, detail="없는 키입니다")
    return BlobOut(key=key, value=json.loads(row["value"]))


@api.put("/blobs/{key}", response_model=BlobOut)
def put_blob(
    key: str,
    value: Any = Body(default=None),
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> BlobOut:
    if len(key) > BLOB_KEY_MAX:
        raise HTTPException(status_code=422, detail="키가 너무 깁니다")

    body = json.dumps(value, ensure_ascii=False)
    if len(body.encode("utf-8")) > BLOB_MAX_BYTES:
        raise HTTPException(status_code=413, detail="저장할 값이 너무 큽니다")

    conn.execute(
        "INSERT INTO blobs (player_id, key, value, updated_at) VALUES (?, ?, ?, ?)"
        " ON CONFLICT(player_id, key) DO UPDATE SET"
        "   value = excluded.value, updated_at = excluded.updated_at",
        (pid, key, body, now_iso()),
    )
    conn.commit()
    return BlobOut(key=key, value=value)


@api.delete("/blobs/{key}")
def delete_blob(
    key: str,
    pid: str = Depends(player_id),
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, int]:
    cur = conn.execute("DELETE FROM blobs WHERE player_id = ? AND key = ?", (pid, key))
    conn.commit()
    return {"deleted": cur.rowcount}


# ---------- 라우트 등록 ----------
# API 를 먼저 붙이고 정적 파일을 마지막에 붙인다. 순서가 뒤집히면 "/" 마운트가
# /api/* 까지 삼킨다.

app.include_router(api)
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
