/* ============================================================
   티카투카 — 3x3 주사위 대결 (가로 배치)

   흐름
     · 줄마다 왼쪽이 나, 오른쪽이 상대. 같은 줄끼리 합을 겨룬다.
     · 줄 점수: 같은 숫자가 n개면 (n-1)개 더 있는 것으로 친다 → v * (2n - 1)
         5 5 2 = 5*3 + 2 = 17,  5 5 5 = 5*5 = 25
     · 굴린 눈을 내 줄에 놓으면 내 점수가 된다.
     · 상대 줄에 같은 숫자가 있으면, 그 줄을 눌러 튕겨낼 수 있다.
       (주사위는 소모되고 내 줄에는 놓이지 않는다 — 점수냐 파괴냐의 선택)
     · 튕겨낸 직후에는 특수 주사위를 새로 굴려 그 자리에서 바로 놓는다.
       특수 주사위는 어느 줄에나 놓을 수 있고, 튕겨낼 수 없다.
       상대 줄에 놓으면 그 숫자는 상대 점수가 되므로 낮은 눈으로 칸을 막는 것이 좋다.
     · 3줄 중 2줄을 이기면 그 판 승리. 판이 오를수록 상대가 강해진다.
   ============================================================ */

const COLS = 3;
const SLOTS = 3;
const ME = "me";
const NPC = "npc";

const rowsEl = document.getElementById("rows");
const badgeEls = { me: document.getElementById("me-specials"), npc: document.getElementById("npc-specials") };
const dieEls = {
  me: document.getElementById("my-die"),
  npc: document.getElementById("npc-die"),
};
const trayEls = {
  me: document.getElementById("tray-me"),
  npc: document.getElementById("tray-npc"),
};
const trayNpcLabel = document.getElementById("tray-npc-label");
const trayMeLabel = document.getElementById("tray-me-label");
const myNameEl = document.getElementById("my-name");
const vsMeEl = document.getElementById("vs-me");
const trayOwnerEl = document.getElementById("tray-owner");
const statusEl = document.getElementById("status");
const streakLabel = document.getElementById("streak-label");
const roundActionsEl = document.getElementById("round-actions");
const rerollBtn = document.getElementById("reroll");
const dieAltEl = document.getElementById("my-die-alt");
const levelLabel = document.getElementById("level-label");
const npcNameEl = document.getElementById("npc-name");
const fxLayer = document.getElementById("fx");
const rollBtn = document.getElementById("roll-btn");
const recordEl = document.getElementById("record");
const rankEl = document.getElementById("ranking");
const resetSlot = document.getElementById("record-reset");
const surrenderBtn = document.getElementById("surrender");
const matchPanel = document.getElementById("match-panel");
const gamePanel = document.getElementById("game-panel");
const reelInner = document.getElementById("reel-inner");
const matchTitle = document.getElementById("match-title");
const vsBox = document.getElementById("vs");
const vsNpc = document.getElementById("vs-npc");
const vsLevel = document.getElementById("vs-level");
const matchStart = document.getElementById("match-start");

const LEVELS = [0, 0, 1, 1, 2, 2, 2, 3];
const LEVEL_NAMES = ["느긋함", "보통", "날카로움", "명인"];

const NAME_POOL = [
  "마이크", "잭", "톰", "해리", "올리버", "리암", "노아", "벤", "조지", "헨리",
  "루카스", "다니엘", "에이든", "맥스", "오스카", "레오", "찰리", "제이크", "라이언", "네이선",
  "이든", "코너", "루크", "제이슨", "브라이언", "케빈", "스티브", "앤디", "크리스", "데이브",
  "조던", "마틴", "로건", "마일로", "프레디", "엘리엇", "시몬", "빈센트", "하워드", "닐",
  "에밀리", "클로이", "릴리", "소피아", "올리비아", "클라라", "에바", "한나", "루시", "케이트",
  "앨리스", "조지아", "노라", "아이비", "머라이어", "재스민", "다이애나", "로라", "미아", "젤다",
];

const LEVEL_STYLE = [
  { randomMove: 0.60, jitter: 6, reply: 0 },     // 느긋함
  { randomMove: 0.35, jitter: 5, reply: 0 },     // 보통
  { randomMove: 0.05, jitter: 1, reply: 0.5 },   // 날카로움
  { randomMove: 0.00, jitter: 0, reply: 1.1 },   // 명인
];

let board;         // { me: [[{v, special, owner}], ...], npc: [...] }
let rerollUsed;
let turn;
let die;
let dieAlt;      // 한번더 굴리기로 남겨둔 다른 쪽 값
let phase;         // "place" | "special"
let round;
let wins, losses;
let busy;
let gameOver;
let npcName_;
let usedNames;
let awaitingRoll;   // 굴리기 버튼을 기다리는 중
let surrenderArmed; // 포기 버튼 두 번 확인
let actionCount;    // 한 판의 행동 수 (무한 공방 방지)
let streak;         // 연승

/* 기록은 한 세션(처음부터 다시 하기 전까지) 단위다.
   세션은 명확히 끝나지 않으므로, 판이 끝날 때마다 같은 id 로 덮어써서
   중간에 브라우저를 닫아도 여기까지 온 기록이 남게 한다. */
let offeredStreak = 0;   // 이름을 물어본 마지막 연승 기록 (같은 값으로 또 묻지 않으려고)
let sessionId = null;
let sessionStartedAt = 0;
let bestStreak = 0;

/* ---------- 기본 ---------- */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roll() {
  return randInt(1, 6);
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// 히스토리 창은 없앴다. 남겨두면 화면 밖으로 쌓이기만 하므로 아무것도 하지 않는다.
function log() {}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

// 연승만 항상 띄운다. 불꽃과 강조는 5연승부터.
function renderStreak() {
  const hot = streak >= 5;
  streakLabel.textContent = streak >= 1
    ? (hot ? "🔥 " : "") + streak + "연승중!"
    : "연승 없음";
  streakLabel.classList.toggle("hot", hot);
  streakLabel.classList.toggle("none", streak < 1);
}

function pickName() {
  const left = NAME_POOL.filter((n) => !usedNames.has(n));
  const pool = left.length ? left : NAME_POOL;
  const name = pool[randInt(0, pool.length - 1)];
  usedNames.add(name);
  return name;
}

/* ---------- 점수 ---------- */

function columnScore(cells) {
  const count = {};
  cells.forEach((d) => { count[d.v] = (count[d.v] || 0) + 1; });

  let total = 0;
  for (const v in count) total += Number(v) * (2 * count[v] - 1);
  return total;
}

function isFull(side) {
  return board[side].every((col) => col.length >= SLOTS);
}

function opposite(side) {
  return side === ME ? NPC : ME;
}

// 그 줄에서 value 로 튕겨낼 수 있는 주사위 (특수 주사위는 제외)
function knockTargets(side, col, value) {
  return board[side][col].filter((d) => !d.special && d.v === value);
}

// 같은 눈이 이미 있으면 그 바로 옆에 끼워 넣는다 (뒤의 주사위는 한 칸씩 밀린다)
function insertIndex(side, col, value) {
  const line = board[side][col];
  for (let i = line.length - 1; i >= 0; i--) {
    if (line[i].v === value) return i + 1;
  }
  return line.length;
}

function insertDie(side, col, die) {
  board[side][col].splice(insertIndex(side, col, die.v), 0, die);
}

function hasSpace(side, col) {
  return board[side][col].length < SLOTS;
}

function anySpace() {
  return [ME, NPC].some((s) => board[s].some((c, i) => hasSpace(s, i)));
}


/* ---------- 굴림판 주사위 (세로 릴) ---------- */

// 3x3 격자에서 눈이 찍히는 자리 (열, 행)
const PIP_LAYOUT = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
};

