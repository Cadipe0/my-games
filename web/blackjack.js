/* ============================================================
   블랙잭 — blackjack.py 를 웹으로 옮긴 버전
   원본 규칙 그대로: 버스트 기준 30, 21에 더 가까운 쪽이 승리,
   A는 뽑을 때마다 1/11을 직접 고른다.
   ============================================================ */

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const BUST_LIMIT = 30;
const DEFAULT_BET = 10;
const FIRST_BET_LIMIT_RATIO = 0.5;   // 첫 판에 딜러가 선베팅할 때의 상한 비율

const DIFFICULTIES = [
  { key: "easy", name: "쉬움", chips: 100 },
  { key: "normal", name: "보통", chips: 200 },
  { key: "hard", name: "어려움", chips: 1000 },
];

const tableEl = document.getElementById("table");
const chipsEl = document.getElementById("chips");
const logEl = document.getElementById("log");
const actionsEl = document.getElementById("actions");
const dealerHandEl = document.getElementById("dealer-hand");
const playerHandEl = document.getElementById("player-hand");
const dealerTotalEl = document.getElementById("dealer-total");
const playerTotalEl = document.getElementById("player-total");
const recordEl = document.getElementById("record");
const rankEl = document.getElementById("ranking");
const resetSlot = document.getElementById("record-reset");

let deck = [];
let player = [];
let playerAceValues = [];
let dealer = [];

let chips = 100;
let dealerChips = 100;
let playerBet = 0;
let dealerBet = 0;
let roundNo = 1;
let playerFirst = true;
let doubled = false;
let hideDealer = false;

let stats = { win: 0, lose: 0, push: 0 };

/* 기록은 한 세션(딜러를 파산시키거나 내 칩이 바닥날 때까지) 단위로 남긴다.
   stats 는 페이지를 켠 뒤의 누적이므로, 세션 시작 시점을 적어 두고 그 차이를 쓴다. */
let sessionKey = "";
let sessionName = "";
let sessionStartedAt = 0;
let sessionBase = { win: 0, lose: 0, push: 0 };
let peakChips = 0;          // 세션 중 가장 많이 가졌던 칩 = 대표 점수
let sessionSaved = false;

/* ---------- 덱 ---------- */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newDeck() {
  const d = [];
  for (let i = 0; i < 4; i++) d.push(...RANKS);
  for (let i = d.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function drawCard() {
  if (deck.length === 0) deck = newDeck();
  return deck.pop();
}

/* ---------- 점수 ---------- */

// 딜러용: A를 버스트하지 않는 쪽으로 자동 계산
function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card === "A") { total += 11; aces++; }
    else if (card === "J" || card === "Q" || card === "K") total += 10;
    else total += parseInt(card, 10);
  }
  while (total > BUST_LIMIT && aces > 0) { total -= 10; aces--; }
  return total;
}

