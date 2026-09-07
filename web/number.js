/* ============================================================
   숫자 맞추기 — number_game.py 를 웹으로 옮긴 버전
   ============================================================ */

const DIFFICULTIES = [
  { key: "easy", name: "쉬움", low: 1, high: 50, limit: 8 },
  { key: "normal", name: "보통", low: 1, high: 100, limit: 10 },
  { key: "hard", name: "어려움", low: 1, high: 200, limit: 12 },
];

const screenEl = document.getElementById("screen");

let answer = 0;
let tries = 0;
let limit = 10;
let low = 1;
let high = 100;
let diffName = "";
let diffKey = "";
let startedAt = 0;   // 판 시작 시각 (기록용)
let done = false;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ---------- 난이도 선택 화면 ---------- */

function showDifficulty() {
  screenEl.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = you() + "님, 난이도를 선택하세요. 범위가 넓을수록 어렵습니다.";
  screenEl.appendChild(hint);

  const list = document.createElement("div");
  list.className = "choices";

  DIFFICULTIES.forEach((d, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.innerHTML =
      '<span class="idx">' + (i + 1) + "</span>" +
      d.name + " (" + d.low + " ~ " + d.high + " · " + d.limit + "번 안에)";
    btn.addEventListener("click", () => startGame(d));
    list.appendChild(btn);
  });

  screenEl.appendChild(list);

  // 난이도마다 한 줄씩 자리를 먼저 잡아 두고 기록이 오면 채운다.
  // 그래야 불러오는 순서와 상관없이 줄 순서가 유지된다.
  const board = document.createElement("div");
  board.className = "record-list";
  screenEl.appendChild(board);

  DIFFICULTIES.forEach((d) => {
    const line = document.createElement("p");
    line.className = "record-line";
    line.textContent = d.name + " — 불러오는 중…";
    board.appendChild(line);
    summaryText(d).then((text) => { line.textContent = text; });
  });

  /* 초기화는 랭킹 옆이 아니라 여기에 둔다. 랭킹은 판이 끝난 화면에만
     잠깐 나타났다 사라져서, 거기 두면 한 판을 끝내야만 지울 수 있다.
     이 화면에는 세 난이도의 기록이 늘 보이므로 여기가 자연스럽다.
     화면을 다시 그릴 때마다 새로 만들지만, screenEl 을 통째로 비우고
     시작하므로 버튼이 겹쳐 쌓이지는 않는다. */
  GameReset.attach(screenEl, { game: "number", onDone: showDifficulty });
}

/* ---------- 기록 ---------- */

// "쉬움 — 5판 · 4번 성공 (성공률 80%) · 최고 6점 (3번 만에 · 12초)"
function summaryText(d) {
  return Promise.all([
    GameScore.summary("number", { mode: d.key }),
    GameScore.best("number", { mode: d.key, outcome: "win" }),
  ]).then(([sum, top]) => {
    if (sum.plays === 0) return d.name + " — 아직 기록이 없습니다.";
    let text = d.name + " — " + sum.plays + "판 · " + sum.win + "번 성공";
    if (sum.rate !== null) text += " (성공률 " + sum.rate.toFixed(0) + "%)";
    if (top) {
      text += "  ·  최고 " + top.score + "점 (" + top.detail.tries + "번 만에 · " +
              GameScore.formatDuration(top.detail.seconds) + ")";
    }
    return text;
  });
}

/* ---------- 게임 화면 ---------- */

function startGame(difficulty) {
  low = difficulty.low;
  high = difficulty.high;
  limit = difficulty.limit;
  diffName = difficulty.name;
  diffKey = difficulty.key;
  answer = randInt(low, high);
  tries = 0;
  startedAt = Date.now();
  done = false;

  screenEl.innerHTML = "";

  const range = document.createElement("p");
  range.className = "guess-range";
  range.innerHTML =
    "[" + diffName + "] <strong>" + low + "</strong> 부터 <strong>" + high +
    "</strong> 사이의 숫자를 맞춰보세요!";
  screenEl.appendChild(range);

  const triesEl = document.createElement("p");
  triesEl.className = "tries";
  triesEl.id = "tries";
  screenEl.appendChild(triesEl);

  const hintEl = document.createElement("p");
  hintEl.className = "hint-big";
  hintEl.id = "bighint";
  screenEl.appendChild(hintEl);

  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "center";

  const input = document.createElement("input");
  input.className = "field";
  input.id = "guess";
  input.type = "number";
  input.min = String(low);
  input.max = String(high);
  input.placeholder = low + " ~ " + high;
  input.autocomplete = "off";

  const submit = document.createElement("button");
  submit.type = "button";
  submit.id = "submit";
  submit.className = "btn primary";
  submit.textContent = "입력";
  submit.addEventListener("click", () => guess(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") guess(input.value);
  });

  row.appendChild(input);
  row.appendChild(submit);
  screenEl.appendChild(row);

  const log = document.createElement("div");
  log.className = "log";
  log.id = "log";
  screenEl.appendChild(log);

  const foot = document.createElement("div");
  foot.className = "row";
  foot.style.justifyContent = "center";
  foot.innerHTML = "";

  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn ghost small";
  again.textContent = "같은 난이도로 다시";
  again.addEventListener("click", () => startGame(difficulty));

  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn ghost small";
  back.textContent = "난이도 다시 고르기";
  back.addEventListener("click", showDifficulty);

  foot.appendChild(again);
  foot.appendChild(back);
  screenEl.appendChild(foot);

  const rec = document.createElement("p");
  rec.className = "record-line";
  rec.id = "record";
  screenEl.appendChild(rec);

  const rank = document.createElement("div");
  rank.id = "ranking";
  screenEl.appendChild(rank);

  updateTries();
  addLog(low + " ~ " + high + " 사이의 숫자를 정했습니다. " +
         limit + "번 안에 맞춰보세요!");
  input.focus();
}

