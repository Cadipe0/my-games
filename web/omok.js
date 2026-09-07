/* ============================================================
   오목 (Gomoku) — 15x15, 사람 vs 컴퓨터 / 돌 색은 판마다 추첨
   ============================================================ */

const SIZE = 15;
const EMPTY = 0;
const HUMAN = 1; // 사람
const AI = 2;    // 컴퓨터
// 돌 색(검/흰)은 판마다 추첨으로 정해진다. 검은 돌이 항상 선공.

// 가로 / 세로 / 대각선(↘) / 대각선(↗)
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// 5칸 창(window) 안의 내 돌 개수별 가치
const WEIGHT = [0, 1, 12, 150, 2000, 100000];

const STAR_POINTS = [
  [3, 3], [3, 11], [11, 3], [11, 11], [7, 7],
];

// 난이도. "보통"은 기존 로직 그대로, "어려움"은 미니맥스 + 알파베타(omok-ai.js).
const DIFFICULTIES = [
  { key: "normal", name: "보통" },
  { key: "hard", name: "어려움" },
];

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("reset");
const pHumanEl = document.getElementById("p-human");
const pAiEl = document.getElementById("p-ai");
const dotHumanEl = document.getElementById("dot-human");
const dotAiEl = document.getElementById("dot-ai");
const nameHumanEl = document.getElementById("name-human");
const nameAiEl = document.getElementById("name-ai");
const segEl = document.getElementById("difficulty");
const gateEl = document.getElementById("start-gate");
const gateChoicesEl = document.getElementById("start-choices");
const recordEl = document.getElementById("record");
const rankEl = document.getElementById("ranking");
const resetSlot = document.getElementById("record-reset");

let board = [];        // 길이 225 배열
let cellEls = [];      // 셀 DOM 참조
let humanIsBlack = true; // 판마다 추첨
let turn = HUMAN;
let gameOver = false;
let thinking = false;
let lastCell = null;
let aiLevel = "normal";  // 난이도 키
let moveToken = 0;       // 판이 새로 시작되면 진행 중이던 계산을 버리기 위한 표시
let started = false;     // 시작 카드를 지나 실제로 한 판이 진행 중인지
let myMoves = 0;         // 이 판에서 내가 둔 수 (기록용)
let startedAt = 0;       // 판 시작 시각 (기록용)
let recorded = false;    // 이 판의 결과를 이미 남겼는지

// 그 플레이어가 이번 판에 쥔 돌 색
function colorOf(player) {
  return (player === HUMAN) === humanIsBlack ? "black" : "white";
}

/* ---------- 난이도 ---------- */

function levelName() {
  const d = DIFFICULTIES.find((x) => x.key === aiLevel);
  return d ? d.name : aiLevel;
}

function buildDifficulty() {
  segEl.innerHTML = "";

  DIFFICULTIES.forEach((d) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.dataset.level = d.key;
    btn.textContent = d.name;
    btn.setAttribute("aria-pressed", String(d.key === aiLevel));
    btn.addEventListener("click", () => setLevel(d.key));
    segEl.appendChild(btn);
  });
}

function syncDifficultyUI() {
  segEl.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.level === aiLevel));
  });
}

// 난이도는 판을 새로 시작하지 않고 바로 바뀐다. 컴퓨터의 다음 수부터 적용.
function setLevel(key) {
  if (key === aiLevel) return;
  aiLevel = key;
  syncDifficultyUI();

  if (started && !gameOver && !thinking) {
    setStatus("난이도를 [" + levelName() + "]으로 바꿨습니다. 컴퓨터의 다음 수부터 적용됩니다.");
  }
  showRecord();
}

/* ---------- 시작 카드 ----------
   들어오자마자 판이 굴러가면 난이도를 고를 새도 없고, 추첨에서 컴퓨터가
   선공이면 손도 대기 전에 돌이 놓인다. 그래서 고르고 나서 시작한다. */