// 릴에 눈을 쌓는다. 마지막 칸이 결과가 된다.
function buildReel(el, values) {
  const side = el.classList.contains("mine") ? "mine" : "theirs";
  el.innerHTML = '<span class="reel-inner"></span>';
  const inner = el.firstElementChild;

  values.forEach((v) => {
    const cell = document.createElement("span");
    cell.className = "reel-cell pipface " + side;
    cell.innerHTML = pipsHTML(v);
    inner.appendChild(cell);
  });
  inner.style.transform = "translateY(0)";
  return inner;
}

function setDieFace(el, v) {
  buildReel(el, [v]);
}

/* ---------- 화면 ---------- */

// 눈(pip) 배치를 마크업으로. 작은 화면에서는 CSS 가 <b> 안의 숫자로 바꿔 보여준다.
function pipsHTML(v) {
  return PIP_LAYOUT[v]
    .map(([col, row]) => '<i style="grid-column:' + col + ';grid-row:' + row + '"></i>')
    .join("") + "<b>" + v + "</b>";
}

function dieHTML(d) {
  return '<span class="die pipface ' + (d.owner === ME ? "mine" : "theirs") +
         (d.special ? " special" : "") + '">' + pipsHTML(d.v) + "</span>";
}

// 같은 눈이 붙어 있으면 그 사이에 작은 주사위를 하나 넣는다.
// 점수 규칙(v × (2n-1) = 같은 눈이 n개면 n-1개가 더 있는 셈)을 눈으로 보여주는 표시다.
function bonusHTML(d) {
  return '<span class="bonus-die pipface ' + (d.owner === ME ? "mine" : "theirs") + '">' +
         pipsHTML(d.v) + "</span>";
}

function sideCellsHTML(side, col) {
  // 각자 가운데(화면 중앙) 쪽부터 채워진다 — 내 쪽은 오른쪽부터, 상대 쪽은 왼쪽부터
  const padded = board[side][col].slice();
  while (padded.length < SLOTS) padded.push(null);
  const view = side === ME ? padded.reverse() : padded;

  const cells = [];
  for (let i = 0; i < SLOTS; i++) {
    const d = view[i];
    const next = view[i + 1];
    const prev = view[i - 1];
    const bonus = d && next && d.v === next.v ? bonusHTML(d) : "";

    // 같은 눈 묶음의 첫 칸이면 묶음 전체를 감싸는 띠를 깐다
    let band = "";
    if (d && (!prev || prev.v !== d.v)) {
      let n = 1;
      while (view[i + n] && view[i + n].v === d.v) n++;
      if (n > 1) band = '<span class="group-band" style="--n:' + n + '"></span>';
    }

    cells.push('<span class="tk-cell' + (d ? " has-die" : "") + '">' +
               band + (d ? dieHTML(d) : "") + bonus + "</span>");
  }
  return cells.join("");
}

// 지금 그 줄을 누를 수 있는가 + 어떤 동작인가
function actionFor(side, col) {
  if (busy || gameOver || turn !== ME || awaitingRoll) return null;

  if (phase === "special") {
    return hasSpace(side, col) ? "special" : null;
  }
  if (side === ME) {
    return hasSpace(ME, col) ? "place" : null;
  }
  // 상대 줄 — 같은 숫자가 있어야 하고, 내 같은 번호 줄에 자리가 남아 있어야 한다
  if (!knockTargets(NPC, col, die).length) return null;
  return hasSpace(ME, col) ? "knock" : null;
}

function render() {
  rowsEl.innerHTML = "";

  for (let c = 0; c < COLS; c++) {
    const mine = columnScore(board.me[c]);
    const theirs = columnScore(board.npc[c]);

    let cls = "tie", mark = "무";
    if (mine > theirs) { cls = "win"; mark = "승"; }
    else if (mine < theirs) { cls = "lose"; mark = "패"; }

    const meAct = actionFor(ME, c);
    const npcAct = actionFor(NPC, c);

    const row = document.createElement("div");
    row.className = "tk-row";
    row.dataset.col = String(c);
    row.innerHTML =
      '<button type="button" class="tk-cells me' +
        (meAct ? " playable act-" + meAct : "") +
        '" data-side="me" data-col="' + c + '">' + sideCellsHTML(ME, c) + "</button>" +
      '<div class="tk-mid">' +
        '<span class="tk-sum mine">' + mine + "</span>" +
        '<span class="tk-line ' + cls + '">' + (c + 1) + "줄 " + mark + "</span>" +
        '<span class="tk-sum theirs">' + theirs + "</span>" +
      "</div>" +
      '<button type="button" class="tk-cells npc' +
        (npcAct ? " playable act-" + npcAct : "") +
        '" data-side="npc" data-col="' + c + '">' + sideCellsHTML(NPC, c) + "</button>";

    rowsEl.appendChild(row);
  }

  // 튕겨낼 수 있는 상대 주사위에 표시
  if (turn === ME && !busy && !gameOver && phase === "place") {
    for (let c = 0; c < COLS; c++) {
      if (!knockTargets(NPC, c, die).length || !hasSpace(ME, c)) continue;
      const cellsEl = rowsEl.querySelector('.tk-cells[data-side="npc"][data-col="' + c + '"]');
      [].slice.call(cellsEl.querySelectorAll(".die")).forEach((el) => {
        if (!el.classList.contains("special") && Number(el.textContent) === die) {
          el.classList.add("target");
        }
      });
    }
  }

  // 차례인 쪽 굴림판만 선명하게
  [ME, NPC].forEach((side) => {
    const active = turn === side && !gameOver;
    dieEls[side].className = "die-reel " + (side === ME ? "mine" : "theirs") +
                             (active && phase === "special" ? " special" : "") +
                             (active ? "" : " idle");
    if (active && die) setDieFace(dieEls[side], die);
    else if (!dieEls[side].querySelector(".reel-cell")) setDieFace(dieEls[side], 1);
    trayEls[side].classList.toggle("active", active);
    trayEls[side].classList.toggle("special", active && phase === "special");
  });
  trayNpcLabel.textContent = npcName_ ? npcName_ + "의 굴림판" : "상대 굴림판";

  // 한번더 굴린 뒤에는 두 값이 나란히 놓이고, 누르는 쪽이 실제로 쓰는 값이 된다
  const picking = dieAlt !== null && dieAlt !== undefined && turn === ME && !gameOver;
  dieAltEl.hidden = !picking;
  dieEls.me.classList.toggle("picked", picking);
  if (picking) {
    dieAltEl.innerHTML = pipsHTML(dieAlt);
    dieAltEl.title = dieAlt + "(으)로 바꾸기";
    dieAltEl.disabled = busy;
  } else {
    dieAltEl.innerHTML = "";
  }

  badgeEls.me.textContent = (turn === ME && phase === "special") ? "특수 주사위!" : "";
  badgeEls.npc.textContent = (turn === NPC && phase === "special") ? "특수 주사위!" : "";

  rollBtn.disabled = busy || gameOver || turn !== ME || !awaitingRoll;
  rollBtn.textContent = phase === "special" ? "특수 주사위 굴리기" : "주사위 굴리기";
  rollBtn.classList.toggle("waiting", !rollBtn.disabled);

  surrenderBtn.disabled = gameOver;
  surrenderBtn.textContent = surrenderArmed ? "정말 포기?" : "포기";
  surrenderBtn.classList.toggle("armed", !!surrenderArmed);

  rerollBtn.disabled = busy || gameOver || rerollUsed[ME] || turn !== ME || awaitingRoll || !die;
  rerollBtn.textContent = rerollUsed[ME] ? "한번더 굴리기 (사용함)" : "한번더 굴리기 (1회)";
}

