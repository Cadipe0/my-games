"""SQLite 한 곳 — 스키마, 연결, 오래된 기록 정리.

파일 하나(scores.db)에 전부 들어간다. 게임 모음 하나 돌리자고 별도 DB
서버를 띄우는 건 과하고, sqlite3 는 파이썬에 이미 들어있다.

연결은 요청마다 새로 연다. 하나를 공유하면 요청이 겹칠 때 서로의 트랜잭션을
밟는다.

connect() 에 check_same_thread=False 를 주는 이유가 있다. FastAPI 는 동기
엔드포인트와 그 의존성을 스레드풀에서 돌리는데, 둘이 같은 스레드라는 보장이
없다. 그래서 get_db 가 연 연결을 엔드포인트가 다른 스레드에서 쓰게 되고,
기본값이면 "SQLite objects created in a thread can only be used in that same
thread" 로 터진다. 요청 하나가 연결 하나를 처음부터 끝까지 혼자 쓰고 (겹쳐
쓰는 곳이 없고) 끝나면 닫으므로, 이 검사만 꺼도 안전하다.
"""

import os
import sqlite3
from pathlib import Path

# DB 파일을 둘 곳.
#
# 로컬에서는 이 폴더에 scores.db 를 만든다. 클라우드(Render · Railway 등)에
# 올릴 때는 DATA_DIR 로 "지워지지 않는 디스크" 가 마운트된 경로를 준다.
# 그 설정을 안 하면 배포하거나 서버가 재시작될 때마다 기록이 통째로
# 사라진다 — 클라우드의 기본 파일 시스템은 임시 저장소이기 때문이다.
DATA_DIR = Path(os.environ.get("DATA_DIR") or Path(__file__).resolve().parent)
DB_PATH = DATA_DIR / "scores.db"

# 사람 하나 · 게임 하나당 남겨 두는 최신 기록 수.
# 브라우저에 저장하던 시절의 KEEP 과 같은 값이다 (web/scores.js).
KEEP = 100

# 최신 KEEP 개에서 밀려나도 지켜 주는 상위 기록 수 ((mode, outcome) 그룹마다).
# 랭킹이 1~10 위를 보여주므로, 10 위까지는 나이와 상관없이 남아 있어야 한다.
PROTECT_TOP = 10