// 남은 기회 표시. 2번 이하로 남으면 경고색.
function updateTries() {
  const el = document.getElementById("tries");
  if (!el) return;
  const left = limit - tries;
  el.textContent = "남은 기회 " + left + "번  (시도 " + tries + " / " + limit + ")";
  el.style.color = left <= 2 ? "var(--warn)" : "";
}

function addLog(text, cls) {
  const log = document.getElementById("log");
  if (!log) return;
  const p = document.createElement("p");
  if (cls) p.className = cls;
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function setBigHint(text, cls) {
  const el = document.getElementById("bighint");
  el.textContent = text;
  el.className = "hint-big" + (cls ? " " + cls : "");
}

function guess(raw) {
  if (done) return;

  const input = document.getElementById("guess");
  const text = String(raw).trim();

  if (text === "") {
    addLog("숫자를 입력해주세요.", "note");
    return;
  }
  if (!/^-?\d+$/.test(text)) {
    addLog("숫자만 입력해주세요.", "note");
    return;
  }

  const value = parseInt(text, 10);
  if (value < low || value > high) {
    addLog(low + " ~ " + high + " 사이의 숫자를 입력해주세요.", "note");
    return;
  }

  tries++;
  updateTries();
  input.value = "";
  input.focus();

  if (value === answer) {
    done = true;
    setBigHint("정답! 🎉", "hit");
    addLog("정답입니다! " + you() + "님이 " + tries + "번 만에 맞추셨어요. 🎉", "good");
    finish(true);
    return;
  }

  if (value < answer) {
    setBigHint("더 큰 수! ↑", "up");
    addLog(value + " → 더 큰 수!");
  } else {
    setBigHint("더 작은 수! ↓", "down");
    addLog(value + " → 더 작은 수!");
  }

  const left = limit - tries;
  if (left <= 0) {
    done = true;
    setBigHint("기회 소진…", "down");
    addLog(you() + "님, " + limit + "번을 모두 사용했습니다. 정답은 " + answer + "였어요.", "bad");
    finish(false);
  } else if (left <= 2) {
    addLog("남은 기회 " + left + "번!", "note");
  }
}

/* 게임 종료: 입력을 막고 이번 판을 기록한다.
   대표 점수는 맞힌 판만 매긴다 — 기회를 적게 쓸수록 높다. */
function finish(won) {
  const input = document.getElementById("guess");
  if (input) input.disabled = true;
  const submit = document.getElementById("submit");
  if (submit) submit.disabled = true;

  const d = DIFFICULTIES.find((x) => x.key === diffKey);
  const seconds = GameScore.since(startedAt);

  GameScore.submit("number", {
    mode: diffKey,
    outcome: won ? "win" : "lose",
    score: won ? limit - tries + 1 : 0,
    detail: {
      difficulty: diffName,
      tries: tries,
      limit: limit,
      answer: answer,
      seconds: seconds,
    },
  })
    // 화면의 랭킹과 같은 조건(그 난이도 · 맞힌 판)으로 순위를 본다
    .then((saved) => GameHighScore.offer("number", saved, {
      mode: diffKey,
      outcome: "win",
      what: won ? saved.score + "점" : "",
    }))
    .then(() => {
    const rec = document.getElementById("record");
    if (!rec || !d) return;
    summaryText(d).then((text) => { rec.textContent = text; });

    /* 난이도마다 만점이 다르므로(쉬움 8 · 보통 10 · 어려움 12) 지금 고른
       난이도만 줄 세운다. 섞으면 어려움에서 잘한 사람이 손해다.
       진 판은 0 점이라 이긴 판만 후보로 둔다. */
    GameRank.paint(document.getElementById("ranking"), "number", {
      mode: diffKey,
      outcome: "win",
      title: d.name + " 랭킹",
      note: (r) => r.detail.tries + "번 만에",
    });
  });
}

/* ---------- 시작 ---------- */

// 허브에서 정한 닉네임. 아직 없으면 기본값.
function you() {
  return (window.GameNick && GameNick.name()) || "플레이어";
}

GameNick.require(showDifficulty);