/* ---------- 연출 ---------- */

// 애니메이션을 기다리되, 탭이 백그라운드라 타임라인이 멈춘 경우에도
// 진행이 막히지 않도록 시간 제한을 함께 건다.
function playOnce(el, frames, opts) {
  let anim = null;
  try { anim = el.animate(frames, opts); } catch (e) { /* 지원하지 않으면 그냥 넘어간다 */ }

  const guard = wait((opts.duration || 300) + (opts.delay || 0) + 80);
  if (!anim) return guard;
  return Promise.race([anim.finished.catch(() => {}), guard]);
}

// 각자 자기 굴림판에서 굴린다.
// 1~6 이 세로로 빠르게 흘러가다가 점점 느려지고 결과에서 멈춘다.
const ROLL_MS = 1600;      // 도는 시간
const SETTLE_MS = 260;     // 멈출 때 튕기는 시간
const REEL_LEN = 24;       // 지나가는 눈의 개수

function rollAnimation(owner, value, special) {
  const el = dieEls[owner];
  const tray = trayEls[owner];

  trayOwnerEl.textContent = (owner === ME ? you() + "의 주사위" : npcName_ + "의 주사위") +
                            (special ? " · 특수" : "");
  tray.classList.add("rolling");

  // 지나갈 눈들 + 마지막에 실제 결과
  const strip = [];
  for (let i = 0; i < REEL_LEN; i++) strip.push(randInt(1, 6));
  strip.push(value);

  const inner = buildReel(el, strip);
  const step = el.clientHeight || 60;
  const distance = (strip.length - 1) * step;

  return playOnce(inner, [
    { transform: "translateY(0)" },
    { transform: "translateY(-" + distance + "px)" },
  ], { duration: ROLL_MS, easing: "cubic-bezier(.12,.72,.16,1)", fill: "forwards" })
    .then(() => {
      tray.classList.remove("rolling");
      setDieFace(el, value);          // 결과 한 칸만 남긴다
      el.classList.add("landed");
      setTimeout(() => el.classList.remove("landed"), SETTLE_MS + 60);

      return playOnce(el, [
        { transform: "scale(1.16)" },
        { transform: "scale(0.95)" },
        { transform: "scale(1)" },
      ], { duration: SETTLE_MS, easing: "ease-out" });
    });
}

function cellsElement(side, col) {
  return rowsEl.querySelector('.tk-cells[data-side="' + side + '"][data-col="' + col + '"]');
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

// 다음에 채워질 칸의 DOM 요소를 찾는다 (내 쪽은 뒤집어 그려져 있다)
function nextCellElement(side, col, value) {
  const cellsEl = cellsElement(side, col);
  if (!cellsEl) return null;
  const index = insertIndex(side, col, value);        // 이번에 들어갈 자리
  const visual = side === ME ? SLOTS - 1 - index : index;   // 가운데 쪽부터
  return cellsEl.children[Math.max(0, Math.min(SLOTS - 1, visual))] || cellsEl;
}

// 굴림판의 주사위가 놓일 칸으로 곧장 날아간다
function flyTo(targetEl, value, owner, special) {
  const from = centerOf(dieEls[owner]);
  if (!targetEl) return Promise.resolve();
  const to = centerOf(targetEl);

  const ghost = document.createElement("span");
  ghost.className = "fx-fly pipface " + (owner === ME ? "mine" : "theirs") + (special ? " special" : "");
  ghost.innerHTML = pipsHTML(value);
  ghost.style.left = (from.x - 22) + "px";
  ghost.style.top = (from.y - 22) + "px";
  ghost.style.fontSize = "46px";     // em 기준 패딩용 (고정 위치라 % 패딩은 뷰포트 기준이 된다)
  fxLayer.appendChild(ghost);

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // 중간을 거치지 않고 목표 칸으로 직선에 가깝게 (살짝만 떠오른다)
  return playOnce(ghost, [
    { transform: "translate(0,0) rotate(0deg) scale(1.1)" },
    { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 10) + "px) rotate(180deg) scale(1.02)", offset: 0.5 },
    { transform: "translate(" + dx + "px," + dy + "px) rotate(360deg) scale(0.95)" },
  ], { duration: 260, easing: "cubic-bezier(.4,0,.25,1)" }).then(() => ghost.remove());
}

// 칸에 꽂히는 순간의 이펙트 — 고리 파동 + 먼지 + 이웃 흔들림
function placeFx(side, col, index) {
  const cellsEl = cellsElement(side, col);
  if (!cellsEl) return;

  const visual = side === ME ? SLOTS - 1 - index : index;   // 가운데 쪽부터
  const cell = cellsEl.children[Math.max(0, Math.min(SLOTS - 1, visual))];
  const landed = cell ? cell.querySelector(".die") : null;
  const at = centerOf(landed || cellsEl);

  const ring = document.createElement("span");
  ring.className = "fx-ring";
  ring.style.left = (at.x - 26) + "px";
  ring.style.top = (at.y - 26) + "px";
  fxLayer.appendChild(ring);
  setTimeout(() => ring.remove(), 460);

  for (let i = 0; i < 5; i++) {
    const dust = document.createElement("span");
    dust.className = "fx-dust";
    dust.style.left = at.x + "px";
    dust.style.top = (at.y + 10) + "px";
    fxLayer.appendChild(dust);

    const angle = Math.PI + (Math.random() - 0.5) * 2.4;
    const dist = 18 + Math.random() * 26;
    playOnce(dust, [
      { transform: "translate(0,0) scale(1)", opacity: 0.9 },
      { transform: "translate(" + Math.cos(angle) * dist + "px," +
                   (-Math.abs(Math.sin(angle)) * dist * 0.5) + "px) scale(0.3)", opacity: 0 },
    ], { duration: 380, easing: "ease-out" }).then(() => dust.remove());
  }

  if (landed) {
    playOnce(landed, [
      { transform: "translateY(-10px) scale(1.2, 0.82)" },
      { transform: "translateY(0) scale(0.9, 1.14)", offset: 0.5 },
      { transform: "none" },
    ], { duration: 320, easing: "cubic-bezier(.2,1.3,.4,1)" });
  }
  jiggleNeighbors(side, col, side === ME ? -1 : 1);
}