SCHEMA = """
-- 판 기록 하나 = 행 하나. web/scores.js 의 record 를 그대로 옮긴 모양이다.
CREATE TABLE IF NOT EXISTS scores (
    id         TEXT PRIMARY KEY,            -- 클라이언트가 만든 id. 같은 id 면 덮어쓴다
    player_id  TEXT NOT NULL,               -- 누구 기록인지 (소유)
    game       TEXT NOT NULL,
    nickname   TEXT NOT NULL,               -- 기록할 때의 이름 (표시용 스냅샷)
    at         TEXT NOT NULL,               -- ISO8601. 사전순 = 시간순이라 그대로 정렬된다
    mode       TEXT NOT NULL DEFAULT '',    -- 없으면 '' — NULL 과 '' 두 가지 "없음" 을 만들지 않는다
    outcome    TEXT NOT NULL DEFAULT '',
    score      REAL,                        -- NULL 허용: "0 점" 과 "점수 없음" 은 다르다
    detail     TEXT NOT NULL DEFAULT '{}'   -- 게임마다 모양이 달라서 JSON 통째로
);

-- 쿼리는 딱 두 종류다. 각각을 덮는 복합 인덱스.
CREATE INDEX IF NOT EXISTS idx_scores_mine ON scores (player_id, game, at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (game, mode, score DESC);

-- 판 기록이 아니라 "계속 덮어쓰는 상태 한 덩어리" (어드벤처 도감, 퍼즐 통계).
CREATE TABLE IF NOT EXISTS blobs (
    player_id  TEXT NOT NULL,
    key        TEXT NOT NULL,               -- "lostforest.codex", "puzzle:stats:v1"
    value      TEXT NOT NULL,               -- JSON 문자열
    updated_at TEXT NOT NULL,
    PRIMARY KEY (player_id, key)
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,   # 위 설명 참고 — 요청 하나가 연결 하나를 혼자 쓴다
        timeout=5.0,               # 쓰기가 겹치면 바로 죽지 말고 5 초까지 기다린다
        # 쓰기 잠금을 문장을 시작할 때 한꺼번에 잡는다.
        #
        # 기본값(DEFERRED)이면 파이썬이 BEGIN 만 걸어 두고, INSERT 가 먼저
        # 읽기 잠금을 잡은 다음 쓰기 잠금으로 "승격" 하려 든다. SQLite 는 이
        # 승격이 막히면 교착을 피하려고 위의 timeout 을 무시하고 그 자리에서
        # "database is locked" 로 실패한다. 여러 사람이 동시에 판을 끝내면
        # 바로 이게 터진다.
        #
        # IMMEDIATE 는 처음부터 쓰기 잠금을 요구하므로 승격이 없고, 막히면
        # timeout 만큼 얌전히 기다렸다가 순서대로 처리된다. 읽기만 하는
        # 요청은 애초에 트랜잭션을 열지 않으므로 서로 막지 않는다.
        isolation_level="IMMEDIATE",
    )
    conn.row_factory = sqlite3.Row          # 행을 dict 처럼 읽는다
    return conn


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)   # 마운트된 빈 디스크일 수 있다
    conn = connect()
    try:
        # 읽기와 쓰기가 서로를 막지 않게 한다. 여러 탭에서 동시에 놀아도 안 걸린다.
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """요청 하나 = 연결 하나. FastAPI 의존성으로 쓴다.

    커밋은 여기서 하지 않는다. 쓰는 엔드포인트가 스스로 커밋한다.

    여기서(= 엔드포인트가 끝난 뒤에) 커밋하면 쓰기 잠금을 쥔 채로 워커
    스레드를 한 번 놓게 된다. 커밋하려면 스레드를 다시 배정받아야 하는데,
    그 사이 다른 요청들이 잠금을 기다리며 스레드를 전부 차지하고 있으면
    커밋이 순서를 못 받는다. 서로 기다리다 시간이 다 되어 "database is
    locked" 로 죽는데, 여러 사람이 동시에 판을 끝내면 실제로 이렇게 된다.

    엔드포인트 안에서 커밋하면 잠금을 잡고 푸는 일이 한 스레드 안에서
    끊기지 않고 끝나므로 이 문제가 없다.
    """
    conn = connect()
    try:
        yield conn
    finally:
        conn.rollback()   # 커밋하지 않은 게 남아 있으면 되돌린다
        conn.close()


TRIM_SQL = """
DELETE FROM scores
 WHERE player_id = :player_id AND game = :game
   -- 최신 KEEP 개는 남긴다
   AND id NOT IN (
        SELECT id FROM scores
         WHERE player_id = :player_id AND game = :game
         ORDER BY at DESC, rowid DESC
         LIMIT :keep
   )
   -- 밀려났더라도 (mode, outcome) 조합별 상위 :top 개와 꼴찌 하나는 남긴다
   AND id NOT IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY mode, outcome ORDER BY score DESC, at ASC) AS hi,
                   ROW_NUMBER() OVER (PARTITION BY mode, outcome ORDER BY score ASC, at ASC)  AS lo
              FROM scores
             WHERE player_id = :player_id AND game = :game AND score IS NOT NULL
        )
        WHERE hi <= :top OR lo = 1
   )
"""


def trim(conn: sqlite3.Connection, player_id: str, game: str) -> int:
    """기록이 KEEP 을 넘으면 오래된 것부터 버린다. 단 상위 기록은 지킨다.

    그냥 오래된 순으로 자르면 101 판째에 누군가의 최고 기록이 랭킹에서
    사라진다. 그래서 (mode, outcome) 그룹별 상위 PROTECT_TOP 개는 나이와
    상관없이 남긴다. 랭킹이 1~10 위를 보여주므로 10 개다.

    이 그룹 단위인 이유: 랭킹과 best() 를 부르는 방식이 게임마다 다르지만
    ({mode, outcome} / {mode} / 필터 없음), 어떤 조합이든 그 대상은 결국
    (mode, outcome) 그룹 몇 개의 합집합이다. 합집합의 상위 10 개는 각 그룹
    상위 10 개 안에 반드시 들어 있으므로, 그룹별로 10 개씩 지키면 어떤
    조회에서도 1~10 위가 그대로 나온다.

    꼴찌를 하나 남기는 건 best(order:"asc") 때문이다. 지금 게임들은 전부
    클수록 좋은 점수라 아무도 안 쓰지만, API 가 지원하는 이상 답이 틀리면
    안 된다. 그래서 열 개가 아니라 하나만 지킨다.
    """
    cur = conn.execute(
        TRIM_SQL, {"player_id": player_id, "game": game, "keep": KEEP, "top": PROTECT_TOP}
    )
    return cur.rowcount