// 플레이어용: 본인이 고른 A 값을 그대로 사용
function playerHandTotal(hand, aceValues) {
  let total = 0;
  let aceIndex = 0;
  for (const card of hand) {
    if (card === "A") total += aceValues[aceIndex++];
    else if (card === "J" || card === "Q" || card === "K") total += 10;
    else total += parseInt(card, 10);
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function isPlayerBlackjack() {
  return player.length === 2 && playerHandTotal(player, playerAceValues) === 21;
}

/* ---------- 화면 ---------- */

function log(text, cls) {
  logEl.hidden = false;
  const p = document.createElement("p");
  if (cls) p.className = cls;
  p.textContent = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

function logStep(n, title) {
  log("[" + n + "] " + title, "step");
}

function note(message) {
  log("! " + message, "note");
}

function renderHand(el, hand, hideLast) {
  el.innerHTML = "";
  hand.forEach((card, i) => {
    const c = document.createElement("span");
    const isHidden = hideLast && i === hand.length - 1 && hand.length > 1;
    c.className = "pcard" + (isHidden ? " hidden-card" : "");
    c.textContent = isHidden ? "?" : card;
    el.appendChild(c);
  });
}

function renderTable(showDistance) {
  tableEl.hidden = false;

  renderHand(dealerHandEl, dealer, hideDealer);
  renderHand(playerHandEl, player, false);

  const playerTotal = playerHandTotal(player, playerAceValues);
  playerTotalEl.innerHTML = "합계 " + playerTotal +
    (showDistance ? '<span class="dist">21과 차이 ' + Math.abs(21 - playerTotal) + "</span>" : "");

  if (hideDealer) {
    dealerTotalEl.textContent = "합계 ?";
  } else {
    const dealerTotal = handValue(dealer);
    dealerTotalEl.innerHTML = "합계 " + dealerTotal +
      (showDistance ? '<span class="dist">21과 차이 ' + Math.abs(21 - dealerTotal) + "</span>" : "");
  }

  renderChips();
}

function renderChips() {
  chipsEl.hidden = false;
  chipsEl.innerHTML =
    '<span>' + you() + ' <strong>' + chips + '</strong>칩' +
    (playerBet ? ' <span class="bet">(베팅 ' + playerBet + ')</span>' : "") + "</span>" +
    '<span>딜러 <strong>' + dealerChips + '</strong>칩' +
    (dealerBet ? ' <span class="bet">(베팅 ' + dealerBet + ')</span>' : "") + "</span>";
}

function clearActions() {
  actionsEl.innerHTML = "";
}

function actionButton(label, onClick, primary) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn" + (primary ? " primary" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function actionRow() {
  const row = document.createElement("div");
  row.className = "row";
  actionsEl.appendChild(row);
  return row;
}

function actionHint(text) {
  const p = document.createElement("p");
  p.className = "hint";
  p.textContent = text;
  actionsEl.appendChild(p);
}

/* ---------- 난이도 / 세션 ---------- */

function showDifficulty() {
  tableEl.hidden = true;
  chipsEl.hidden = true;
  clearActions();

  actionHint("난이도를 선택하세요. 딜러의 시작 칩이 달라집니다. (" + you() + " 시작 칩: 100)");

  const list = document.createElement("div");
  list.className = "choices";
  DIFFICULTIES.forEach((d, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.innerHTML = '<span class="idx">' + (i + 1) + "</span>" +
      d.name + " (딜러 칩 " + d.chips + "개)";
    btn.addEventListener("click", () => startSession(d));
    list.appendChild(btn);
  });
  actionsEl.appendChild(list);

  paintRecordList();
}

/* ---------- 기록 ---------- */

/* "보통 — 4판 · 딜러 파산 1번 (25%) · 최고 329점 (최종 300칩 · 승률 58%)"

   최고 기록은 이긴 세션에서만 고른다. 파산한 세션은 최종 칩이 0 이라
   승률만 남는데, 그걸 "최고 기록" 으로 내세우면 앞뒤가 안 맞는다. */
function recordText(d) {
  return Promise.all([
    GameScore.summary("blackjack", { mode: d.key }),
    GameScore.best("blackjack", { mode: d.key, outcome: "win" }),
  ]).then(([sum, top]) => {
    if (sum.plays === 0) return d.name + " — 아직 기록이 없습니다.";
    let text = d.name + " — " + sum.plays + "판 · 딜러 파산 " + sum.win + "번";
    if (sum.rate !== null) text += " (" + sum.rate.toFixed(0) + "%)";
    if (top) {
      text += "  ·  최고 " + top.score + "점 (최종 " + top.detail.finalChips +
              "칩 · 승률 " + top.detail.winRate + "%)";
    }
    return text;
  });
}

/* 난이도마다 한 줄씩 자리를 먼저 잡아 두고 기록이 오면 채운다.
   그래야 불러오는 순서와 상관없이 줄 순서가 유지된다. */
function paintRecordList() {
  if (!recordEl) return;
  recordEl.hidden = false;
  recordEl.innerHTML = "";

  DIFFICULTIES.forEach((d) => {
    const line = document.createElement("p");
    line.className = "record-line";
    line.textContent = d.name + " — 불러오는 중…";
    recordEl.appendChild(line);
    recordText(d).then((t) => { line.textContent = t; });
  });

  /* 난이도를 섞어 하나로 세운다. 점수에 최종 칩이 들어 있어서 어려움
     승리(1100~)가 보통(300~)보다, 보통이 쉬움(200~)보다 자동으로 위에
     오기 때문에 따로 나눌 필요가 없다.
     파산한 세션은 뺀다 — 이긴 사람들끼리 겨루는 표다. */
  GameRank.paint(rankEl, "blackjack", {
    outcome: "win",
    title: "딜러 파산 랭킹",
    note: (r) => r.detail.difficulty + " · 승률 " + r.detail.winRate + "%",
  });

  if (resetSlot) resetSlot.hidden = false;
}

GameReset.attach(resetSlot, { game: "blackjack", onDone: paintRecordList });

/* 세션 하나를 기록한다.

   대표 점수 = 최종 칩 + 반올림(승률)

   최종 칩은 값이 몇 개 없다. 칩은 나와 딜러 사이를 오갈 뿐 생기거나
   사라지지 않고(settle 참고), 세션은 둘 중 하나가 0 이 될 때 끝나기
   때문이다. 그래서 이기면 100 + 딜러 시작 칩(200 / 300 / 1100), 지면 0 이다.

   정보가 적어 보이지만 그게 이 점수의 쓸모다.
     - 이긴 사람이 진 사람보다 반드시 위에 온다. 예전처럼 "가장 많이
       가졌던 칩" 으로 매기면 어려움에서 900 까지 갔다 파산한 사람이
       쉬움에서 이긴 사람(200)보다 높아져 순위표가 이상해졌다.
     - 난이도 보정이 저절로 된다 (어려움 1100 > 보통 300 > 쉬움 200).

   승률은 그 구간 안에서 순서를 만든다. 분모는 승 + 패다 (무승부 제외).

   그냥 더해도 난이도 구간이 겹치지 않는다. 쉬움 승리의 최대는 200 + 100 =
   300 이고 보통 승리의 최소는 301 이라서다. 왜 301 이 바닥인가 하면,

     - 딜러 칩을 가져오는 길은 판을 이기는 것뿐이다 (settle 의 win 갈래가
       dealerChips 를 줄이는 유일한 곳). 세션을 이겼다면 반드시 한 판은
       이겼으므로 승률이 0 일 수 없다.
     - 한 판에 딸 수 있는 칩은 min(딜러 칩, 내 칩) 이하다. 보통은 둘의 합이
       300 으로 고정이라 한 판에 최대 150 이다. 한 판에 잃는 최소는 1 칩이다.
     - 100 에서 300 까지 가려면 순증 200 이 필요하니, W 번 이기고 L 번 졌을 때
       150W - L >= 200, 즉 L <= 150W - 200 이다. 그러면
       승률 >= W / (151W - 200) 이고, W 를 아무리 키워도 0.66% 아래로는
       내려가지 않는다. 반올림하면 최소 1% 다.

   가장 많이 가졌던 칩(peakChips)은 점수에서 빠졌지만 상세에는 계속 담는다.
   지금은 어디에도 띄우지 않지만, 판이 끝나고 나면 다시 구할 수 없는 값이라
   남겨 둔다 — "한때 900 까지 갔다" 는 언젠가 보여 줄 만한 이야기다. */
function saveSession() {
  if (sessionSaved) return;
  sessionSaved = true;

  const won = stats.win - sessionBase.win;
  const lost = stats.lose - sessionBase.lose;
  const decided = won + lost;
  const rate = decided > 0 ? (won / decided) * 100 : 0;

  GameScore.submit("blackjack", {
    mode: sessionKey,
    outcome: dealerChips <= 0 ? "win" : "lose",
    score: chips + Math.round(rate),
    detail: {
      difficulty: sessionName,
      finalChips: chips,
      peakChips: peakChips,
      winRate: Math.round(rate),
      rounds: roundNo - 1,
      win: won,
      lose: lost,
      push: stats.push - sessionBase.push,
      seconds: GameScore.since(sessionStartedAt),
    },
  })
    /* 화면의 랭킹과 같은 조건(이긴 세션만)으로 순위를 본다. 파산한 세션은
       랭킹에 없으므로 offer 가 알아서 넘어간다. */
    .then((saved) => GameHighScore.offer("blackjack", saved, {
      outcome: "win",
      what: saved.score + "점",
    }))
    .then(paintRecordList);
}

function startSession(difficulty) {
  chips = 100;
  dealerChips = difficulty.chips;
  playerBet = 0;
  dealerBet = 0;
  roundNo = 1;
  logEl.innerHTML = "";

  sessionKey = difficulty.key;
  sessionName = difficulty.name;
  sessionStartedAt = Date.now();
  sessionBase = { win: stats.win, lose: stats.lose, push: stats.push };
  peakChips = chips;
  sessionSaved = false;
  // 판이 도는 동안에는 기록 · 랭킹 · 초기화를 모두 숨긴다
  if (recordEl) recordEl.hidden = true;
  if (rankEl) rankEl.hidden = true;
  if (resetSlot) resetSlot.hidden = true;

  log("[" + difficulty.name + " 난이도] 딜러 시작 칩 " + difficulty.chips +
      " · " + you() + " 시작 칩 100", "hi");
  log("30을 넘으면 버스트, 넘지 않으면 21에 더 가까운 쪽이 이깁니다.");
  renderChips();

  coinToss(() => playRound());
}

/* ---------- 동전 던지기 ---------- */

function coinToss(then) {
  clearActions();
  actionHint("🪙 딜러가 동전을 던집니다. 앞/뒤를 맞추면 선베팅권을 가집니다.");

  const row = actionRow();
  ["앞면", "뒷면"].forEach((call) => {
    row.appendChild(actionButton(call, () => {
      const result = Math.random() < 0.5 ? "앞면" : "뒷면";
      log("동전 결과: " + result + "  (" + you() + "님 선택: " + call + ")", "hi");
      if (call === result) {
        log("적중! " + you() + "님이 선베팅합니다.", "good");
        playerFirst = true;
      } else {
        log("빗나갔습니다. 딜러가 선베팅합니다.");
        playerFirst = false;
      }
      then();
    }, true));
  });
}

/* ---------- 베팅 입력 ---------- */

function askAceValue(then) {
  clearActions();
  actionHint("방금 뽑은 A를 1로 쓰시겠습니까, 11로 쓰시겠습니까?");
  const row = actionRow();
  [1, 11].forEach((v) => {
    row.appendChild(actionButton("A = " + v, () => {
      playerAceValues.push(v);
      log("A를 " + v + "(으)로 사용합니다.");
      then();
    }, true));
  });
}

// 플레이어에게 카드 한 장. A면 값을 먼저 물어본다.
function dealToPlayer(then) {
  const card = drawCard();
  player.push(card);
  if (card === "A") askAceValue(then);
  else then();
}

function dealToDealer() {
  dealer.push(drawCard());
}

function askPlayerBet(minimum, then) {
  if (minimum > chips) {
    note("최소 베팅액 " + minimum + "칩을 낼 칩이 부족해 보유 칩 전부(" + chips + "칩)를 베팅합니다.");
    then(chips);
    return;
  }

  let defaultBet = Math.max(DEFAULT_BET, minimum);
  if (defaultBet > chips) {
    defaultBet = chips;
    note("보유 칩이 부족해 기본 배팅을 " + defaultBet + "칩으로 맞춥니다.");
  } else if (defaultBet !== DEFAULT_BET) {
    note("최소 베팅액 " + minimum + "칩에 맞춰 기본 배팅을 " + defaultBet + "칩으로 올립니다.");
  }

  clearActions();
  actionHint("보유 칩 " + chips + " · 최소 " + minimum + "칩. 기본 배팅은 " +
             defaultBet + "칩이고, 금액을 직접 입력해도 됩니다.");

  const row = actionRow();

  const input = document.createElement("input");
  input.className = "field";
  input.type = "number";
  input.min = String(minimum);
  input.max = String(chips);
  input.placeholder = minimum + " ~ " + chips;
  input.autocomplete = "off";

  function submit(value) {
    if (!/^\d+$/.test(String(value).trim()) || parseInt(value, 10) <= 0) {
      note("1 이상의 숫자를 입력해주세요.");
      return;
    }
    const bet = parseInt(value, 10);
    if (bet < minimum) { note("최소 " + minimum + "칩 이상 걸어야 합니다."); return; }
    if (bet > chips) { note("보유 칩(" + chips + ")보다 많이 베팅할 수 없습니다."); return; }
    then(bet);
  }

  row.appendChild(actionButton("기본 배팅 " + defaultBet + "칩", () => then(defaultBet), true));
  row.appendChild(input);
  row.appendChild(actionButton("이 금액으로 베팅", () => submit(input.value)));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit(input.value);
  });
}