// 충돌 순간 — 부딪힌 지점에서 진행 방향으로 불꽃이 튀고 줄이 흔들린다
function impact(side, col, at, dir) {
  const cellsEl = cellsElement(side, col);
  if (cellsEl) {
    const row = cellsEl.closest(".tk-row");
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 380);
  }

  const flash = document.createElement("span");
  flash.className = "fx-flash";
  flash.style.left = (at.x - 40) + "px";
  flash.style.top = (at.y - 40) + "px";
  fxLayer.appendChild(flash);
  setTimeout(() => flash.remove(), 440);

  // 부딪힌 방향으로 퍼지는 원뿔 모양
  for (let i = 0; i < 12; i++) {
    const spark = document.createElement("span");
    spark.className = "fx-spark";
    spark.style.left = at.x + "px";
    spark.style.top = at.y + "px";
    fxLayer.appendChild(spark);

    const spread = (Math.random() - 0.5) * 1.6;      // 앞쪽으로 벌어지는 각도
    const angle = (dir > 0 ? 0 : Math.PI) + spread;
    const dist = 45 + Math.random() * 70;

    playOnce(spark, [
      { transform: "translate(0,0) scale(1.1)", opacity: 1 },
      { transform: "translate(" + Math.cos(angle) * dist + "px," +
                   (Math.sin(angle) * dist * 0.6 - 10) + "px) scale(0.2)", opacity: 0 },
    ], { duration: 520, easing: "cubic-bezier(.15,.85,.35,1)" }).then(() => spark.remove());
  }
}

// 고정 위치에 원래 주사위와 똑같이 생긴 분신을 만든다
function makeGhost(rect, extraClass, value) {
  const g = document.createElement("span");
  g.className = "fx-die pipface " + extraClass;
  g.innerHTML = pipsHTML(Number(value));
  g.style.left = rect.left + "px";
  g.style.top = rect.top + "px";
  g.style.width = rect.width + "px";
  g.style.height = rect.height + "px";
  g.style.fontSize = rect.width + "px";   // em 기준 패딩용
  fxLayer.appendChild(g);
  return g;
}

function tf(x, y, rot, sx, sy) {
  return "translate(" + x + "px," + y + "px) rotate(" + rot + "deg) scale(" + sx + "," + sy + ")";
}

/* 밀어내기 한 장면.
   ① 공격 주사위가 목표 바로 앞까지 날아온다
   ② 부딪히는 순간 둘 다 납작하게 눌린다 (히트스톱)
   ③ 공격 주사위가 뒤를 밀며 함께 가로로 이동한다  ← 여기가 '밀어내는' 구간
   ④ 공격 주사위는 멈추고, 맞은 주사위만 줄 밖으로 미끄러져 나간다  */
async function pushSequence(attackerRect, victimRects, value, owner, dir) {
  const attacker = makeGhost(attackerRect, owner === ME ? "mine" : "theirs", value);
  const victims = victimRects.map((r) => makeGhost(r, r.owner === ME ? "mine" : "theirs", r.v));
  if (!victims.length) { attacker.remove(); return; }

  const lead = victimRects[0];
  // 목표 주사위의 '뒤쪽'에 붙는 위치
  const contactX = lead.left - dir * lead.width * 0.92 - attackerRect.left;
  const contactY = lead.top - attackerRect.top;

  // ① 접근
  await playOnce(attacker, [
    { transform: tf(0, 0, 0, 1.15, 1.15) },
    { transform: tf(contactX * 0.6, contactY * 0.6 - 26, 200, 1.1, 1.1), offset: 0.6 },
    { transform: tf(contactX, contactY, 350, 1.05, 1.05) },
  ], { duration: 300, easing: "cubic-bezier(.35,.05,.25,1)", fill: "forwards" });

  // ② 충돌 — 공격 쪽은 가로로 눌리고, 맞은 쪽은 반대로 늘어난다
  const squash = playOnce(attacker, [
    { transform: tf(contactX, contactY, 350, 1.05, 1.05) },
    { transform: tf(contactX + dir * 6, contactY, 356, 0.74, 1.2) },
    { transform: tf(contactX + dir * 4, contactY, 360, 1.02, 1.0) },
  ], { duration: 150, easing: "ease-out", fill: "forwards" });

  victims.forEach((v, i) => {
    playOnce(v, [
      { transform: tf(0, 0, 0, 1, 1) },
      { transform: tf(dir * 5, 0, dir * 2, 1.16, 0.82) },
      { transform: tf(dir * 10, 0, dir * 4, 1.05, 0.95) },
    ], { duration: 150, delay: i * 30, easing: "ease-out", fill: "forwards" });
  });
  await squash;

  // ③ 밀어내기 — 공격 주사위가 바짝 붙어 함께 간다
  const shove = 88;
  const together = playOnce(attacker, [
    { transform: tf(contactX + dir * 4, contactY, 360, 1.02, 1.0) },
    { transform: tf(contactX + dir * shove, contactY, 380, 1.0, 1.0) },
  ], { duration: 400, easing: "cubic-bezier(.25,.6,.35,1)", fill: "forwards" });

  victims.forEach((v, i) => {
    playOnce(v, [
      { transform: tf(dir * 10, 0, dir * 4, 1.05, 0.95) },
      { transform: tf(dir * (shove + 14), -4, dir * 26, 1, 1) },
    ], { duration: 400, delay: i * 30, easing: "cubic-bezier(.25,.6,.35,1)", fill: "forwards" });
  });
  await together;

  // ④ 공격 주사위는 멈춰 서고, 맞은 주사위는 줄 밖으로 미끄러져 나간다
  playOnce(attacker, [
    { transform: tf(contactX + dir * shove, contactY, 380, 1.0, 1.0), opacity: 1 },
    { transform: tf(contactX + dir * (shove - 16), contactY - 6, 372, 0.9, 0.9), opacity: 0 },
  ], { duration: 280, easing: "ease-out" }).then(() => attacker.remove());

  await Promise.all(victims.map((v, i) => playOnce(v, [
    { transform: tf(dir * (shove + 14), -4, dir * 26, 1, 1), opacity: 1 },
    { transform: tf(dir * (shove + 210), 26, dir * 300, 0.72, 0.72), opacity: 0 },
  ], { duration: 420, delay: i * 40, easing: "cubic-bezier(.3,.4,.6,1)" }).then(() => v.remove())));
}

// 같은 줄의 나머지 주사위도 충격에 흔들린다
function jiggleNeighbors(side, col, dir) {
  const cellsEl = cellsElement(side, col);
  if (!cellsEl) return;
  [].slice.call(cellsEl.querySelectorAll(".die")).forEach((el, i) => {
    playOnce(el, [
      { transform: "translate(0,0)" },
      { transform: "translate(" + dir * 6 + "px,-3px)" },
      { transform: "translate(0,0)" },
    ], { duration: 300, delay: i * 45, easing: "ease-out" });
  });
}

/* ---------- 행동 ---------- */

// 내 줄(또는 특수 주사위로 아무 줄)에 놓기
async function doPlace(side, col, value, owner, special) {
  busy = true;
  render();

  const landIndex = insertIndex(side, col, value);
  await flyTo(nextCellElement(side, col, value), value, owner, special);
  insertDie(side, col, { v: value, special: special, owner: owner });
  render();
  placeFx(side, col, landIndex);

  log((owner === ME ? "나" : npcName_) + ": " + (col + 1) + "줄에 " + value +
      (special ? " (특수)" : "") +
      (side !== owner ? " — 상대 줄을 막았습니다" : ""), owner === ME ? "" : "");

  await wait(260);
}

