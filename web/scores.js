/* ============================================================
   점수 · 기록 — 모든 게임이 함께 쓴다.

   기록은 서버(server/ 의 FastAPI + SQLite)에 쌓는다. 저장소를 바꾸는
   자리는 아래 backend 한 줄뿐이고, 게임 쪽 코드는 손대지 않았다 —
   처음부터 모든 함수가 Promise 를 돌려주도록 해 둔 덕이다.

       GameScore.use(GameScore.LocalBackend);   // 브라우저에만 쌓고 싶을 때

   LocalBackend 는 지우지 않고 남겨 두었다. file:// 로 HTML 을 직접 열
   때(= fetch 가 막힐 때)와 서버에 닿지 못할 때 대신 쓰인다.

   기록 하나의 모양 — 그대로 서버로 보낼 수 있는 형태다.
     id        기록 고유 id. 같은 id 로 다시 넣으면 덮어쓴다
     game      게임 키 ("omok", "blackjack", ...)
     nickname  기록할 때의 닉네임
     at        ISO 시각
     mode      난이도 / 모드. 없으면 ""
     outcome   win | lose | draw | clear | fail | abort
     score     순위를 매길 대표 수치. 클수록 좋다. 없으면 null
     detail    게임별 상세. 자유 형식
   ============================================================ */