/* ---------- 딜러 베팅 ---------- */

function dealerChooseBet(minimum, limitRatio) {
  let cap = Math.min(dealerChips, chips);
  if (limitRatio != null) cap = Math.max(1, Math.floor(cap * limitRatio));
  const low = Math.max(1, minimum);
  if (low >= cap) return Math.min(low, dealerChips);
  return randInt(low, cap);
}

function dealerRaise(current, minimum) {
  if (minimum > current) return dealerChooseBet(minimum, null);
  if (Math.random() < 0.5) return current;
  return dealerChooseBet(current, null);
}

/* ---------- 한 판 ---------- */

function playRound() {
  deck = newDeck();
  player = [];
  playerAceValues = [];
  dealer = [];
  playerBet = 0;
  dealerBet = 0;
  doubled = false;
  hideDealer = false;

  log("─".repeat(18) + " " + roundNo + "판 · 선베팅: " +
      (playerFirst ? you() : "딜러") + " " + "─".repeat(18), "hi");
  renderTable(false);

  step1();
}

function step1() {
  logStep(1, "첫 번째 카드");
  dealToPlayer(() => {
    dealToDealer();
    hideDealer = false;
    renderTable(false);
    step2();
  });
}

function step2() {
  logStep(2, "1차 베팅");

  if (playerFirst) {
    askPlayerBet(1, (bet) => {
      playerBet = bet;
      dealerBet = dealerChooseBet(playerBet, null);
      log(you() + " " + playerBet + "칩   vs   딜러 " + dealerBet + "칩", "hi");
      renderChips();
      step3();
    });
  } else {
    const limit = roundNo === 1 ? FIRST_BET_LIMIT_RATIO : null;
    dealerBet = dealerChooseBet(1, limit);
    log("딜러가 " + dealerBet + "칩을 걸었습니다.");
    renderChips();
    askPlayerBet(dealerBet, (bet) => {
      playerBet = bet;
      log(you() + " " + playerBet + "칩   vs   딜러 " + dealerBet + "칩", "hi");
      renderChips();
      step3();
    });
  }
}