// 상대 줄의 같은 숫자를 튕겨내기 — 주사위가 주사위를 밀어낸다.
// 연출이 끝나기 전에는 판을 다시 그리지 않는다 (옆 주사위가 미리 움직이지 않도록).
async function doKnock(foe, col, value, owner) {
  busy = true;
  render();

  const cellsEl = cellsElement(foe, col);
  const victimEls = [].slice.call(cellsEl.querySelectorAll(".die")).filter((el) =>
    !el.classList.contains("special") && Number(el.textContent) === value);

  const dir = owner === ME ? 1 : -1;   // 내가 치면 오른쪽으로 밀어낸다

  // 밀리는 순서: 미는 방향의 뒤쪽부터
  victimEls.sort((a, b) => (a.getBoundingClientRect().left - b.getBoundingClientRect().left) * dir);

  const victimRects = victimEls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left, top: r.top, width: r.width, height: r.height,
      v: el.textContent, owner: el.classList.contains("mine") ? ME : NPC,
    };
  });

  const trayRect = dieEls[owner].getBoundingClientRect();
  const attackerRect = {
    left: trayRect.left, top: trayRect.top,
    width: victimRects.length ? victimRects[0].width : trayRect.width,
    height: victimRects.length ? victimRects[0].height : trayRect.height,
  };

  // 원래 주사위는 감추고 분신이 대신 연기한다 — 판은 아직 그대로라 이웃이 움직이지 않는다
  victimEls.forEach((el) => { el.style.visibility = "hidden"; });
  const knocked = victimEls.length;

  const at = victimRects.length
    ? { x: victimRects[0].left + victimRects[0].width / 2, y: victimRects[0].top + victimRects[0].height / 2 }
    : centerOf(cellsEl);

  // 충돌 순간에 맞춰 불꽃과 흔들림
  setTimeout(() => {
    impact(foe, col, at, dir);
    jiggleNeighbors(foe, col, dir);
  }, 300);

  await pushSequence(attackerRect, victimRects, value, owner, dir);

  // 연출이 끝난 뒤에야 판을 정리한다 (여기서 남은 주사위가 자리를 옮긴다)
  board[foe][col] = board[foe][col].filter((d) => d.special || d.v !== value);
  render();

  log((owner === ME ? "나" : npcName_) + ": " + (col + 1) + "줄의 " + value + " " +
      knocked + "개를 밀어냈습니다!", owner === ME ? "good" : "bad");

  await wait(160);
  return knocked;
}

/* ---------- 판 진행 ---------- */

const FORCED_LEVEL = (function () {
  const m = /[?&]lv=([0-3])/.exec(location.search);
  return m ? Number(m[1]) : null;
})();

function npcLevel() {
  if (FORCED_LEVEL !== null) return FORCED_LEVEL;
  return round > LEVELS.length ? 3 : LEVELS[round - 1];
}

function startRound(keepOpponent) {
  saveResume(true);   // 지금부터 판 도중이다 (여기서 닫으면 패배로 친다)
  board = { me: [[], [], []], npc: [[], [], []] };
  rerollUsed = { me: false, npc: false };
  phase = "place";
  busy = false;
  gameOver = false;
  surrenderArmed = false;
  actionCount = 0;
  roundActionsEl.innerHTML = "";

  if (!keepOpponent) npcName_ = pickName();

  renderStreak();
  npcNameEl.textContent = npcName_;
  levelLabel.textContent = LEVEL_NAMES[npcLevel()];

  log(round + "판 시작 — 상대: " + npcName_ + " (" + levelLabel.textContent + ")", "hi");
  if (wins >= 8) log("상대도 이제 한번더 굴리기를 씁니다.", "note");

  turn = round % 2 === 1 ? ME : NPC;
  die = null;
  dieAlt = null;
  render();

  if (turn === ME) beginMyTurn();
  else beginNpcTurn();
}

function beginMyTurn() {
  phase = "place";
  awaitingRoll = true;
  busy = false;
  die = null;
  dieAlt = null;
  render();
  setStatus("주사위 굴리기 버튼을 눌러 주사위를 굴리세요.");
}

// 굴리기 버튼 — 첫 굴림과 특수 주사위 굴림 모두 여기를 지난다
async function doMyRoll() {
  if (!awaitingRoll || turn !== ME || busy || gameOver) return;

  awaitingRoll = false;
  busy = true;
  dieAlt = null;
  die = roll();
  render();
  setStatus(phase === "special" ? "특수 주사위를 굴립니다…" : "주사위를 굴립니다…");

  await rollAnimation(ME, die, phase === "special");

  busy = false;
  render();
  setStatus(phase === "special"
    ? "특수 주사위 " + die + " — 아무 줄에나 놓을 수 있습니다. 상대 줄에 놓으면 그 숫자는 상대 점수가 됩니다."
    : "내 줄에 놓으면 " + die + "점, 상대 줄에 같은 숫자가 있으면 눌러서 튕겨낼 수 있습니다.");
}

// 튕겨낸 뒤 바로 굴리는 특수 주사위
async function beginSpecial(owner) {
  if (!anySpace()) {
    log("놓을 칸이 없어 특수 주사위를 쓰지 못했습니다.", "note");
    return;
  }

  phase = "special";

  if (owner === ME) {
    // 사람은 버튼을 눌러 직접 굴린다
    awaitingRoll = true;
    busy = false;
    die = null;
  dieAlt = null;
    render();
    setStatus("튕겨냈습니다! 특수 주사위 굴리기 버튼을 누르세요.");
    return "wait";
  }

  busy = true;
  dieAlt = null;
  die = roll();
  render();
  setStatus(npcName_ + "의 특수 주사위…");
  await rollAnimation(owner, die, true);

  const move = chooseSpecialMove(die);
  await doPlace(move.side, move.col, die, NPC, true);
  return "done";
}

const MAX_ACTIONS = 80;   // 서로 밀어내기만 반복해 판이 끝나지 않는 것을 막는다

async function afterAction() {
  dieAlt = null;
  phase = "place";
  actionCount++;

  // 양쪽 모두 놓을 곳이 없어야 판이 끝난다 (한쪽만 찼다고 승패가 갈리지 않는다)
  if (isFull(ME) && isFull(NPC)) {
    finishRound();
    return;
  }
  if (actionCount >= MAX_ACTIONS) {
    log("공방이 길어져 현재 점수로 판을 마칩니다.", "note");
    finishRound();
    return;
  }

  turn = opposite(turn);

  // 놓을 곳이 없는 쪽은 차례를 넘긴다
  if (isFull(turn)) {
    log((turn === ME ? "나" : npcName_) + ": 놓을 곳이 없어 차례를 넘깁니다.", "note");
    turn = opposite(turn);
    if (isFull(turn)) { finishRound(); return; }
  }

  if (turn === ME) beginMyTurn();
  else beginNpcTurn();
}

/* ---------- 내 차례 ---------- */

rowsEl.addEventListener("click", async (e) => {
  const cellsEl = e.target.closest(".tk-cells");
  if (!cellsEl) return;

  const side = cellsEl.dataset.side;
  const col = Number(cellsEl.dataset.col);
  const action = actionFor(side, col);

  if (!action) {
    if (busy || gameOver || turn !== ME) return;
    if (side === NPC) {
      if (!hasSpace(ME, col) && knockTargets(NPC, col, die).length) {
        setStatus("내 " + (col + 1) + "줄이 꽉 차 있어 그 줄에서는 튕겨낼 수 없습니다.", "warn");
      } else {
        setStatus("그 줄에는 " + die + "이(가) 없어 튕겨낼 수 없습니다.", "warn");
      }
    }
    else setStatus("그 줄은 이미 가득 찼습니다.", "warn");
    return;
  }

  if (action === "special") {
    await doPlace(side, col, die, ME, true);
    afterAction();
    return;
  }

  if (action === "place") {
    await doPlace(ME, col, die, ME, false);
    afterAction();
    return;
  }

  // knock
  await doKnock(NPC, col, die, ME);
  const state = await beginSpecial(ME);
  if (state !== "wait") afterAction();
});