function buildStartGate() {
  gateChoicesEl.innerHTML = "";

  DIFFICULTIES.forEach((d, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.dataset.level = d.key;
    btn.innerHTML = '<span class="idx">' + (i + 1) + "</span>" + d.name;
    btn.addEventListener("click", () => startWith(d.key));
    gateChoicesEl.appendChild(btn);
  });
}

function showStartGate() {
  started = false;
  gameOver = false;
  thinking = false;
  moveToken++;   // 생각 중이던 계산이 남아 있어도 버린다

  board = new Array(SIZE * SIZE).fill(EMPTY);
  lastCell = null;

  cellEls.forEach((cell) => {
    cell.classList.remove("filled", "last", "win");
    cell.firstChild.className = "stone black";
  });

  // 아직 추첨 전이라 돌 색을 말할 수 없다
  dotHumanEl.className = "dot black";
  dotAiEl.className = "dot white";
  nameHumanEl.textContent = you();
  nameAiEl.textContent = "컴퓨터";

  boardEl.classList.add("locked");
  gateEl.hidden = false;
  updateTurnUI();
  setStatus("난이도를 고르면 판이 시작됩니다.");
  showRecord();
}

function startWith(key) {
  aiLevel = key;
  syncDifficultyUI();
  gateEl.hidden = true;
  resetGame();
}

/* ---------- 보드 만들기 ---------- */

function buildBoard() {
  boardEl.innerHTML = "";
  cellEls = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(r * SIZE + c);
      cell.setAttribute("aria-label", (r + 1) + "행 " + (c + 1) + "열");

      if (STAR_POINTS.some(([sr, sc]) => sr === r && sc === c)) {
        cell.classList.add("star");
      }

      const stone = document.createElement("span");
      stone.className = "stone black";
      cell.appendChild(stone);

      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

/* ---------- 게임 상태 ---------- */

function resetGame() {
  moveToken++;   // 생각 중이던 계산이 남아 있어도 이 판에는 반영되지 않는다
  started = true;
  board = new Array(SIZE * SIZE).fill(EMPTY);
  humanIsBlack = Math.random() < 0.5;   // 돌 색 추첨
  turn = humanIsBlack ? HUMAN : AI;     // 검은 돌이 선공
  gameOver = false;
  thinking = false;
  lastCell = null;
  myMoves = 0;
  startedAt = Date.now();
  recorded = false;

  cellEls.forEach((cell) => {
    cell.classList.remove("filled", "last", "win");
    cell.firstChild.className = "stone " + colorOf(HUMAN); // 호버 미리보기 색
  });

  boardEl.classList.remove("locked");
  showRecord();
  updateSideUI();
  updateTurnUI();

  if (turn === HUMAN) {
    setStatus("추첨 결과 — " + you() + "님이 검은 돌(선공)입니다. 원하는 자리를 클릭하세요.");
  } else {
    aiTurn("추첨 결과 — " + you() + "님이 흰 돌(후공)입니다. 컴퓨터가 먼저 둡니다…");
  }
}

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = "status" + (type ? " " + type : "");
}

function updateTurnUI() {
  pHumanEl.classList.toggle("active", started && !gameOver && turn === HUMAN);
  pAiEl.classList.toggle("active", started && !gameOver && turn === AI);
}

// 추첨 결과를 상단 표시(돌 아이콘 + 이름)에 반영
function updateSideUI() {
  dotHumanEl.className = "dot " + colorOf(HUMAN);
  dotAiEl.className = "dot " + colorOf(AI);
  nameHumanEl.textContent = you() + (humanIsBlack ? " · 검은 돌 (선공)" : " · 흰 돌 (후공)");
  nameAiEl.textContent = humanIsBlack ? "컴퓨터 · 흰 돌 (후공)" : "컴퓨터 · 검은 돌 (선공)";
}