function step3() {
  logStep(3, "두 번째 카드");
  dealToPlayer(() => {
    dealToDealer();
    hideDealer = true;   // 딜러의 두 번째 카드는 가린다
    renderTable(false);
    step4();
  });
}

function step4() {
  logStep(4, "2차 베팅");

  if (playerBet >= chips || dealerBet >= dealerChips) {
    note("한쪽이 올인이라 건너뜁니다");
    step5();
    return;
  }

  if (playerFirst) {
    askPlayerBet(playerBet, (bet) => {
      playerBet = bet;
      dealerBet = dealerRaise(dealerBet, playerBet);
      log(you() + " " + playerBet + "칩   vs   딜러 " + dealerBet + "칩", "hi");
      renderChips();
      step5();
    });
  } else {
    dealerBet = dealerRaise(dealerBet, dealerBet);
    log("딜러가 " + dealerBet + "칩까지 걸었습니다.");
    renderChips();
    askPlayerBet(Math.max(playerBet, dealerBet), (bet) => {
      playerBet = bet;
      log(you() + " " + playerBet + "칩   vs   딜러 " + dealerBet + "칩", "hi");
      renderChips();
      step5();
    });
  }
}

function step5() {
  logStep(5, "더블다운");

  if (isPlayerBlackjack() || isBlackjack(dealer)) {
    note("블랙잭이 나와 바로 오픈합니다");
    step6();
    return;
  }

  if (chips < playerBet * 2) {
    note(playerBet * 2 + "칩이 필요해 더블다운을 선택할 수 없습니다 → 스탠드");
    step6();
    return;
  }

  clearActions();
  actionHint("더블다운은 베팅을 " + playerBet * 2 + "칩으로 2배 올리고 카드를 한 장 더 받습니다.");
  const row = actionRow();

  row.appendChild(actionButton("더블다운", () => {
    playerBet *= 2;
    doubled = true;
    log("더블다운! 베팅 " + playerBet + "칩 — 이기면 딜러 베팅액과 무관하게 최대 " +
        playerBet + "칩을 가져옵니다.", "hi");
    renderChips();
    dealToPlayer(() => {
      renderTable(false);
      step6();
    });
  }, true));

  row.appendChild(actionButton("스탠드", () => step6()));
}