rollBtn.addEventListener("click", doMyRoll);

// 포기 — 실수로 누르지 않도록 두 번 확인한다
let surrenderTimer = null;
surrenderBtn.addEventListener("click", () => {
  if (gameOver) return;

  if (!surrenderArmed) {
    surrenderArmed = true;
    render();
    setStatus("포기하면 이 판은 패배로 기록됩니다. 한 번 더 누르면 확정됩니다.", "warn");
    clearTimeout(surrenderTimer);
    surrenderTimer = setTimeout(() => { surrenderArmed = false; render(); }, 4000);
    return;
  }

  clearTimeout(surrenderTimer);
  surrenderArmed = false;
  finishRound(true);
});

rerollBtn.addEventListener("click", async () => {
  if (rerollUsed[ME] || turn !== ME || busy || gameOver) return;
  rerollUsed[ME] = true;

  const before = die;
  dieAlt = null;
  die = roll();
  busy = true;
  render();
  await rollAnimation(ME, die, phase === "special");

  dieAlt = before;          // 이전 값도 남겨 둔다
  busy = false;
  render();

  log("한번더 굴리기: " + before + " / " + die + " 중 선택", "note");
  setStatus("한번더 굴렸습니다. " + before + "과(와) " + die + " 중 쓸 주사위를 눌러서 고르세요.");
});

// 굴림판의 다른 값을 누르면 그쪽을 쓴다 (서로 자리를 바꾼다)
dieAltEl.addEventListener("click", () => {
  if (dieAlt === null || dieAlt === undefined || turn !== ME || busy || gameOver) return;
  const other = dieAlt;
  dieAlt = die;
  die = other;
  render();
  setStatus(phase === "special"
    ? "특수 주사위 " + die + " — 아무 줄에나 놓을 수 있습니다."
    : die + "을(를) 골랐습니다. 내 줄에 놓으면 " + die + "점입니다.");
});

/* ---------- 상대 차례 ---------- */

async function beginNpcTurn() {
  busy = true;
  awaitingRoll = false;
  phase = "place";
  render();
  setStatus(npcName_ + "이(가) 주사위를 굴립니다…");

  dieAlt = null;
  die = roll();
  await rollAnimation(NPC, die, false);

  if (npcWantsReroll(die)) {
    rerollUsed[NPC] = true;
    const before = die;
    dieAlt = null;
  die = roll();
    log(npcName_ + ": 한번더 굴리기 " + before + " → " + die, "note");
    await rollAnimation(NPC, die, false);
  }

  setStatus(npcName_ + "이(가) 생각 중…");
  await wait(320);

  const move = chooseNpcMove(die);
  if (!move) {
    log(npcName_ + ": 놓을 곳이 없어 차례를 넘깁니다.", "note");
    afterAction();
    return;
  }

  if (move.type === "knock") {
    await doKnock(ME, move.col, die, NPC);
    await beginSpecial(NPC);
  } else {
    await doPlace(NPC, move.col, die, NPC, false);
  }

  afterAction();
}

/* ---------- 상대 두뇌 ---------- */

function cloneBoard(state) {
  return { me: state.me.map((c) => c.slice()), npc: state.npc.map((c) => c.slice()) };
}

function applyPlace(state, side, col, value, owner, special) {
  const next = cloneBoard(state);
  next[side][col].push({ v: value, special: special, owner: owner });
  return next;
}

function applyKnock(state, foe, col, value) {
  const next = cloneBoard(state);
  next[foe][col] = next[foe][col].filter((d) => d.special || d.v !== value);
  return next;
}

function stateScore(state) {
  let margin = 0;
  let lines = 0;
  for (let i = 0; i < COLS; i++) {
    const diff = columnScore(state.npc[i]) - columnScore(state.me[i]);
    margin += Math.max(-15, Math.min(15, diff));
    if (diff > 0) lines += 1;
    else if (diff < 0) lines -= 1;
  }
  return margin + lines * 10;
}

// 사람의 응수까지 한 수 내다본다 (주사위 눈은 기대값)
function replyPenalty(state) {
  let total = 0;
  for (let v = 1; v <= 6; v++) {
    let best = 0;
    for (let c = 0; c < COLS; c++) {
      if (state.me[c].length < SLOTS) {
        best = Math.max(best, -stateScore(applyPlace(state, ME, c, v, ME, false)));
      }
      if (state.me[c].length < SLOTS && state.npc[c].some((d) => !d.special && d.v === v)) {
        best = Math.max(best, -stateScore(applyKnock(state, NPC, c, v)));
      }
    }
    total += best;
  }
  return total / 6;
}

// 특수 주사위를 놓을 자리 (상대 칸을 낮은 눈으로 막는 것이 이득)
function chooseSpecialMove(value) {
  let best = null;
  let bestScore = -Infinity;

  for (let c = 0; c < COLS; c++) {
    if (board.npc[c].length < SLOTS) {
      const s = stateScore(applyPlace(board, NPC, c, value, NPC, true));
      if (s > bestScore) { bestScore = s; best = { side: NPC, col: c }; }
    }
    if (board.me[c].length < SLOTS) {
      // 상대(사람) 칸을 막는다 — 숫자는 사람 점수가 되므로 낮을수록 좋다
      const s = stateScore(applyPlace(board, ME, c, value, NPC, true)) + (6 - value) * 1.5;
      if (s > bestScore) { bestScore = s; best = { side: ME, col: c }; }
    }
  }
  return best || { side: NPC, col: 0 };
}

function npcOptions(value) {
  const opts = [];
  for (let c = 0; c < COLS; c++) {
    if (board.npc[c].length < SLOTS) opts.push({ type: "place", col: c });
    // 자기 같은 번호 줄에 자리가 있어야 튕겨낼 수 있다
    if (knockTargets(ME, c, value).length && board.npc[c].length < SLOTS) {
      opts.push({ type: "knock", col: c });
    }
  }
  return opts;
}