function placeStone(index, player) {
  board[index] = player;

  const cell = cellEls[index];
  cell.firstChild.className = "stone " + colorOf(player);
  cell.classList.add("filled");

  if (lastCell) lastCell.classList.remove("last");
  cell.classList.add("last");
  lastCell = cell;
}

function endGame(message, type, winLine) {
  gameOver = true;
  boardEl.classList.add("locked");
  if (winLine) {
    winLine.forEach((i) => cellEls[i].classList.add("win"));
  }
  setStatus(message, type);
  updateTurnUI();
  saveResult(type);
}

/* ---------- 기록 ---------- */

/* 대표 점수는 이긴 판만 매긴다 — 적은 수로 이길수록 높다.
   지고 비긴 판은 0점이라 최고 기록 후보에 오르지 않는다. */
function saveResult(type) {
  if (recorded) return;
  recorded = true;

  const level = aiLevel;

  GameScore.submit("omok", {
    mode: level,
    outcome: type,                                   // win | lose | draw
    score: type === "win" ? Math.max(0, 1000 - myMoves) : 0,
    detail: {
      difficulty: levelName(),
      stone: humanIsBlack ? "흑" : "백",
      moves: myMoves,
      seconds: GameScore.since(startedAt),
    },
  })
    /* 순위에 들었으면 그 자리에서 이름을 받는다. 화면의 랭킹과 같은
       조건(난이도 · 이긴 판)으로 물어야 "3위라더니 표에 없네" 가 안 된다.
       진 판은 순위 후보가 아니므로 offer 가 알아서 넘어간다. */
    .then((saved) => GameHighScore.offer("omok", saved, {
      mode: level,
      outcome: "win",
      what: type === "win" ? saved.score + "점" : "",
    }))
    .then(showRecord);
}

// 지금 난이도의 누적 전적과 최고 기록을 상태줄 아래에 적는다.
function showRecord() {
  if (!recordEl) return;
  const level = aiLevel;

  Promise.all([
    GameScore.summary("omok", { mode: level }),
    GameScore.best("omok", { mode: level, outcome: "win" }),
  ]).then(([sum, top]) => {
    if (level !== aiLevel) return;   // 그새 난이도를 바꿨으면 버린다
    if (sum.plays === 0) {
      recordEl.textContent = "[" + levelName() + "] 아직 기록이 없습니다.";
      return;
    }
    let text = "[" + levelName() + "] " + sum.plays + "판 · " +
               sum.win + "승 " + sum.lose + "패 " + sum.draw + "무";
    if (sum.rate !== null) text += " (승률 " + sum.rate.toFixed(0) + "%)";
    if (top) {
      text += "  ·  최고 " + top.score + "점 (" + top.detail.moves + "수 · " +
              GameScore.formatDuration(top.detail.seconds) + ")";
    }
    recordEl.textContent = text;
  });

  /* 랭킹은 지금 난이도의 이긴 판만 줄 세운다 — 대표 점수를 이긴 판에만
     매기므로(진 판은 0점), 섞어 놓으면 0점 줄만 잔뜩 쌓인다. */
  GameRank.paint(rankEl, "omok", {
    mode: level,
    outcome: "win",
    title: levelName() + " 랭킹",
    note: (r) => r.detail.moves + "수",
  });
}

/* 초기화 버튼은 한 번만 만든다. 지우고 나면 전적과 랭킹을 다시 그린다.
   난이도와 상관없이 이 게임의 기록을 통째로 지운다 — 난이도별로 나눠
   지우면 "다 지웠는데 왜 남아 있지" 가 되기 쉽다. */
GameReset.attach(resetSlot, { game: "omok", onDone: showRecord });

/* ---------- 승리 판정 ---------- */