function step6() {
  logStep(6, "오픈");
  hideDealer = false;
  renderTable(true);

  const playerBj = isPlayerBlackjack();
  const dealerBj = isBlackjack(dealer);
  const playerTotal = playerHandTotal(player, playerAceValues);
  const dealerTotal = handValue(dealer);

  let outcome, result;

  if (playerBj || dealerBj) {
    if (playerBj && dealerBj) {
      outcome = "둘 다 블랙잭! 무승부.";
      result = "push";
    } else if (playerBj) {
      outcome = "🃏 블랙잭! " + you() + "님 승리!";
      result = "win";
    } else {
      outcome = "딜러 블랙잭. " + you() + "님 패배.";
      result = "lose";
    }
  } else if (playerTotal > BUST_LIMIT) {
    outcome = you() + "님 버스트! (" + playerTotal + " > " + BUST_LIMIT + ") 패배.";
    result = "lose";
  } else if (dealerTotal > BUST_LIMIT) {
    outcome = "딜러 버스트! (" + dealerTotal + " > " + BUST_LIMIT + ") " + you() + "님 승리!";
    result = "win";
  } else {
    const playerDist = Math.abs(21 - playerTotal);
    const dealerDist = Math.abs(21 - dealerTotal);
    if (dealerDist < playerDist) {
      outcome = "딜러가 21에 더 가깝습니다. " + you() + "님 패배.";
      result = "lose";
    } else if (dealerDist > playerDist) {
      outcome = you() + "님이 21에 더 가깝습니다. " + you() + "님 승리!";
      result = "win";
    } else {
      outcome = "21과의 차이가 같습니다. 무승부.";
      result = "push";
    }
  }

  log(">>> " + outcome, result === "win" ? "good" : result === "lose" ? "bad" : "hi");
  stats[result]++;
  settle(result);
  roundEnd(result);
}

