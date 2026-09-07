/* ============================================================
   오목 [어려움] AI — 미니맥스 + 알파베타 가지치기
   omok.js 가 window.OmokHardAI 로 가져다 쓴다.
   보드는 omok.js 와 같은 형식(길이 225, 0=빈칸 / 1=사람 / 2=컴퓨터)이며,
   "누가 나인지"를 인자로 받으므로 돌 색 추첨과는 무관하게 동작한다.
   ============================================================ */

(function (global) {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0;
  const BLOCK = -1; // 판 밖 (막힌 것으로 취급)

  // 가로 / 세로 / 대각선(↘) / 대각선(↗)
  const DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  /* ---------- 패턴 점수표 ----------
     한 수만 더 두면 무엇이 되는지를 기준으로 자릿수를 벌려 놓았다.
     급이 다르면(열린 4 vs 열린 3) 개수로는 절대 뒤집히지 않게 한다. */
  const P = {
    FIVE: 10000000,       // 오목 완성
    OPEN_FOUR: 1000000,   // 열린 4 (_OOOO_) — 막을 수 없다
    FOUR: 100000,         // 닫힌 4 (XOOOO_) / 띈 4 (OO_OO) — 한 수면 5목
    OPEN_THREE: 10000,    // 열린 3 (_OOO_, _O_OO_) — 놔두면 열린 4
    THREE: 1000,          // 닫힌 3
    OPEN_TWO: 100,        // 열린 2
    TWO: 10,              // 닫힌 2
    ONE: 1,
  };

  const WIN = 100000000;  // 탐색 중 확정 승/패 (평가 점수보다 항상 크다)
  const DEFENSE = 1.1;    // 상대 모양을 조금 더 무겁게 본다 (수비 성향)

  const DEFAULTS = {
    maxDepth: 6,      // 반복 심화 최대 깊이 (2 → 4 → 6)
    timeBudget: 1000, // 한 수에 쓸 수 있는 시간(ms)
    rootWidth: 12,    // 첫 수 후보 개수
    branchWidth: 8,   // 그 아래 가지의 후보 개수
    radius: 2,        // 놓인 돌 주변 몇 칸까지 후보로 볼지
    shuffleTies: true, // 첫 수 후보 중 점수가 같은 것끼리 순서를 섞을지
    slipRate: 0.25,   // 이 확률로 최선이 아닌 수를 둔다 (난이도 조절, 0이면 항상 최선)
    slipRadius: 2,    // 실수해도 최선에서 이 칸 안에만 둔다 (딴 동네에 두면 티가 난다)
  };

  /* ---------- 공용 ---------- */

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  const lineBuf = new Int8Array(SIZE); // 한 줄 담아두는 버퍼 (재사용)
  const segBuf = new Int8Array(9);     // 한 점 주변 9칸 버퍼 (재사용)

  /* ---------- 평가 함수 ---------- */

  // 모양 하나를 점수로 환산한다.
  //   total      : 그 모양에 든 내 돌 수
  //   gap        : 사이에 빈칸 하나가 낀 모양인지 (OO_O 처럼)
  //   left/right : 양 끝이 빈칸인지 (열린 모양인지)
  function shapeScore(total, gap, leftOpen, rightOpen) {
    const ends = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);

    if (!gap) {
      if (total >= 5) return P.FIVE;
      if (ends === 0) return 0;            // 양쪽 다 막혔으면 죽은 모양
      if (total === 4) return ends === 2 ? P.OPEN_FOUR : P.FOUR;
      if (total === 3) return ends === 2 ? P.OPEN_THREE : P.THREE;
      if (total === 2) return ends === 2 ? P.OPEN_TWO : P.TWO;
      return ends === 2 ? P.ONE : 0;
    }

    // 띈 모양 — 가운데 빈칸을 메우면 한 단계 위가 된다
    if (total >= 4) return P.FOUR;         // OO_OO / OOO_O → 한 수면 5목
    if (total === 3) return ends === 2 ? P.OPEN_THREE : (ends === 1 ? P.THREE : 0);
    if (total === 2) return ends === 2 ? P.OPEN_TWO / 2 : P.TWO / 2;
    return 0;
  }

  // 한 줄(cells[0..n-1])에서 player 의 모양들을 모두 더한다.
  // 이어진 돌 덩어리를 훑되, 빈칸 하나를 사이에 둔 돌은 같은 모양으로 묶는다.
  // 묶은 구간은 건너뛰므로 같은 돌을 두 번 세지 않는다.
  function evalLine(cells, n, player) {
    let score = 0;
    let i = 0;

    while (i < n) {
      if (cells[i] !== player) { i++; continue; }

      const start = i;
      let total = 1;
      while (i + 1 < n && cells[i + 1] === player) { i++; total++; }

      let end = i;
      let gap = false;

      if (end + 2 < n && cells[end + 1] === EMPTY && cells[end + 2] === player) {
        let j = end + 2;
        while (j < n && cells[j] === player) { total++; j++; }
        gap = true;
        end = j - 1;
        i = end;
      }

      const leftOpen = start - 1 >= 0 && cells[start - 1] === EMPTY;
      const rightOpen = end + 1 < n && cells[end + 1] === EMPTY;

      score += shapeScore(total, gap, leftOpen, rightOpen);
      i++;
    }

    return score;
  }

  // 판 전체에서 player 의 모양 점수 합계.
  // 각 줄을 딱 한 번씩만 훑도록, 줄의 시작점(앞칸이 판 밖인 칸)에서만 스캔한다.
  function patternScore(board, player) {
    let total = 0;

    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];

      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (inBounds(r - dr, c - dc)) continue;

          let n = 0;
          let rr = r;
          let cc = c;
          while (inBounds(rr, cc)) {
            lineBuf[n++] = board[rr * SIZE + cc];
            rr += dr;
            cc += dc;
          }

          if (n >= 5) total += evalLine(lineBuf, n, player);
        }
      }
    }

    return total;
  }

  // 판 전체를 me 입장에서 점수로 환산한다.
  function evaluate(board, me, opp) {
    return patternScore(board, me) - patternScore(board, opp) * DEFENSE;
  }

  // idx 에 player 를 놓았다고 치고, 그 칸을 지나는 네 줄만 본다. (후보 정렬용)
  function pointScore(board, idx, player) {
    const r = (idx / SIZE) | 0;
    const c = idx % SIZE;
    const prev = board[idx];
    board[idx] = player;

    let score = 0;

    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];

      for (let k = -4; k <= 4; k++) {
        const nr = r + dr * k;
        const nc = c + dc * k;
        segBuf[k + 4] = inBounds(nr, nc) ? board[nr * SIZE + nc] : BLOCK;
      }

      score += evalLine(segBuf, 9, player);
    }

    board[idx] = prev;
    return score;
  }

  // idx 에 놓인 player 의 돌로 5목이 됐는지
  function hasFive(board, idx, player) {
    const r = (idx / SIZE) | 0;
    const c = idx % SIZE;

    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      let count = 1;

      for (let k = 1; k < 5; k++) {
        const nr = r + dr * k;
        const nc = c + dc * k;
        if (!inBounds(nr, nc) || board[nr * SIZE + nc] !== player) break;
        count++;
      }
      for (let k = 1; k < 5; k++) {
        const nr = r - dr * k;
        const nc = c - dc * k;
        if (!inBounds(nr, nc) || board[nr * SIZE + nc] !== player) break;
        count++;
      }

      if (count >= 5) return true;
    }

    return false;
  }

  /* ---------- 후보 좁히기 ----------
     놓인 돌 주변만 후보로 삼는다. 노드마다 판을 다시 훑지 않도록
     "주변에 돌이 몇 개 있는지"를 배열로 들고 다니며 착수/무름 때 갱신한다. */

  function bumpNear(near, idx, delta, radius) {
    const r = (idx / SIZE) | 0;
    const c = idx % SIZE;

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) near[nr * SIZE + nc] += delta;
      }
    }
  }

  /* ---------- 탐색 ---------- */

  function place(job, idx, player) {
    job.board[idx] = player;
    bumpNear(job.near, idx, 1, job.opt.radius);
  }

  function undo(job, idx) {
    job.board[idx] = EMPTY;
    bumpNear(job.near, idx, -1, job.opt.radius);
  }

  // 지금 판에서 둘 만한 자리를, 좋아 보이는 순서로 최대 width 개.
  // shuffle 이면 점수가 같은 것끼리만 순서를 섞는다. 알파베타는 루트에서
  // 최고 점수를 받은 수를 고르므로, 순서가 바뀌어도 "동점으로 최선인 수들"
  // 사이에서만 선택이 갈린다 — 즉 판이 매번 조금씩 달라지되 약해지지 않는다.
  function orderedMoves(job, player, width, shuffle, outScores) {
    const board = job.board;
    const near = job.near;
    const other = player === job.me ? job.opp : job.me;
    const list = [];

    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY || near[i] === 0) continue;
      // 내 공격 + 상대 자리 뺏기(수비) 를 함께 본다
      const s = pointScore(board, i, player) + pointScore(board, i, other) * 0.8;
      list.push([i, s, shuffle ? Math.random() : 0]);
    }

    list.sort((a, b) => (b[1] - a[1]) || (a[2] - b[2]));
    const top = list.slice(0, width);

    if (outScores) {
      outScores.length = 0;
      for (const x of top) outScores.push(x[1]);
    }
    return top.map((x) => x[0]);
  }

  // 탐색을 시작하기 전에 확실한 것부터 처리한다.
  function prepare(job) {
    const board = job.board;

    // 빈 판이면 한가운데
    let empty = true;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) { empty = false; break; }
    }
    if (empty) {
      job.best = 7 * SIZE + 7;
      job.done = true;
      return;
    }

    const spots = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === EMPTY && job.near[i] > 0) spots.push(i);
    }
    if (spots.length === 0) {
      job.best = Array.prototype.indexOf.call(board, EMPTY);
      job.done = true;
      return;
    }

    job.best = spots[0];

    // 1) 지금 이기는 자리가 있으면 더 볼 것도 없다
    for (const idx of spots) {
      board[idx] = job.me;
      const win = hasFive(board, idx, job.me);
      board[idx] = EMPTY;
      if (win) {
        job.best = idx;
        job.bestScore = WIN;
        job.done = true;
        return;
      }
    }

    // 2) 상대가 다음 수에 이기는 자리가 있으면 후보를 "막는 자리"로 한정한다.
    //    (여러 곳이면 그중 내 공격에도 가장 도움이 되는 쪽을 탐색으로 고른다)
    const blocks = [];
    for (const idx of spots) {
      board[idx] = job.opp;
      const win = hasFive(board, idx, job.opp);
      board[idx] = EMPTY;
      if (win) blocks.push(idx);
    }

    if (blocks.length > 0) {
      blocks.sort((a, b) => pointScore(board, b, job.me) - pointScore(board, a, job.me));
      job.forcedMoves = blocks;
      job.best = blocks[0];
    }

    job.depth = 2;
    beginDepth(job);
  }

  function beginDepth(job) {
    let scores = [];
    let moves = job.forcedMoves ||
      orderedMoves(job, job.me, job.opt.rootWidth, job.opt.shuffleTies, scores);
    if (job.forcedMoves) scores = [];   // 강제수는 실수 대상이 아니라 점수가 필요 없다

    // 지난 깊이에서 가장 좋았던 수를 맨 앞으로 — 알파베타가 훨씬 잘 잘린다
    if (job.best >= 0) {
      const pos = moves.indexOf(job.best);
      if (pos > 0) {
        moves = moves.slice();
        moves.splice(pos, 1);
        moves.unshift(job.best);
        if (scores.length) scores.unshift(scores.splice(pos, 1)[0]);
      }
    }

    job.rootMoves = moves;
    job.rootScores = scores;
    job.rootIndex = 0;
    job.alpha = -Infinity;
    job.depthBest = -1;
    job.depthBestScore = -Infinity;
  }

  // 난이도를 낮추기 위한 "실수".
  // 사람이 모양을 만들 틈을 주되, 티 나는 헛수는 두지 않는다. 그래서
  //   · 강제수(즉승 / 반드시 막아야 하는 자리 / 승패 확정)에서는 흔들지 않고
  //   · 그 외에는 최선의 바로 옆(slipRadius 칸 안)에서만 자리를 바꾼다.
  // 싸우고 있는 곳을 벗어나지 않으니, 딴 데 두는 헛수가 아니라
  // "막긴 막았는데 한 칸 어긋난" 정도로 보인다.
  function applySlip(job) {
    const rate = job.opt.slipRate;
    if (!rate || job.forcedMoves) return;
    if (Math.abs(job.bestScore) >= WIN / 2) return;
    if (Math.random() >= rate) return;
    if (!job.rootScores || job.rootScores.length !== job.rootMoves.length) return;

    const radius = job.opt.slipRadius;
    const br = (job.best / SIZE) | 0;
    const bc = job.best % SIZE;

    let pick = -1;
    let pickScore = -Infinity;

    for (let i = 0; i < job.rootMoves.length; i++) {
      const m = job.rootMoves[i];
      if (m === job.best) continue;

      const dr = Math.abs(((m / SIZE) | 0) - br);
      const dc = Math.abs((m % SIZE) - bc);
      if (dr > radius || dc > radius) continue;   // 딴 동네면 후보에서 뺀다

      if (job.rootScores[i] > pickScore) {
        pickScore = job.rootScores[i];
        pick = m;
      }
    }

    if (pick < 0) return;                  // 근처에 대안이 없으면 최선을 둔다
    job.best = pick;
    job.slipped = true;
  }

  // sliceMs 만큼만 일하고 돌아온다. 다 끝났으면 true.
  // (3단계에서 이걸 조각내 불러 화면이 멈추지 않게 한다)
  function stepJob(job, sliceMs) {
    if (job.done) return true;

    const sliceEnd = Date.now() + sliceMs;

    for (;;) {
      if (job.rootIndex >= job.rootMoves.length) {
        // 이 깊이를 끝까지 봤다 — 결과 채택
        if (!job.timedOut && job.depthBest >= 0) {
          job.best = job.depthBest;
          job.bestScore = job.depthBestScore;
          job.reachedDepth = job.depth;
        }

        // 승/패가 확정됐으면 더 깊이 볼 필요가 없다
        const decided = Math.abs(job.bestScore) >= WIN / 2;
        job.depth += 2;

        if (job.timedOut || decided || job.depth > job.opt.maxDepth ||
            Date.now() >= job.deadline) {
          applySlip(job);
          job.done = true;
          return true;
        }

        beginDepth(job);
      }

      if (Date.now() >= job.deadline) {
        job.timedOut = true;
        applySlip(job);
        job.done = true;
        return true;
      }
      if (Date.now() >= sliceEnd) return false;  // 다음 조각에서 이어서

      const idx = job.rootMoves[job.rootIndex++];
      place(job, idx, job.me);

      let score;
      if (hasFive(job.board, idx, job.me)) {
        score = WIN;
      } else {
        score = minimax(job, job.depth - 1, job.alpha, Infinity, false, 1);
      }

      undo(job, idx);

      if (score > job.depthBestScore) {
        job.depthBestScore = score;
        job.depthBest = idx;
      }
      if (score > job.alpha) job.alpha = score;
    }
  }

  // 미니맥스 + 알파베타. maximizing 이면 내(me) 차례.
  // ply 는 뿌리에서 몇 수째인지 — 같은 승리라면 빨리 이기는 쪽을 고르게 한다.
  function minimax(job, depth, alpha, beta, maximizing, ply) {
    job.nodes++;
    if ((job.nodes & 255) === 0 && Date.now() >= job.deadline) {
      job.timedOut = true;
      return evaluate(job.board, job.me, job.opp);
    }
    if (depth <= 0) {
      return evaluate(job.board, job.me, job.opp);
    }

    const player = maximizing ? job.me : job.opp;
    const moves = orderedMoves(job, player, job.opt.branchWidth);
    if (moves.length === 0) return evaluate(job.board, job.me, job.opp);

    for (const idx of moves) {
      place(job, idx, player);

      let score;
      if (hasFive(job.board, idx, player)) {
        score = maximizing ? WIN - ply : -WIN + ply;
      } else {
        score = minimax(job, depth - 1, alpha, beta, !maximizing, ply + 1);
      }

      undo(job, idx);

      if (maximizing) {
        if (score > alpha) alpha = score;
      } else {
        if (score < beta) beta = score;
      }

      if (alpha >= beta) break;   // 가지치기
      if (job.timedOut) break;
    }

    return maximizing ? alpha : beta;
  }

  // 탐색 한 판에 필요한 것들을 모아둔 작업 객체.
  function createJob(sourceBoard, me, opp, options) {
    const opt = Object.assign({}, DEFAULTS, options || {});

    const board = Int8Array.from(sourceBoard);
    const near = new Int16Array(SIZE * SIZE);
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) bumpNear(near, i, 1, opt.radius);
    }

    const job = {
      board: board,
      near: near,
      me: me,
      opp: opp,
      opt: opt,
      deadline: Date.now() + opt.timeBudget,
      nodes: 0,
      timedOut: false,
      done: false,
      best: -1,
      bestScore: 0,
      reachedDepth: 0,
      forcedMoves: null,
      slipped: false,
      rootScores: [],

      depth: 0,
      rootMoves: [],
      rootIndex: 0,
      alpha: -Infinity,
      depthBest: -1,
      depthBestScore: -Infinity,
    };

    job.step = function (sliceMs) { return stepJob(job, sliceMs); };
    job.run = function () {
      while (!stepJob(job, 1e9)) { /* 끝날 때까지 */ }
      return job.best;
    };

    prepare(job);
    return job;
  }

  /* ---------- 바깥에서 쓰는 것 ---------- */

  // 한 번에 끝까지 계산한다(동기). 3단계에서 화면 안 멈추는 버전으로 감싼다.
  function chooseMove(board, me, opp, options) {
    return createJob(board, me, opp, options).run();
  }

  const api = {
    chooseMove: chooseMove,
    createJob: createJob,
    evaluate: evaluate,
    patternScore: patternScore,
    pointScore: pointScore,
    SCORE: P,
    DEFAULTS: DEFAULTS,
  };

  global.OmokHardAI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