// (r, c)에 놓인 player의 돌을 기준으로 5목이 완성됐는지 확인.
// 완성됐으면 그 다섯(이상) 칸의 인덱스 배열, 아니면 null.
function findWinLine(index, player) {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;

  for (const [dr, dc] of DIRS) {
    const line = [index];

    // 한쪽 방향
    for (let k = 1; k < 5; k++) {
      const nr = r + dr * k;
      const nc = c + dc * k;
      if (!inBounds(nr, nc) || board[nr * SIZE + nc] !== player) break;
      line.push(nr * SIZE + nc);
    }
    // 반대 방향
    for (let k = 1; k < 5; k++) {
      const nr = r - dr * k;
      const nc = c - dc * k;
      if (!inBounds(nr, nc) || board[nr * SIZE + nc] !== player) break;
      line.unshift(nr * SIZE + nc);
    }

    if (line.length >= 5) return line;
  }
  return null;
}

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function isBoardFull() {
  return board.every((v) => v !== EMPTY);
}

// 착수 뒤 마무리 처리. 게임이 끝났으면 true.
function finishMove(index, player) {
  const win = findWinLine(index, player);
  if (win) {
    if (player === HUMAN) {
      endGame(you() + "님이 이겼습니다! 🎉", "win", win);
    } else {
      endGame("컴퓨터가 이겼습니다. 다시 도전해보세요!", "lose", win);
    }
    return true;
  }

  if (isBoardFull()) {
    endGame("더 이상 둘 곳이 없습니다. 무승부입니다.", "draw", null);
    return true;
  }

  return false;
}

/* ---------- 컴퓨터 ---------- */

// 이미 놓인 돌 주변(반경 2)의 빈칸만 후보로 삼는다.
function getCandidates() {
  const set = new Set();

  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) continue;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const idx = nr * SIZE + nc;
        if (board[idx] === EMPTY) set.add(idx);
      }
    }
  }
  return [...set];
}

// index에 player의 돌을 놓았다고 가정했을 때의 점수.
// 그 칸을 포함하는 모든 5칸 창을 훑어서, 상대 돌이 없는 창만 가치로 환산한다.
// (중간에 빈칸이 낀 33, 43 같은 모양도 자연스럽게 반영된다.)
function evaluatePoint(index, player) {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const opponent = player === AI ? HUMAN : AI;

  const prev = board[index];
  board[index] = player;

  let score = 0;

  for (const [dr, dc] of DIRS) {
    // 이 칸을 포함하는 5칸 창은 시작 위치가 -4 ~ 0 만큼 밀린 5가지
    for (let offset = -4; offset <= 0; offset++) {
      let count = 0;
      let valid = true;

      for (let k = 0; k < 5; k++) {
        const nr = r + dr * (offset + k);
        const nc = c + dc * (offset + k);
        if (!inBounds(nr, nc)) { valid = false; break; }

        const v = board[nr * SIZE + nc];
        if (v === opponent) { valid = false; break; }
        if (v === player) count++;
      }

      if (valid) score += WEIGHT[count];
    }
  }

  board[index] = prev;
  return score;
}

// 난이도에 따라 어떤 AI가 둘지 고른다. 계산이 끝나면 done(자리) 로 알려준다.
function chooseAiMove(done) {
  if (aiLevel === "hard" && window.OmokHardAI) {
    runHardAi(done);
    return;
  }
  done(chooseAiMoveNormal());
}

// [어려움] 탐색을 짧은 조각으로 나눠 돌린다.
// 한 조각이 끝날 때마다 제어를 브라우저에 돌려주므로 화면이 멈추지 않는다.
const HARD_SLICE_MS = 60;

function runHardAi(done) {
  const job = OmokHardAI.createJob(board, AI, HUMAN);
  const token = moveToken;

  (function tick() {
    if (token !== moveToken) return;   // 판이 새로 시작됐으면 통째로 버린다

    if (job.step(HARD_SLICE_MS)) {
      done(job.best);
      return;
    }
    setTimeout(tick, 0);
  })();
}