function chooseNpcMove(value) {
  const style = LEVEL_STYLE[npcLevel()];
  const opts = npcOptions(value);
  if (!opts.length) return null;

  if (Math.random() < style.randomMove) return opts[randInt(0, opts.length - 1)];

  let best = null;
  let bestScore = -Infinity;

  for (const o of opts) {
    let after;
    let bonus = 0;

    if (o.type === "place") {
      after = applyPlace(board, NPC, o.col, value, NPC, false);
    } else {
      after = applyKnock(board, ME, o.col, value);
      // 튕겨내면 특수 주사위를 바로 한 번 더 쓴다 — 그만큼 값어치가 있다
      bonus = 6;
    }

    let score = stateScore(after) + bonus;
    if (style.reply) score -= replyPenalty(after) * style.reply;
    if (style.jitter) score += Math.random() * style.jitter;

    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

function npcWantsReroll(value) {
  if (wins < 8 || rerollUsed[NPC] || gameOver) return false;
  const move = chooseNpcMove(value);
  if (!move) return false;
  const after = move.type === "knock"
    ? applyKnock(board, ME, move.col, value)
    : applyPlace(board, NPC, move.col, value, NPC, false);
  return stateScore(after) < stateScore(board) - 2;
}

/* ---------- 판 종료 ---------- */

function finishRound(surrendered) {
  gameOver = true;
  busy = false;
  phase = "place";

  let myLines = 0, npcLines = 0;
  const detail = [];
  for (let i = 0; i < COLS; i++) {
    const m = columnScore(board.me[i]);
    const n = columnScore(board.npc[i]);
    if (m > n) { myLines++; detail.push((i + 1) + "줄 승 (" + m + ":" + n + ")"); }
    else if (m < n) { npcLines++; detail.push((i + 1) + "줄 패 (" + m + ":" + n + ")"); }
    else detail.push((i + 1) + "줄 무 (" + m + ":" + n + ")");
  }

  render();
  if (!surrendered) log("결과 — " + detail.join(" · "), "hi");

  const streakBefore = streak;   // 이번 판 전까지 이어오던 연승

  let outcome;
  if (surrendered) {
    losses++;
    streak = 0;
    outcome = "lose";
    setStatus("포기했습니다. 이 판은 패배로 기록됩니다.", "lose");
    log("포기 — 패배로 기록되었습니다.", "bad");
  } else if (myLines >= 2) {
    wins++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    outcome = "win";
    setStatus(round + "판 승리! " + myLines + "줄을 가져왔습니다." +
              (streak >= 2 ? "  🔥 " + streak + "연승 중!" : ""), "win");
    log("승리! 다음 상대가 기다립니다.", "good");
  } else if (npcLines >= 2) {
    losses++;
    streak = 0;
    outcome = "lose";
    setStatus(round + "판 패배. " + npcName_ + "이(가) " + npcLines + "줄을 가져갔습니다.", "lose");
    log("패배. 같은 상대와 다시 겨룹니다.", "bad");
  } else {
    outcome = "draw";
    streak = 0;
    setStatus("무승부입니다. 2줄을 가져간 쪽이 없습니다.", "draw");
    log("무승부 — 같은 상대와 다시 겨룹니다.");
  }

  renderStreak();
  saveResume(false);   // 판이 끝났다. 여기서 닫으면 그대로 이어할 수 있다

  /* 이름을 묻는 순간 — 연승이 끊길 때다.

     이 게임은 세션이 계속 이어져서 "끝" 이 없지만, 연승만은 지는 순간
     확정된다. 그래서 그때가 오락실 기계로 치면 하이스코어가 굳는 자리다.

     세 가지가 다 맞아야 묻는다.
       1) 이번 판에 연승이 끊겼다 (이겼으면 아직 진행 중이라 묻지 않는다)
       2) 끊긴 그 연승이 이번 세션의 최고 기록이었다 (5 연승 뒤의 2 연승은 아니다)
       3) 그 기록으로 아직 안 물어봤다 (같은 값으로 두 번 묻지 않는다)
     그러고도 랭킹 10 위 밖이면 GameHighScore 가 알아서 조용히 넘어간다. */
  const streakEnded = outcome !== "win" && streakBefore > 0;
  const newRecord = streakEnded && streakBefore === bestStreak && bestStreak > offeredStreak;
  if (newRecord) offeredStreak = bestStreak;

  saveSession({ askName: newRecord });

  roundActionsEl.innerHTML = "";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn primary";
  next.textContent = outcome === "win" ? "다음 판으로" : "새 상대 만나기";
  next.addEventListener("click", () => {
    if (outcome === "win") round++;   // 이겨야 다음 판(난이도)으로 넘어간다
    showMatching();                   // 승패와 관계없이 새 상대를 매칭한다
  });
  roundActionsEl.appendChild(next);

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn ghost";
  reset.textContent = "처음부터";
  reset.addEventListener("click", () => {
    newSession();
    clearResume();      // 하던 판을 정말 버리는 자리
    showMatching();
  });
  roundActionsEl.appendChild(reset);
}


/* ---------- 기록 ---------- */

// 세션을 새로 연다. 다음 판이 끝날 때 새 기록으로 남는다.
function newSession() {
  round = 1;
  wins = 0;
  losses = 0;
  streak = 0;
  bestStreak = 0;
  offeredStreak = 0;
  usedNames = new Set();
  sessionId = null;
  sessionStartedAt = Date.now();
  // 저장본은 여기서 지우지 않는다. 페이지를 열 때도 이 함수가 도는데,
  // 사용자가 "이어서 할지" 답하기 전에 지워 버리면 그 사이에 창을 닫았을 때
  // 하던 판이 영영 사라진다. 버리는 건 정말 버리기로 한 자리에서만 한다.
}

/* ---------- 하던 판 이어하기 ----------

   기록(랭킹에 오르는 점수)이 아니라 "하던 판" 이라서 브라우저에만 둔다.
   어드벤처의 이어하기(lostforest.save)와 같은 성격이다.

   inRound 가 이어하기의 핵심이다. 판을 시작할 때 켜고 끝낼 때 끄므로,
   다시 열었을 때 이 값이 켜져 있으면 "두던 도중에 창을 닫았다" 는 뜻이다.
   그 판은 패배로 친다 — 안 그러면 질 것 같을 때 창을 닫아 연승을 지킬 수
   있고, 그러면 연승으로 순위를 매기는 의미가 사라진다. 게임에 이미 있는
   "포기 = 패배" 와 같은 처리다. */

const RESUME_KEY = "tikatuka.session";

function storage(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

function saveResume(inRound) {
  storage(function () {
    localStorage.setItem(RESUME_KEY, JSON.stringify({
      v: 1,
      round: round,
      wins: wins,
      losses: losses,
      streak: streak,
      bestStreak: bestStreak,
      offeredStreak: offeredStreak,
      sessionId: sessionId,
      sessionStartedAt: sessionStartedAt,
      usedNames: [].slice.call(usedNames),
      inRound: !!inRound,
    }));
  });
}

function loadResume() {
  const d = storage(function () {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
  }, null);
  if (!d || d.v !== 1 || typeof d.round !== "number") return null;
  return d;
}

function clearResume() {
  storage(function () { localStorage.removeItem(RESUME_KEY); });
}

// 저장해 둔 판을 지금 세션으로 되살린다. 돌려주는 값은 "그 판이 패배로 처리됐나".
function applyResume(d) {
  round = d.round;
  wins = d.wins;
  losses = d.losses;
  streak = d.streak;
  bestStreak = d.bestStreak;
  offeredStreak = d.offeredStreak || 0;
  sessionId = d.sessionId || null;
  sessionStartedAt = d.sessionStartedAt || Date.now();
  usedNames = new Set(d.usedNames || []);

  if (!d.inRound) return false;

  // 두던 도중에 닫았다 — 포기와 같게 본다
  losses++;
  streak = 0;
  saveResume(false);
  saveSession();     // 서버 기록도 이 패배를 반영해 둔다
  return true;
}

/* 지금까지의 세션을 저장한다. 대표 점수는 이 세션에서의 최고 연승이다.

   도달한 판 수로 매기지 않는 이유가 있다. 이 게임은 져도 잃는 게 없다 —
   판 수는 이겼을 때만 오르고 졌다고 내려가지 않으므로(finishRound 참고),
   결국 "누적 승수" 가 된다. 그러면 5 승 0 패와 5 승 5 패가 같은 점수가 되어,
   시간만 쓰면 누구나 올릴 수 있는 값이 순위를 정하게 된다.

   연승은 그렇게 안 된다. 판이 오를수록 상대가 강해지므로(LEVELS),
   8 연승을 하려면 느긋함부터 명인까지 한 번도 안 지고 이겨야 한다.

   대신 "얼마나 깊이 갔나" 가 점수에서 빠지므로, 그건 랭킹 줄 오른쪽에
   판 수로 적어 함께 보여 준다.

   한 판도 못 이겼으면 점수를 null 로 둔다. 0 연승은 겨룰 기록이 아니라서
   순위표에 "0 연승" 줄이 쌓이면 보기만 나쁘다. 다른 게임에서 진 판을
   랭킹에서 빼는 것과 같은 처리다 (거기서는 outcome 으로 걸렀지만 이
   게임은 세션이 승패로 끝나지 않아 outcome 이 비어 있다). */
function saveSession(opts) {
  GameScore.submit("tikatuka", {
    id: sessionId,               // 없으면 새로 만들어지고, 있으면 덮어쓴다
    outcome: "",                 // 세션은 승패로 끝나지 않는다
    score: bestStreak > 0 ? bestStreak : null,
    detail: {
      round: round,
      bestStreak: bestStreak,
      wins: wins,
      losses: losses,
      level: LEVEL_NAMES[npcLevel()],
      seconds: GameScore.since(sessionStartedAt),
    },
  })
    .then((saved) => {
      sessionId = saved.id;
      if (!opts || !opts.askName) return null;
      // 화면의 랭킹과 같은 조건(필터 없음)으로 순위를 본다
      return GameHighScore.offer("tikatuka", saved, { what: saved.score + "연승" });
    })
    .then(showRecord);
}

function showRecord() {
  if (!recordEl) return;
  Promise.all([
    GameScore.summary("tikatuka"),
    GameScore.best("tikatuka"),
  ]).then(([sum, top]) => {
    if (sum.plays === 0) {
      recordEl.textContent = "";
      return;
    }
    let text = "지금까지 " + sum.plays + "번 도전";
    if (top) {
      text += "  ·  최고 " + top.score + "연승 (" +
              top.detail.round + "판 도달 · " + top.detail.level + ")";
    }
    recordEl.textContent = text;
  });

  // 난이도가 따로 없는 게임이라 전체를 한 줄로 세운다.
  GameRank.paint(rankEl, "tikatuka", {
    title: "연승 랭킹",
    note: (r) => r.detail.round + "판 도달",
  });
}

GameReset.attach(resetSlot, { game: "tikatuka", onDone: showRecord });

/* ---------- 상대 매칭 (룰렛) ---------- */

function reelItem(name, cls) {
  return '<div class="tk-reel-item' + (cls ? " " + cls : "") + '">' + name + "</div>";
}

async function showMatching() {
  matchPanel.hidden = false;
  gamePanel.hidden = true;
  vsBox.hidden = true;
  vsLevel.hidden = true;
  matchStart.hidden = true;
  matchTitle.textContent = "상대를 찾는 중…";

  npcName_ = pickName();

  // 지나가는 이름들 + 마지막에 실제 상대
  const strip = [];
  for (let i = 0; i < 26; i++) {
    strip.push(NAME_POOL[randInt(0, NAME_POOL.length - 1)]);
  }
  strip.push(npcName_);
  reelInner.innerHTML = strip.map((n, i) => reelItem(n, i === strip.length - 1 ? "hit" : "")).join("");

  const item = reelInner.firstElementChild;
  const h = item ? item.getBoundingClientRect().height : 52;
  const distance = (strip.length - 1) * h;

  reelInner.style.transform = "translateY(0px)";
  await playOnce(reelInner, [
    { transform: "translateY(0px)" },
    { transform: "translateY(-" + distance + "px)" },
  ], { duration: 2100, easing: "cubic-bezier(.12,.75,.14,1)", fill: "forwards" });
  reelInner.style.transform = "translateY(-" + distance + "px)";

  matchTitle.textContent = "상대를 만났습니다";
  vsNpc.textContent = npcName_;
  vsLevel.textContent = "난이도 · " + LEVEL_NAMES[npcLevel()] + "   (" + round + "판째)";
  vsBox.hidden = false;
  vsLevel.hidden = false;
  vsBox.classList.remove("pop");
  void vsBox.offsetWidth;
  vsBox.classList.add("pop");

  await wait(420);
  matchStart.hidden = false;
}

matchStart.addEventListener("click", () => {
  matchPanel.hidden = true;
  gamePanel.hidden = false;
  startRound(true);
});

/* ---------- 규칙 모달 ---------- */

document.getElementById("rules-open").addEventListener("click", () => {
  document.getElementById("rules").hidden = false;
});
document.getElementById("rules-close").addEventListener("click", () => {
  document.getElementById("rules").hidden = true;
});
document.getElementById("rules").addEventListener("click", (e) => {
  if (e.target.id === "rules") e.target.hidden = true;
});

/* ---------- 시작 ---------- */

// 허브에서 정한 닉네임. 아직 없으면 기본값.
function you() {
  return (window.GameNick && GameNick.name()) || "플레이어";
}

/* 하던 판이 있으면 이어할지 묻는다. 없으면 지금까지처럼 바로 시작한다. */
function askResume(saved, onDone) {
  const wrap = document.createElement("div");
  wrap.className = "nick-overlay";
  wrap.innerHTML =
    '<div class="nick-box">' +
      '<h2 class="nick-title">하던 판이 있습니다</h2>' +
      '<p class="hint tk-resume-info"></p>' +
      '<p class="nick-error tk-resume-warn" hidden></p>' +
      '<div class="row nick-actions"></div>' +
    "</div>";

  wrap.querySelector(".tk-resume-info").textContent =
    saved.round + "판 · " + saved.wins + "승 " + saved.losses + "패 · 최고 " +
    saved.bestStreak + "연승";

  if (saved.inRound) {
    const warn = wrap.querySelector(".tk-resume-warn");
    warn.hidden = false;
    warn.textContent = "두던 도중에 나가서, 그 판은 패배로 기록됩니다.";
  }

  const actions = wrap.querySelector(".nick-actions");

  const go = document.createElement("button");
  go.type = "button";
  go.className = "btn primary";
  go.textContent = "이어서 하기";
  go.addEventListener("click", function () {
    applyResume(saved);
    wrap.remove();
    onDone();
  });
  actions.appendChild(go);

  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "btn ghost";
  fresh.textContent = "처음부터";
  fresh.addEventListener("click", function () {
    newSession();
    clearResume();      // 하던 판을 정말 버리는 자리
    wrap.remove();
    onDone();
  });
  actions.appendChild(fresh);

  document.body.appendChild(wrap);
  go.focus();
}

const saved = loadResume();   // newSession() 이 지우기 전에 읽어 둔다
newSession();
awaitingRoll = false;
GameNick.require(function () {
  showRecord();
  myNameEl.textContent = you();
  vsMeEl.textContent = you();
  trayMeLabel.textContent = you() + "의 굴림판";

  /* newSession() 이 이미 돌아 저장본을 지웠으므로, 그 전에 읽어 둔 것을 쓴다.
     1판에 아무 것도 안 한 상태라면 이어할 게 없으니 묻지 않는다. */
  if (saved && (saved.round > 1 || saved.wins > 0 || saved.losses > 0 || saved.inRound)) {
    askResume(saved, function () { showRecord(); showMatching(); });
  } else {
    showMatching();
  }
});
