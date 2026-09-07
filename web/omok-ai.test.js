/* ============================================================
   오목 [어려움] AI 검증 — 브라우저와 무관, Node 로만 돈다.
     실행:  node web/omok-ai.test.js
   omok.html 은 이 파일을 불러오지 않으므로 게임에는 영향이 없다.

   보는 것:
     1) 평가 함수가 모양의 급을 제대로 매기는지
     2) 이기는 수 / 막는 수를 놓치지 않는지
     3) 난이도용 "실수"가 강제수까지 흔들지는 않는지
     4) 조각내어 돌려도(화면 안 멈춤) 같은 수를 두는지
     5) 어떤 국면에서도 둘 수 있는 자리를 내는지, 시간 예산을 지키는지
     6) 어려움이 보통보다 실제로 강한지 (실수를 끈 상태에서)
     7) 페이지(omok.js)에 제대로 물려 있는지
   ============================================================ */

const path = require("path");
const ENGINE = path.join(__dirname, "omok-ai.js");
const PAGE = path.join(__dirname, "omok.js");

const E = require(ENGINE);

const SIZE = 15;
const EMPTY = 0, HUMAN = 1, AI = 2;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

const idx = (r, c) => r * SIZE + c;
const rc = (i) => [(i / SIZE) | 0, i % SIZE];
const inB = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const blank = () => new Array(SIZE * SIZE).fill(EMPTY);
const put = (b, p, ...cells) => (cells.forEach(([r, c]) => (b[idx(r, c)] = p)), b);

// 판마다 결과가 흔들리지 않게, 대국 시뮬레이션은 고정 난수를 쓴다
let seed = 987654321;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  → " + extra : "")); }
}

function findWin(b, index, p) {
  const [r, c] = rc(index);
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    for (let k = 1; k < 5; k++) { const nr = r + dr * k, nc = c + dc * k; if (!inB(nr, nc) || b[idx(nr, nc)] !== p) break; cnt++; }
    for (let k = 1; k < 5; k++) { const nr = r - dr * k, nc = c - dc * k; if (!inB(nr, nc) || b[idx(nr, nc)] !== p) break; cnt++; }
    if (cnt >= 5) return true;
  }
  return false;
}

/* ============================================================
   [보통] 난이도 로직 — omok.js 의 chooseAiMoveNormal 과 같은 방식.
   비교 상대로 쓰려고 옮겨 둔 것이라, 저쪽을 고치면 여기도 맞춰야 한다.
   ============================================================ */
const WEIGHT = [0, 1, 12, 150, 2000, 100000];

function normalCandidates(b) {
  const set = new Set();
  for (let i = 0; i < b.length; i++) {
    if (b[i] === EMPTY) continue;
    const [r, c] = rc(i);
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr, nc = c + dc;
      if (inB(nr, nc) && b[idx(nr, nc)] === EMPTY) set.add(idx(nr, nc));
    }
  }
  return [...set];
}

function normalEvalPoint(b, index, p) {
  const [r, c] = rc(index);
  const o = p === AI ? HUMAN : AI;
  const prev = b[index];
  b[index] = p;
  let score = 0;
  for (const [dr, dc] of DIRS) for (let off = -4; off <= 0; off++) {
    let count = 0, valid = true;
    for (let k = 0; k < 5; k++) {
      const nr = r + dr * (off + k), nc = c + dc * (off + k);
      if (!inB(nr, nc)) { valid = false; break; }
      const v = b[idx(nr, nc)];
      if (v === o) { valid = false; break; }
      if (v === p) count++;
    }
    if (valid) score += WEIGHT[count];
  }
  b[index] = prev;
  return score;
}