// [보통] 지금까지 쓰던 한 수 앞 평가 방식. 로직은 그대로다.
function chooseAiMoveNormal() {
  // 첫 수는 한가운데
  if (board.every((v) => v === EMPTY)) {
    return 7 * SIZE + 7;
  }

  const candidates = getCandidates();
  if (candidates.length === 0) return board.indexOf(EMPTY);

  // 1) 내가 바로 이길 수 있으면 둔다
  for (const idx of candidates) {
    board[idx] = AI;
    const win = findWinLine(idx, AI);
    board[idx] = EMPTY;
    if (win) return idx;
  }

  // 2) 상대가 다음 수에 이기면 막는다
  const blocks = [];
  for (const idx of candidates) {
    board[idx] = HUMAN;
    const win = findWinLine(idx, HUMAN);
    board[idx] = EMPTY;
    if (win) blocks.push(idx);
  }
  if (blocks.length > 0) {
    // 막을 곳이 여러 군데면 그중 내 공격에도 가장 도움이 되는 자리로
    return blocks.reduce((best, idx) =>
      evaluatePoint(idx, AI) > evaluatePoint(best, AI) ? idx : best
    );
  }

  // 3) 공격 + 수비 점수를 합쳐 가장 좋은 자리
  let bestIdx = candidates[0];
  let bestScore = -Infinity;

  for (const idx of candidates) {
    const attack = evaluatePoint(idx, AI);
    const defense = evaluatePoint(idx, HUMAN);

    const r = Math.floor(idx / SIZE);
    const c = idx % SIZE;
    const center = (7 - Math.abs(r - 7)) + (7 - Math.abs(c - 7)); // 0 ~ 14

    // 수비를 살짝 낮게 잡아, 비슷하면 공격을 택하게 한다.
    let score = attack + defense * 0.9 + center * 2;

    // 완벽하지 않게 — 비슷한 후보 중에서는 조금 흔들린다.
    score *= 0.94 + Math.random() * 0.12;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

function aiTurn(message) {
  const hard = aiLevel === "hard" && window.OmokHardAI;   // 어려움 난이도

  thinking = true;
  boardEl.classList.add("locked");
  setStatus(message || (hard ? "컴퓨터가 깊이 생각하는 중…" : "컴퓨터가 생각 중…"));

  const token = moveToken;

  // 즉시 두면 너무 딱딱해서 잠깐 뜸을 들인다.
  // 어려움은 탐색만으로도 시간이 걸리니 뜸을 짧게 잡는다.
  setTimeout(() => {
    if (token !== moveToken) return;

    chooseAiMove((idx) => {
      if (token !== moveToken) return;   // 그새 판이 바뀌었으면 두지 않는다
      thinking = false;

      // 둘 곳이 없으면(빈칸 없음) 무승부
      if (idx < 0 || board[idx] !== EMPTY) {
        endGame("더 이상 둘 곳이 없습니다. 무승부입니다.", "draw", null);
        return;
      }

      placeStone(idx, AI);
      if (finishMove(idx, AI)) return;

      turn = HUMAN;
      boardEl.classList.remove("locked");
      setStatus(you() + "님 차례입니다.");
      updateTurnUI();
    });
  }, hard ? 120 : 380);
}

/* ---------- 입력 ---------- */

boardEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  if (!started || gameOver || thinking || turn !== HUMAN) return;

  const idx = Number(cell.dataset.index);
  if (board[idx] !== EMPTY) return;

  placeStone(idx, HUMAN);
  myMoves++;
  if (finishMove(idx, HUMAN)) return;

  turn = AI;
  updateTurnUI();
  aiTurn();
});

// 시작 카드가 떠 있는 동안에는 다시 하기가 할 일이 없다
resetBtn.addEventListener("click", () => {
  if (started) resetGame();
});

/* ---------- 시작 ---------- */

// 허브에서 정한 닉네임. 아직 없으면 기본값.
function you() {
  return (window.GameNick && GameNick.name()) || "플레이어";
}

GameNick.require(function () {
  buildDifficulty();
  buildStartGate();
  buildBoard();
  showStartGate();
});