function settle(result) {
  const beforeChips = chips;
  const beforeDealer = dealerChips;
  let delta;

  if (result === "win") {
    let gain = doubled ? Math.max(playerBet, dealerBet) : dealerBet;
    gain = Math.min(gain, dealerChips);
    chips += gain;
    dealerChips -= gain;
    delta = "(+" + gain + ")";
    if (doubled && gain > dealerBet) {
      log("더블다운 승리! 딜러 베팅액과 무관하게 " + gain + "칩을 가져옵니다.", "good");
    }
  } else if (result === "lose") {
    chips -= playerBet;
    dealerChips += playerBet;
    delta = "(-" + playerBet + ")";
  } else {
    delta = "(변동 없음)";
  }

  peakChips = Math.max(peakChips, chips);
  log(you() + "  " + beforeChips + " → " + chips + "  " + delta);
  log("딜러      " + beforeDealer + " → " + dealerChips);
  playerBet = 0;
  dealerBet = 0;
  renderChips();
}

/* ---------- 판 종료 / 세션 종료 ---------- */

function summaryText(title) {
  const total = stats.win + stats.lose + stats.push;
  let text = "=== " + title + " ===  승 " + stats.win + " · 패 " + stats.lose +
             " · 무 " + stats.push;
  if (total > 0) {
    text += "  (승률 " + (stats.win / total * 100).toFixed(1) + "%)";
  }
  return text;
}

function roundEnd(result) {
  roundNo++;

  if (dealerChips <= 0) {
    log("🎉 딜러가 칩을 모두 잃었습니다! 최종 승리는 " + you() + "님입니다!", "good");
    sessionEnd();
    return;
  }
  if (chips <= 0) {
    log("보유 칩이 모두 소진되었습니다.", "bad");
    sessionEnd();
    return;
  }

  clearActions();

  if (result === "push") {
    actionHint("무승부였으므로 선베팅 순서를 동전 던지기로 다시 정합니다.");
    const row = actionRow();
    row.appendChild(actionButton("동전 던지기", () => coinToss(() => playRound()), true));
    return;
  }

  playerFirst = result === "win";
  actionHint("직전 판 승자인 " + (playerFirst ? you() : "딜러") + "가 선베팅합니다.");
  const row = actionRow();
  row.appendChild(actionButton("다음 판 시작", () => playRound(), true));
}

function sessionEnd() {
  log(summaryText("누적 전적"), "hi");
  saveSession();

  clearActions();
  const row = actionRow();
  row.appendChild(actionButton("난이도 다시 고르기", showDifficulty, true));

  const back = document.createElement("a");
  back.className = "btn ghost";
  back.href = "index.html";
  back.textContent = "게임 목록";
  row.appendChild(back);
}

/* ---------- 시작 ---------- */

// 허브에서 정한 닉네임. 아직 없으면 기본값.
function you() {
  return (window.GameNick && GameNick.name()) || "플레이어";
}

GameNick.require(function () {
  const label = document.getElementById("player-label");
  if (label) label.textContent = you();
  showDifficulty();
});