function normalMove(b, me) {
  const opp = me === AI ? HUMAN : AI;
  if (b.every((v) => v === EMPTY)) return idx(7, 7);
  const list = normalCandidates(b);
  for (const i of list) { b[i] = me; const w = findWin(b, i, me); b[i] = EMPTY; if (w) return i; }
  const blocks = [];
  for (const i of list) { b[i] = opp; const w = findWin(b, i, opp); b[i] = EMPTY; if (w) blocks.push(i); }
  if (blocks.length) {
    return blocks.reduce((a, i) => (normalEvalPoint(b, i, me) > normalEvalPoint(b, a, me) ? i : a));
  }
  let best = list[0], bs = -Infinity;
  for (const i of list) {
    const [r, c] = rc(i);
    const center = (7 - Math.abs(r - 7)) + (7 - Math.abs(c - 7));
    let s = normalEvalPoint(b, i, me) + normalEvalPoint(b, i, opp) * 0.9 + center * 2;
    s *= 0.94 + rnd() * 0.12;
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}

/* ============================================================
   1. 평가 함수 — 모양의 급
   ============================================================ */
console.log("\n[1] 패턴 점수 서열");
{
  const S = E.SCORE;
  const sc = (b) => E.patternScore(b, AI);

  const openThree = put(blank(), AI, [7, 6], [7, 7], [7, 8]);
  const closedThree = put(blank(), AI, [7, 0], [7, 1], [7, 2]);          // 왼쪽이 벽
  const openFour = put(blank(), AI, [7, 5], [7, 6], [7, 7], [7, 8]);
  const closedFour = put(put(blank(), AI, [7, 5], [7, 6], [7, 7], [7, 8]), HUMAN, [7, 4]);
  const brokenFour = put(blank(), AI, [7, 5], [7, 6], [7, 8], [7, 9]);   // OO_OO
  const five = put(blank(), AI, [7, 5], [7, 6], [7, 7], [7, 8], [7, 9]);

  console.log("    열린3=%d 닫힌3=%d 열린4=%d 닫힌4=%d 띈4=%d 5목=%d",
    sc(openThree), sc(closedThree), sc(openFour), sc(closedFour), sc(brokenFour), sc(five));

  // 가로 3목이어도 각 돌이 세로/대각선에서 "단독 돌(ONE)"로 조금씩 더해진다.
  // 그래서 정확히 같은 값이 아니라 그 패턴이 지배적인지를 본다.
  const near = (v, base) => v >= base && v < base * 1.5;

  check("열린3 ≈ OPEN_THREE", near(sc(openThree), S.OPEN_THREE), sc(openThree));
  check("닫힌3 < 열린3", sc(closedThree) < sc(openThree));
  check("닫힌4 < 열린4", sc(closedFour) < sc(openFour));
  check("닫힌4 > 열린3", sc(closedFour) > sc(openThree));
  check("띈4(OO_OO) ≈ FOUR", near(sc(brokenFour), S.FOUR), sc(brokenFour));
  check("5목 > 열린4", sc(five) > sc(openFour));
  check("빈 판 = 0", sc(blank()) === 0);
}

/* ============================================================
   2. 결정적인 수 — 이기는 자리와 막는 자리
   ============================================================ */
console.log("\n[2] 결정적인 수");
{
  // 여기서는 "엔진이 볼 수 있는가"를 보므로 난이도용 실수는 끈다
  const EXACT = { slipRate: 0 };
  let b = put(blank(), AI, [7, 3], [7, 4], [7, 5], [7, 6]);
  put(b, HUMAN, [9, 3], [9, 4]);
  let mv = E.chooseMove(b, AI, HUMAN, EXACT);
  check("내 4 → 5목 완성", mv === idx(7, 2) || mv === idx(7, 7), rc(mv));

  b = put(blank(), HUMAN, [7, 3], [7, 4], [7, 5], [7, 6]);
  put(b, AI, [10, 3], [10, 4]);
  mv = E.chooseMove(b, AI, HUMAN, EXACT);
  check("상대 4 → 막는다", mv === idx(7, 2) || mv === idx(7, 7), rc(mv));

  b = put(blank(), HUMAN, [7, 5], [7, 6], [7, 7]);
  put(b, AI, [9, 9]);
  mv = E.chooseMove(b, AI, HUMAN, EXACT);
  check("상대 열린3 → 대응",
    [idx(7, 3), idx(7, 4), idx(7, 8), idx(7, 9)].includes(mv), rc(mv));

  b = put(blank(), AI, [3, 3], [3, 4], [3, 5], [3, 6]);
  put(b, HUMAN, [7, 3], [7, 4], [7, 5], [7, 6]);
  mv = E.chooseMove(b, AI, HUMAN, EXACT);
  check("막기보다 이기기 우선", mv === idx(3, 2) || mv === idx(3, 7), rc(mv));

  check("빈 판 → 한가운데", E.chooseMove(blank(), AI, HUMAN, EXACT) === idx(7, 7));
}

/* ============================================================
   3. 난이도 조절용 실수(slipRate)
   ============================================================ */
console.log("\n[3] 실수(slipRate) — 흔들리되 강제수는 지킨다");
{
  const ALWAYS = { slipRate: 1 };   // 실수를 최대로 켜고 최악을 본다

  // 5목이 눈앞이면 실수하지 않는다
  let b = put(blank(), AI, [7, 3], [7, 4], [7, 5], [7, 6]);
  put(b, HUMAN, [9, 3], [9, 4], [10, 6]);
  let miss = 0;
  for (let i = 0; i < 20; i++) {
    const mv = E.chooseMove(b, AI, HUMAN, ALWAYS);
    if (mv !== idx(7, 2) && mv !== idx(7, 7)) miss++;
  }
  check("실수를 켜도 이기는 수는 놓치지 않는다", miss === 0, miss + "/20");

  // 상대가 다음 수에 이기면 반드시 막는다
  b = put(blank(), HUMAN, [7, 3], [7, 4], [7, 5], [7, 6]);
  put(b, AI, [10, 3], [10, 4]);
  miss = 0;
  for (let i = 0; i < 20; i++) {
    const mv = E.chooseMove(b, AI, HUMAN, ALWAYS);
    if (mv !== idx(7, 2) && mv !== idx(7, 7)) miss++;
  }
  check("실수를 켜도 지는 자리는 반드시 막는다", miss === 0, miss + "/20");

  // 평범한 국면 — 실수해도 "싸우는 곳" 근처를 벗어나면 안 된다
  b = put(blank(), AI, [7, 7], [8, 8]);
  put(b, HUMAN, [7, 8], [6, 6]);
  const exact = E.chooseMove(b, AI, HUMAN, { slipRate: 0, shuffleTies: false });
  const [er, ec] = rc(exact);
  const R = E.DEFAULTS.slipRadius;

  const job = E.createJob(b, AI, HUMAN, { slipRate: 1, shuffleTies: false });
  job.run();
  check("실수를 켜면 최선이 아닌 자리에 둔다", job.slipped && job.best !== exact,
    job.slipped ? "같은 자리" : "실수가 걸리지 않음");

  const clean = E.createJob(b, AI, HUMAN, { slipRate: 0, shuffleTies: false });
  clean.run();
  check("실수를 끄면 최선 그대로", clean.slipped === false && clean.best === exact);

  let bad = 0, far = 0;
  for (let i = 0; i < 30; i++) {
    const mv = E.chooseMove(b, AI, HUMAN, ALWAYS);
    if (!(mv >= 0 && mv < 225 && b[mv] === EMPTY)) bad++;
    const [r, c] = rc(mv);
    if (Math.abs(r - er) > R || Math.abs(c - ec) > R) far++;
  }
  check("실수해도 최선에서 " + R + "칸 안", far === 0, far + "/30건이 멀리 벗어남");
  check("실수한 수도 항상 빈칸", bad === 0, bad + "건");
  console.log("    기본값: 실수 확률 " + (E.DEFAULTS.slipRate * 100) +
    "%, 실수 반경 " + R + "칸");
}

/* ============================================================
   4. 조각 실행 — 화면을 멈추지 않으면서 같은 수를 두는가
   ============================================================ */
console.log("\n[4] 조각 실행 (omok.js 가 60ms 씩 끊어 돌린다)");
{
  const SLICE = 60;
  const positions = [
    ["초반", [[AI, 7, 7], [HUMAN, 7, 8], [AI, 8, 8], [HUMAN, 6, 6]]],
    ["중반", [[AI, 7, 7], [HUMAN, 7, 8], [AI, 8, 8], [HUMAN, 6, 6], [AI, 8, 6],
              [HUMAN, 8, 7], [AI, 9, 7], [HUMAN, 6, 8], [AI, 9, 9], [HUMAN, 5, 9]]],
  ];

  let worstSlice = 0, mismatch = 0;

  for (const [name, moves] of positions) {
    const b = blank();
    moves.forEach(([p, r, c]) => (b[idx(r, c)] = p));

    // 순서 섞기를 끄면 같은 판에서는 같은 수가 나와야 한다
    const opt = { shuffleTies: false, slipRate: 0 };
    const sync = E.createJob(b, AI, HUMAN, opt);
    sync.run();

    const job = E.createJob(b, AI, HUMAN, opt);
    const slices = [];
    for (;;) {
      const t = Date.now();
      const done = job.step(SLICE);
      slices.push(Date.now() - t);
      if (done) break;
    }

    const worst = Math.max(...slices);
    worstSlice = Math.max(worstSlice, worst);
    if (job.best !== sync.best) mismatch++;
    console.log("    %s: 조각 %d개 (가장 긴 %dms) → %j / 한 번에 → %j",
      name, slices.length, worst, rc(job.best), rc(sync.best));
  }

  check("쪼개도 같은 수를 둔다", mismatch === 0, mismatch + "건 다름");
  check("한 조각이 200ms 이내 (= 체감 멈춤 없음)", worstSlice <= 200, worstSlice + "ms");
}

/* ============================================================
   5. 안정성 — 아무 국면에서나 둘 수 있는 자리를 내는가
   ============================================================ */
console.log("\n[5] 안정성 — 무작위 국면 100개");
{
  let bad = 0, over = 0, worst = 0;

  for (let t = 0; t < 100; t++) {
    const b = blank();
    const stones = Math.floor(rnd() * 60);
    for (let k = 0; k < stones; k++) {
      const i = Math.floor(rnd() * 225);
      if (b[i] === EMPTY) b[i] = k % 2 ? HUMAN : AI;
    }
    const t0 = Date.now();
    const mv = E.chooseMove(b, AI, HUMAN);
    const ms = Date.now() - t0;
    worst = Math.max(worst, ms);
    if (ms > E.DEFAULTS.timeBudget * 1.2) over++;
    if (!(mv >= 0 && mv < 225 && b[mv] === EMPTY)) bad++;
  }

  check("항상 빈칸을 고른다", bad === 0, bad + "건");
  check("시간 예산을 지킨다", over === 0, over + "건");
  console.log("    한 수 최장 " + worst + "ms (예산 " + E.DEFAULTS.timeBudget + "ms)");

  const almostFull = blank();
  for (let i = 0; i < 225; i++) almostFull[i] = i % 2 ? HUMAN : AI;
  almostFull[200] = EMPTY;
  check("빈칸이 하나뿐이어도 찾는다", E.chooseMove(almostFull, AI, HUMAN) === 200);
}

/* ============================================================
   6. 균형 — 어려움이 보통보다 강한가
   ============================================================ */
console.log("\n[6] 어려움 vs 보통 (선공/후공 각 4판, 실수 끔)");
{
  function play(hardFirst) {
    const b = blank();
    let turn = hardFirst ? AI : HUMAN;
    let slowest = 0;

    for (let m = 0; m < 225; m++) {
      let mv;
      if (turn === AI) {
        const t = Date.now();
        mv = E.chooseMove(b, AI, HUMAN, { slipRate: 0 });
        slowest = Math.max(slowest, Date.now() - t);
      } else {
        mv = normalMove(b, HUMAN);
      }
      if (mv < 0 || b[mv] !== EMPTY) return { winner: 0, invalid: true, slowest };
      b[mv] = turn;
      if (findWin(b, mv, turn)) return { winner: turn, slowest };
      turn = turn === AI ? HUMAN : AI;
    }
    return { winner: 0, slowest };   // 판이 다 참 = 무승부
  }

  let win = 0, lose = 0, draw = 0, invalid = 0, slowest = 0;
  for (const first of [true, false]) {
    for (let g = 0; g < 4; g++) {
      const r = play(first);
      if (r.winner === AI) win++; else if (r.winner === HUMAN) lose++; else draw++;
      if (r.invalid) invalid++;
      slowest = Math.max(slowest, r.slowest);
      process.stdout.write(r.winner === AI ? "어" : r.winner === HUMAN ? "보" : ".");
    }
  }

  console.log("\n    어려움 %d승 / 보통 %d승 / 무 %d   (한 수 최장 %dms)", win, lose, draw, slowest);
  check("어려움이 보통보다 강하다", win > lose, win + ":" + lose);
  check("대국 중 잘못된 착수 없음", invalid === 0, invalid + "건");
}

/* ============================================================
   7. 페이지 배선 — omok.js 를 가짜 DOM 위에 올려서 눌러본다
   ============================================================ */
console.log("\n[7] 페이지 배선 (omok.js)");

class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.classSet = new Set();
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    this._text = "";
    this.parentNode = null;
    this.classList = {
      add: (...c) => c.forEach((x) => this.classSet.add(x)),
      remove: (...c) => c.forEach((x) => this.classSet.delete(x)),
      toggle: (c, on) => (on ? this.classSet.add(c) : this.classSet.delete(c)),
      contains: (c) => this.classSet.has(c),
    };
  }
  get className() { return [...this.classSet].join(" "); }
  set className(v) { this.classSet = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get firstChild() { return this.children[0]; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return ""; }
  set innerHTML(v) { if (v === "") this.children = []; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(t, ev) { (this.listeners[t] || []).forEach((fn) => fn(ev)); }
  querySelectorAll(sel) {
    const cls = sel.replace(".", "");
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.classSet.has(cls)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  closest(sel) {
    const cls = sel.replace(".", "");
    let n = this;
    while (n) { if (n.classSet && n.classSet.has(cls)) return n; n = n.parentNode; }
    return null;
  }
}

const nodes = {};
["board", "status", "reset", "p-human", "p-ai", "dot-human", "dot-ai",
 "name-human", "name-ai", "difficulty",
 "start-gate", "start-choices"].forEach((id) => (nodes[id] = new El("div")));

global.window = global;
global.document = {
  getElementById: (id) => nodes[id] || null,
  createElement: (tag) => new El(tag),
};
global.GameNick = { require: (cb) => cb(), name: () => "테스터" };

require(PAGE);   // omok.html 의 로드 순서대로 (omok-ai.js 는 맨 위에서 이미 로드됨)

const boardEl = nodes.board;
const statusEl = nodes.status;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cells = () => boardEl.children;
const filled = () => cells().filter((c) => c.classSet.has("filled")).length;
const isOver = () => ["win", "lose", "draw"].some((c) => statusEl.classSet.has(c));

async function waitIdle(limitMs = 8000) {
  const t = Date.now();
  while (Date.now() - t < limitMs) {
    if (isOver() || !boardEl.classList.contains("locked")) return true;
    await sleep(15);
  }
  return false;
}

// 가운데에서 가까운 빈칸부터 (사람 역할)
function humanPick() {
  const order = cells()
    .map((c, i) => [i, Math.abs(((i / 15) | 0) - 7) + Math.abs((i % 15) - 7)])
    .sort((a, b) => a[1] - b[1]);
  for (const [i] of order) if (!cells()[i].classSet.has("filled")) return cells()[i];
  return null;
}

(async function page() {
  const btns = nodes.difficulty.querySelectorAll(".seg-btn");
  check("난이도 버튼 2개", btns.length === 2, btns.length);
  check("보통 / 어려움", btns.map((b) => b.textContent).join("/") === "보통/어려움",
    btns.map((b) => b.textContent).join("/"));
  check("기본값은 보통", btns[0].getAttribute("aria-pressed") === "true");

  btns[1].fire("click");
  check("어려움으로 전환된다",
    btns[1].getAttribute("aria-pressed") === "true" &&
    btns[0].getAttribute("aria-pressed") === "false");
  btns[0].fire("click");   // 다시 보통으로 되돌려 놓고 시작 카드를 본다

  // 들어오자마자 판이 굴러가면 안 된다
  check("시작 카드가 떠 있다", nodes["start-gate"].hidden === false);
  check("판이 잠겨 있다", boardEl.classList.contains("locked"));
  check("돌이 하나도 없다", filled() === 0, filled());

  boardEl.fire("click", { target: cells()[7 * 15 + 7] });
  check("시작 전에는 눌러도 놓이지 않는다", filled() === 0, filled());

  nodes.reset.fire("click");
  check("시작 전에는 다시 하기가 판을 시작하지 않는다", filled() === 0, filled());

  // 시작 카드에서 고급을 고르면 그때 시작된다
  const gateBtns = nodes["start-choices"].querySelectorAll(".btn");
  check("시작 카드에 난이도 2개", gateBtns.length === 2, gateBtns.length);

  gateBtns[1].fire("click");
  check("시작 카드가 닫힌다", nodes["start-gate"].hidden === true);
  check("고른 난이도가 상단에도 반영된다",
    btns[1].getAttribute("aria-pressed") === "true");
  await waitIdle();

  let slowest = 0, guard = 0;
  while (!isOver() && guard++ < 120) {
    const cell = humanPick();
    if (!cell) break;
    const before = filled();
    boardEl.fire("click", { target: cell });
    if (filled() === before || isOver()) break;

    const t = Date.now();
    if (!(await waitIdle())) { check("컴퓨터가 시간 안에 응수", false, "8초 초과"); break; }
    slowest = Math.max(slowest, Date.now() - t);
  }

  check("한 판이 정상적으로 끝난다", isOver(), statusEl.textContent);
  check("컴퓨터 응수 2초 이내", slowest <= 2000, slowest + "ms");
  console.log("    " + statusEl.textContent + " (" + filled() + "수, 최장 응수 " + slowest + "ms)");

  // 생각하는 중에 다시 하기 — 남은 계산이 새 판에 끼어들면 안 된다
  nodes.reset.fire("click");
  await waitIdle();
  boardEl.fire("click", { target: humanPick() });
  await sleep(30);
  nodes.reset.fire("click");
  await sleep(1500);
  check("생각 중 다시 하기 → 새 판이 오염되지 않는다", filled() <= 2, filled() + "개");

  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