(function () {
  const PREFIX = "gm:scores:v1:";
  const KEEP = 100;   // 게임별로 남겨 두는 최대 기록 수

  /* ---------- 브라우저 저장소 백엔드 ---------- */

  // 저장소가 막혀 있어도(사생활 보호 모드 등) 게임은 계속돼야 한다.
  function guard(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function readList(game) {
    const rows = guard(function () {
      return JSON.parse(localStorage.getItem(PREFIX + game) || "[]");
    }, []);
    return Array.isArray(rows) ? rows : [];
  }

  function writeList(game, rows) {
    guard(function () { localStorage.setItem(PREFIX + game, JSON.stringify(rows)); });
  }

  const LocalBackend = {
    name: "local",

    put: function (game, record) {
      const rows = readList(game);
      let i = -1;
      for (let k = 0; k < rows.length; k++) {
        if (rows[k] && rows[k].id === record.id) { i = k; break; }
      }
      if (i >= 0) rows[i] = record;   // 진행 중인 세션을 갱신하는 경우
      else rows.unshift(record);      // 새 기록은 맨 앞 (목록은 최신순)
      writeList(game, rows.slice(0, KEEP));
      return Promise.resolve(record);
    },

    list: function (game) {
      return Promise.resolve(readList(game));
    },

    clear: function (game) {
      guard(function () { localStorage.removeItem(PREFIX + game); });
      return Promise.resolve();
    },

    /* 자기만의 저장 형식을 쓰는 게임(퍼즐 통계, 어드벤처 도감)을 위한 통로.
       형식을 건드리지 않고 저장 위치만 이 층을 거치게 한다. */

    loadBlob: function (key, fallback) {
      return Promise.resolve(guard(function () {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      }, fallback));
    },

    saveBlob: function (key, value) {
      guard(function () { localStorage.setItem(key, JSON.stringify(value)); });
      return Promise.resolve();
    },

    removeBlob: function (key) {
      guard(function () { localStorage.removeItem(key); });
      return Promise.resolve();
    },
  };

  /* ---------- 서버 백엔드 ---------- */

  const API = "/api";
  const PLAYER_KEY = "gm:player:v1";

  let cachedPid = null;

  /* 이 브라우저가 누구인지. 서버가 "내 기록" 과 "남의 기록" 을 가르는 데 쓴다.

     닉네임을 소유자로 쓰지 않는 이유: 겹치고("철수" 두 명), 허브에서 바꿀 수
     있어서 이름을 바꾸면 예전 기록이 남의 것이 된다. HTTP 헤더에 한글을 담을
     수 없기도 하다. 닉네임은 랭킹에 띄울 표시용으로만 기록에 따라간다.

     로그인이 없으므로 브라우저를 바꾸면 다른 사람으로 취급된다. */
  function playerId() {
    if (cachedPid) return cachedPid;
    let id = guard(function () { return localStorage.getItem(PLAYER_KEY); }, "");
    if (!id) {
      id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      guard(function () { localStorage.setItem(PLAYER_KEY, id); });
    }
    cachedPid = id;   // 저장소가 막혀 있어도 이번 방문 동안은 같은 사람으로 남는다
    return id;
  }

  function req(method, path, body) {
    const init = { method: method, headers: { "X-Player-Id": playerId() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API + path, init).then(function (res) {
      if (res.status === 404) return null;        // 아직 없는 값 — 부른 쪽이 기본값을 쓴다
      if (!res.ok) throw new Error("서버 " + res.status);
      if (res.status === 204) return null;
      return res.json();
    });
  }

  /* 서버가 안 떠 있거나 네트워크가 끊겨도 게임은 계속돼야 한다.
     이 파일은 원래 "저장소가 막혀 있어도 게임은 계속된다" 는 원칙으로
     쓰여 있으니 그걸 그대로 잇는다 — 요청이 실패하면 브라우저 저장소로
     대신 처리하고, 서버가 돌아오면 다음 요청부터 다시 서버를 쓴다.
     대신 끊겨 있던 동안의 기록은 이 브라우저에만 남는다. */
  let warned = false;

  function fallback(name, args, err) {
    if (!warned) {
      warned = true;
      console.warn("[GameScore] 서버에 닿지 못해 브라우저 저장소를 씁니다.", err);
    }
    return LocalBackend[name].apply(LocalBackend, args);
  }

  const ServerBackend = {
    name: "server",

    put: function (game, record) {
      // 서버는 저장한 기록을 그대로 돌려준다 (티카투카가 saved.id 를 다시 쓴다)
      return req("POST", "/scores", record)
        .then(function (saved) { return saved || record; })
        .catch(function (e) { return fallback("put", [game, record], e); });
    },

    list: function (game) {
      return req("GET", "/scores?game=" + encodeURIComponent(game))
        .then(function (rows) { return rows || []; })
        .catch(function (e) { return fallback("list", [game], e); });
    },

    clear: function (game) {
      return req("DELETE", "/scores?game=" + encodeURIComponent(game))
        .then(function () { })
        .catch(function (e) { return fallback("clear", [game], e); });
    },

    loadBlob: function (key, fallbackValue) {
      return req("GET", "/blobs/" + encodeURIComponent(key))
        .then(function (r) { return r ? r.value : fallbackValue; })
        .catch(function (e) { return fallback("loadBlob", [key, fallbackValue], e); });
    },

    saveBlob: function (key, value) {
      return req("PUT", "/blobs/" + encodeURIComponent(key), value)
        .then(function () { })
        .catch(function (e) { return fallback("saveBlob", [key, value], e); });
    },

    removeBlob: function (key) {
      return req("DELETE", "/blobs/" + encodeURIComponent(key))
        .then(function () { })
        .catch(function (e) { return fallback("removeBlob", [key], e); });
    },

    /* 여러 사람의 기록을 한자리에 모으는 건 서버에만 있는 기능이다.
       브라우저 저장소에는 남의 기록이 없으므로 닿지 못하면 빈 목록을 준다.
       opts: { mode, outcome, order, limit, perPlayer } */
    ranking: function (game, opts) {
      const o = opts || {};
      let q = "/ranking?game=" + encodeURIComponent(game);
      if (o.mode) q += "&mode=" + encodeURIComponent(o.mode);
      if (o.outcome) q += "&outcome=" + encodeURIComponent(o.outcome);
      if (o.order) q += "&order=" + encodeURIComponent(o.order);
      if (o.limit) q += "&limit=" + encodeURIComponent(o.limit);
      if (o.perPlayer) q += "&per_player=true";
      return req("GET", q)
        .then(function (rows) { return rows || []; })
        .catch(function () { return []; });
    },
  };

  /* ---------- 공개 API ---------- */

  /* 기본은 서버다. 다만 file:// 로 HTML 을 직접 열면 fetch 가 막히므로
     그때는 예전처럼 브라우저 저장소를 쓴다 — 서버 없이도 게임은 열린다. */
  const overHttp = location.protocol === "http:" || location.protocol === "https:";

  let backend = overHttp ? ServerBackend : LocalBackend;

  function newId() {
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function nickname() {
    return (window.GameNick && GameNick.name()) || "플레이어";
  }

  // 게임이 넘긴 값에 공통 항목을 채워 완성된 기록을 만든다.
  function build(game, record) {
    const r = record || {};
    return {
      id: r.id || newId(),
      game: game,
      nickname: r.nickname || nickname(),
      at: r.at || new Date().toISOString(),
      mode: r.mode || "",
      outcome: r.outcome || "",
      score: typeof r.score === "number" ? r.score : null,
      detail: r.detail || {},
    };
  }

  function match(row, opts) {
    if (!row) return false;
    if (opts.mode && row.mode !== opts.mode) return false;
    if (opts.outcome && row.outcome !== opts.outcome) return false;
    return true;
  }

  // 한 판(또는 한 세션)의 결과를 남긴다. 저장된 기록을 그대로 돌려준다.
  function submit(game, record) {
    return backend.put(game, build(game, record));
  }

  // 최신순 목록. opts: { mode, outcome, limit }
  function list(game, opts) {
    const o = opts || {};
    return backend.list(game).then(function (rows) {
      const kept = rows.filter(function (r) { return match(r, o); });
      return o.limit ? kept.slice(0, o.limit) : kept;
    });
  }

  /* 대표 점수가 가장 좋은 기록 하나. 점수가 없는 기록은 후보에서 뺀다.
     기본은 큰 값이 좋은 기록이다. opts.order 를 "asc" 로 주면 뒤집는다. */
  function best(game, opts) {
    const o = opts || {};
    const asc = o.order === "asc";
    return list(game, o).then(function (rows) {
      let top = null;
      rows.forEach(function (r) {
        if (typeof r.score !== "number") return;
        if (top === null || (asc ? r.score < top.score : r.score > top.score)) top = r;
      });
      return top;
    });
  }

  /* 누적 통계. 승률의 분모는 승 + 패다 — 무승부와 중단은 실력으로 갈린
     결과가 아니라서 뺀다. */
  function summary(game, opts) {
    return list(game, opts).then(function (rows) {
      const s = {
        plays: rows.length,
        win: 0, lose: 0, draw: 0,
        rate: null,
        best: null,
        last: rows[0] || null,
      };
      rows.forEach(function (r) {
        if (r.outcome === "win" || r.outcome === "clear") s.win++;
        else if (r.outcome === "lose" || r.outcome === "fail") s.lose++;
        else if (r.outcome === "draw") s.draw++;
        if (typeof r.score === "number" && (s.best === null || r.score > s.best.score)) s.best = r;
      });
      const decided = s.win + s.lose;
      if (decided > 0) s.rate = (s.win / decided) * 100;
      return s;
    });
  }

  /* ---------- 표시용 도우미 ---------- */

  // 시작 시각(Date.now())부터 지금까지 몇 초인지
  function since(startMs) {
    return Math.max(0, Math.round((Date.now() - startMs) / 1000));
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    if (s < 60) return s + "초";
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest === 0 ? m + "분" : m + "분 " + rest + "초";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }

  window.GameScore = {
    // 저장 위치를 바꾸는 지점. 서버로 옮길 때 여기만 건드린다.
    use: function (b) { backend = b; },
    backend: function () { return backend; },
    LocalBackend: LocalBackend,
    ServerBackend: ServerBackend,

    submit: submit,
    list: list,
    best: best,
    summary: summary,
    clear: function (game) { return backend.clear(game); },

    /* 게임별 랭킹 — 좋은 점수부터 1~10 위. 기록 하나가 한 줄이라 같은
       사람이 여러 번 올라올 수 있다. opts.perPlayer 를 켜면 사람마다 한
       줄만 올린다 (어드벤처처럼 누적 점수를 매번 새로 남기는 게임용).
       서버에만 있는 기능이라 브라우저 저장소만 쓸 때는 빈 목록이다. */
    ranking: function (game, opts) {
      return backend.ranking ? backend.ranking(game, opts) : Promise.resolve([]);
    },

    loadBlob: function (key, fallback) { return backend.loadBlob(key, fallback); },
    saveBlob: function (key, value) { return backend.saveBlob(key, value); },
    removeBlob: function (key) { return backend.removeBlob(key); },

    since: since,
    formatDuration: formatDuration,
    formatDate: formatDate,
  };
})();
