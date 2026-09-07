/* ============================================================
   텍스트 게임 — 게임 엔진 (웹 확장판)
   스토리 데이터(STORY, ITEMS, MAX_HP)는 story.js 에 있다.

   ad_game.py 대비 확장한 것
     · 성향(용기/신중함)이 전투와 선택지 해금에 실제로 작용
     · 아이템을 인벤토리에서 직접 사용 (전투 중에도)
     · 적의 예비 동작 → 강공격 패턴, 급소/회피 판정
     · 자동 저장·이어하기, 엔딩 도감
     · 원본 버그 수정: 체력을 0으로 만드는 선택지가 전용 배드 엔딩 대신
       game_over_hp 로 새던 문제 (엔딩 노드로 가는 선택은 그대로 보낸다)
   ============================================================ */

const SAVE_KEY = "lostforest.save";
const CODEX_KEY = "lostforest.codex";

const storyEl = document.getElementById("story");
const choicesEl = document.getElementById("choices");
const logEl = document.getElementById("log");
const hudEl = document.getElementById("hud");
const invEl = document.getElementById("inv");
const hpTextEl = document.getElementById("hp-text");
const hpBarEl = document.getElementById("hpbar");
const statsEl = document.getElementById("stats");
const enemyEl = document.getElementById("enemy");
const enemyNameEl = document.getElementById("enemy-name");
const enemyFillEl = document.getElementById("enemy-fill");
const enemyHpEl = document.getElementById("enemy-hp");

const codexEl = document.getElementById("codex");
const codexGridEl = document.getElementById("codex-grid");
const codexRateEl = document.getElementById("codex-rate");

let hp = MAX_HP;
let inventory = new Set();
let stats = { 용기: 0, 신중함: 0 };
let flags = new Set();
let currentNode = null;
let combat = null;        // {data, enemyHp, enemyMax, telegraph}
let typing = null;        // 타자기 타이머

/* ---------- 작은 도구들 ---------- */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function storage(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

function log(text, cls) {
  logEl.hidden = false;
  const p = document.createElement("p");
  if (cls) p.className = cls;
  p.textContent = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

/* ---------- 본문 타자기 출력 ---------- */

function typeText(text) {
  if (typing) { clearInterval(typing); typing = null; }
  storyEl.textContent = "";
  storyEl.classList.add("typing");

  let i = 0;
  typing = setInterval(() => {
    storyEl.textContent = text.slice(0, ++i);
    if (i >= text.length) finishTyping(text);
  }, 14);

  // 아무 데나 누르면 즉시 완성
  storyEl.onclick = () => finishTyping(text);
}

function finishTyping(text) {
  if (typing) { clearInterval(typing); typing = null; }
  storyEl.textContent = text;
  storyEl.classList.remove("typing");
  storyEl.onclick = null;
}

/* ---------- 상태 표시 ---------- */

function equipmentAttack() {
  let bonus = 0;
  inventory.forEach((name) => {
    const meta = ITEMS[name];
    if (meta && meta.passive && meta.passive.attack) bonus += meta.passive.attack;
  });
  return bonus;
}

// 성향 보정. 너무 세면 전투가 무의미해져서 상한을 낮게 잡았다.
function critChance() { return Math.min(0.04 + (stats["용기"] || 0) * 0.02, 0.25); }
function dodgeChance() { return Math.min((stats["신중함"] || 0) * 0.02, 0.20); }

function updateHud() {
  hudEl.hidden = false;
  const ratio = Math.max(0, hp) / MAX_HP;
  hpTextEl.textContent = "❤ " + hp + " / " + MAX_HP;
  hpBarEl.firstElementChild.style.width = (ratio * 100) + "%";
  hpBarEl.classList.toggle("low", ratio <= 0.3);

  const atk = equipmentAttack();
  statsEl.textContent =
    "용기 " + (stats["용기"] || 0) + " · 신중함 " + (stats["신중함"] || 0) +
    "  (급소 " + Math.round(critChance() * 100) + "% · 회피 " + Math.round(dodgeChance() * 100) + "%" +
    (atk ? " · 공격 +" + atk : "") + ")";

  renderInventory();
}

function renderInventory() {
  const items = [...inventory].sort();
  invEl.innerHTML = "";
  invEl.hidden = items.length === 0;

  items.forEach((name) => {
    const meta = ITEMS[name] || {};
    const usable = !!meta.use && (combat ? true : meta.use === "heal");

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "item" + (usable ? " usable" : "");
    chip.title = meta.desc || "";
    chip.innerHTML = '<span class="ico">' + (meta.icon || "🎒") + "</span>" + name;

    if (usable) {
      chip.addEventListener("click", () => useItem(name));
    } else {
      chip.addEventListener("click", () => log(name + " — " + (meta.desc || "특별한 쓸모는 없어 보입니다."), "note"));
    }
    invEl.appendChild(chip);
  });
}

function updateEnemyBar() {
  if (!combat) { enemyEl.hidden = true; return; }
  enemyEl.hidden = false;
  const ratio = Math.max(0, combat.enemyHp) / combat.enemyMax;
  enemyNameEl.textContent = "👹 " + combat.data.enemy + (combat.telegraph ? "  (자세를 낮추는 중!)" : "");
  enemyFillEl.style.width = (ratio * 100) + "%";
  enemyHpEl.textContent = Math.max(0, combat.enemyHp) + " / " + combat.enemyMax;
  enemyEl.classList.toggle("telegraph", !!combat.telegraph);
}

/* ---------- 아이템 사용 ---------- */

function useItem(name) {
  const meta = ITEMS[name];
  if (!meta || !meta.use) return;

  if (meta.use === "heal") {
    if (hp >= MAX_HP) { log("이미 체력이 가득 차 있습니다.", "note"); return; }
    const before = hp;
    hp = Math.min(MAX_HP, hp + meta.amount);
    if (meta.consumable) inventory.delete(name);
    log(name + "을(를) 사용했습니다. 체력이 " + (hp - before) + " 회복했습니다. (현재 " + hp + "/" + MAX_HP + ")", "good");
  } else if (meta.use === "scare") {
    if (!combat) { log("지금은 쓸 상황이 아닙니다.", "note"); return; }
    log(name + "을(를) 크게 휘둘렀습니다! " + combat.data.enemy + "이(가) 주춤하며 물러섭니다.", "good");
    combat.skipEnemy = true;
    combat.telegraph = false;
  }

  updateHud();

  // 전투 중이라면 아이템 사용도 한 턴을 소모한다
  if (combat) enemyPhase(false);
}

/* ---------- 노드 진행 ---------- */

function pickFinalEnding() {
  if (flags.has("구조")) return "ending_hero";
  const courage = stats["용기"] || 0;
  const caution = stats["신중함"] || 0;
  if (courage > caution) return "ending_brave";
  if (caution > courage) return "ending_wise";
  return "ending_balanced";
}

function goTo(nodeId) {
  if (nodeId === "__final__") nodeId = pickFinalEnding();

  currentNode = nodeId;
  const node = STORY[nodeId];

  if (node.time) document.body.dataset.time = node.time;
  if (node.sets_flag) flags.add(node.sets_flag);

  typeText(node.text);
  updateHud();
  choicesEl.innerHTML = "";

  if (node.ending) {
    combat = null;
    enemyEl.hidden = true;
    recordEnding(nodeId, node);
    clearSave();
    showEnding(node);
    return;
  }

  if (node.combat) {
    startCombat(node.combat);
    return;
  }

  enemyEl.hidden = true;
  combat = null;
  saveGame();

  if (node.auto_next) {
    addChoice("계속하기 →", () => goTo(node.auto_next));
    return;
  }

  showChoices(node);
}

function addChoice(label, onClick, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  if (index != null) {
    btn.innerHTML = '<span class="idx">' + index + "</span>";
    btn.appendChild(document.createTextNode(label));
  } else {
    btn.textContent = label;
  }
  btn.addEventListener("click", onClick);
  choicesEl.appendChild(btn);
  return btn;
}

// 조건을 못 채운 선택지는 숨기지 않고 잠긴 상태로 보여준다.
function addLockedChoice(label, reason) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn locked";
  btn.disabled = true;
  btn.innerHTML = '<span class="idx">🔒</span>';
  btn.appendChild(document.createTextNode(label));
  const tag = document.createElement("span");
  tag.className = "lock-reason";
  tag.textContent = reason;
  btn.appendChild(tag);
  choicesEl.appendChild(btn);
}

function lockReason(choice) {
  if (choice.requires && !inventory.has(choice.requires)) {
    return choice.requires + " 필요";
  }
  if (choice.requires_stat) {
    const need = choice.requires_stat;
    if ((stats[need.stat] || 0) < need.min) return need.stat + " " + need.min + " 이상 필요";
  }
  return null;
}

function showChoices(node) {
  let n = 1;
  node.choices.forEach((choice) => {
    // 이미 둘러본 곳의 탐색 선택지는 아예 목록에서 뺀다
    if (choice.hide_if_flag && flags.has(choice.hide_if_flag)) return;
    // 특정 아이템을 가진 경우에만 감추는 선택지 (아이템 유무로 문구가 갈릴 때)
    if (choice.hide_if_item && inventory.has(choice.hide_if_item)) return;

    const reason = lockReason(choice);
    // 조건을 못 채웠을 때 아예 보이지 않아야 자연스러운 선택지도 있다
    if (reason && choice.hide_when_locked) return;

    if (reason) addLockedChoice(choice.label, reason);
    else addChoice(choice.label, () => applyChoice(choice), n++);
  });
}

// 선택지 / 분기 결과에 붙은 효과(아이템·성향·체력)를 적용한다.
function applyEffects(spec) {
  if (spec.grants) {
    inventory.add(spec.grants);
    const meta = ITEMS[spec.grants] || {};
    log("[아이템 획득: " + (meta.icon || "") + " " + spec.grants + "]", "good");
  }
  if (spec.consumes) inventory.delete(spec.consumes);
  if (spec.sets_flag) flags.add(spec.sets_flag);

  if (spec.stat_gain) {
    for (const [name, amount] of Object.entries(spec.stat_gain)) {
      stats[name] = (stats[name] || 0) + amount;
    }
  }

  // hp_range 가 있으면 그 범위에서 무작위로, 없으면 hp 값 그대로
  let delta = spec.hp || 0;
  if (spec.hp_range) delta = randInt(spec.hp_range[0], spec.hp_range[1]);

  if (delta) {
    const before = hp;
    hp = Math.max(0, Math.min(MAX_HP, hp + delta));
    const applied = hp - before;
    if (applied !== 0) {
      log("체력이 " + Math.abs(applied) + (applied > 0 ? " 회복" : " 감소") +
          "했습니다. (현재 " + hp + "/" + MAX_HP + ")", applied > 0 ? "good" : "bad");
    } else if (delta > 0) {
      log("이미 체력이 가득 차 있습니다. (현재 " + hp + "/" + MAX_HP + ")", "note");
    }
  }
}

// 가중치를 반영해 하나를 고른다. weight 를 적지 않으면 1로 본다.
function pickOutcome(outcomes) {
  const total = outcomes.reduce((sum, o) => sum + (o.weight || 1), 0);
  let roll = Math.random() * total;
  for (const o of outcomes) {
    roll -= (o.weight || 1);
    if (roll < 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function applyChoice(choice) {
  finishTyping(STORY[currentNode].text);

  applyEffects(choice);

  // 같은 선택지라도 결과가 갈리는 경우
  let next = choice.next;
  if (choice.outcomes && choice.outcomes.length) {
    const outcome = pickOutcome(choice.outcomes);
    applyEffects(outcome);
    if (outcome.next) next = outcome.next;
  }

  // 원본 버그 수정: 목적지가 엔딩 노드라면 체력이 0이어도 그 엔딩을 보여준다.
  const target = STORY[next];
  if (hp <= 0 && !(target && target.ending)) {
    goTo("game_over_hp");
    return;
  }
  goTo(next);
}

/* ---------- 전투 ---------- */

function startCombat(data) {
  combat = { data: data, enemyHp: data.enemy_hp, enemyMax: data.enemy_hp, telegraph: false, skipEnemy: false };
  log("[전투 시작] " + data.enemy + "(체력 " + data.enemy_hp + ")과(와) 마주쳤습니다!", "hi");

  // 기습으로 시작하는 전투는 적이 선제공격을 한 대 넣고 시작한다.
  if (data.first_strike) {
    const dmg = randInt(data.enemy_attack[0], data.enemy_attack[1]);
    hp = Math.max(0, hp - dmg);
    log("기습! 미처 자세를 잡기도 전에 " + dmg + "의 피해를 입었습니다. (현재 " + hp + "/" + MAX_HP + ")", "bad");
    if (hp <= 0) {
      const next = data.lose_next || "game_over_hp";
      combat = null;
      enemyEl.hidden = true;
      goTo(next);
      return;
    }
  }

  combatTurn();
}

function combatTurn() {
  choicesEl.innerHTML = "";
  updateHud();
  updateEnemyBar();

  if (combat.telegraph) {
    log(combat.data.enemy + "이(가) 자세를 낮췄습니다. 큰 공격이 옵니다!", "note");
  }

  let n = 1;
  addChoice("공격한다", () => playerAttack(), n++);
  addChoice("방어한다 (피해 절반, 강공격은 3분의 1)", () => { log("방어 자세를 취합니다."); enemyPhase(true); }, n++);
  addChoice("도망친다 (체력 " + fleeCost() + " 소모)", () => flee(), n++);

  const usable = [...inventory].filter((name) => ITEMS[name] && ITEMS[name].use);
  if (usable.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.style.margin = "0.3rem 0 0";
    p.textContent = "아이템은 위의 소지품에서 바로 사용할 수 있습니다. (한 턴 소모)";
    choicesEl.appendChild(p);
  }
}

function fleeCost() {
  return Math.max(4, combat.data.flee_cost - (stats["신중함"] || 0) * 2);
}

function playerAttack() {
  let dmg = randInt(combat.data.player_attack[0], combat.data.player_attack[1])
          + Math.floor((stats["용기"] || 0) / 3) + equipmentAttack();

  const crit = Math.random() < critChance();
  if (crit) dmg = Math.round(dmg * 1.5);

  combat.enemyHp -= dmg;
  log((crit ? "급소를 찔렀습니다! " : "당신의 공격! ") + combat.data.enemy + "에게 " + dmg + "의 피해.",
      crit ? "good" : "hi");

  if (combat.enemyHp <= 0) { winCombat(); return; }
  enemyPhase(false);
}

function flee() {
  const cost = fleeCost();
  hp = Math.max(0, hp - cost);
  log("등을 돌려 도망칩니다! 체력이 " + cost + " 감소했습니다. (현재 " + hp + "/" + MAX_HP + ")", "bad");
  const next = combat.data.flee_next;
  combat = null;
  enemyEl.hidden = true;
  if (hp <= 0) { goTo("game_over_hp"); return; }
  goTo(next);
}

function winCombat() {
  log(combat.data.enemy + "을(를) 물리쳤습니다!", "good");
  if (combat.data.win_grants) {
    inventory.add(combat.data.win_grants);
    const meta = ITEMS[combat.data.win_grants] || {};
    log("[아이템 획득: " + (meta.icon || "") + " " + combat.data.win_grants + "]", "good");
  }
  if (combat.data.win_flag) flags.add(combat.data.win_flag);
  const next = combat.data.win_next;
  combat = null;
  enemyEl.hidden = true;
  goTo(next);
}

// 적의 턴. defended = 이번 턴에 플레이어가 방어를 선택했는지.
function enemyPhase(defended) {
  if (!combat) return;

  if (combat.enemyHp <= 0) { winCombat(); return; }

  if (combat.skipEnemy) {
    combat.skipEnemy = false;
    updateEnemyBar();
    combatTurn();
    return;
  }

  // 예비 동작 → 다음 턴 강공격
  if (!combat.telegraph && Math.random() < 0.35) {
    combat.telegraph = true;
    log(combat.data.enemy + "이(가) 숨을 고르며 자세를 낮춥니다…", "note");
    updateEnemyBar();
    combatTurn();
    return;
  }

  const heavy = combat.telegraph;
  combat.telegraph = false;

  if (Math.random() < dodgeChance()) {
    log("몸을 틀어 " + combat.data.enemy + "의 공격을 피했습니다!", "good");
    updateEnemyBar();
    combatTurn();
    return;
  }

  let raw = randInt(combat.data.enemy_attack[0], combat.data.enemy_attack[1]);
  if (heavy) raw = Math.round(raw * 1.8);

  let dmg = raw;
  if (defended) dmg = heavy ? Math.round(raw / 3) : Math.floor(raw / 2);

  hp = Math.max(0, hp - dmg);

  if (heavy && defended) {
    log("강공격을 정면으로 받아냈습니다! 피해가 크게 줄어 " + dmg + "의 피해. (현재 " + hp + "/" + MAX_HP + ")", "bad");
  } else if (heavy) {
    log(combat.data.enemy + "의 강공격! " + dmg + "의 큰 피해를 입었습니다. (현재 " + hp + "/" + MAX_HP + ")", "bad");
  } else if (defended) {
    log("공격을 방어했습니다! 피해가 줄어 " + dmg + "의 피해. (현재 " + hp + "/" + MAX_HP + ")", "bad");
  } else {
    log(combat.data.enemy + "의 반격! " + dmg + "의 피해를 입었습니다. (현재 " + hp + "/" + MAX_HP + ")", "bad");
  }

  if (hp <= 0) {
    const next = combat.data.lose_next || "game_over_hp";
    combat = null;
    enemyEl.hidden = true;
    goTo(next);
    return;
  }

  updateEnemyBar();
  combatTurn();
}

/* ---------- 엔딩 ---------- */

function endingKind(node) {
  if (node.gameover) return { label: "☠️ GAME OVER", cls: "over" };
  if (node.good) return { label: "🌟 GOOD ENDING", cls: "good" };
  return { label: "💀 BAD ENDING", cls: "bad" };
}

function showEnding(node) {
  const kind = endingKind(node);

  const title = document.createElement("p");
  title.className = "ending " + kind.cls;
  title.textContent = kind.label + " — " + node.title + "  (" + you() + ")";
  choicesEl.appendChild(title);

  const items = [...inventory].sort();
  const summary = document.createElement("p");
  summary.className = "hint";
  summary.style.textAlign = "center";
  summary.textContent =
    (items.length ? "소지품: " + items.join(", ") : "소지품 없음") +
    "   ·   용기 " + (stats["용기"] || 0) + " / 신중함 " + (stats["신중함"] || 0) +
    (flags.size ? "   ·   " + [...flags].join(", ") : "");
  choicesEl.appendChild(summary);

  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "center";
  row.appendChild(button("다시 도전하기", startNewGame, true));
  row.appendChild(button("엔딩 도감", openCodex));

  const back = document.createElement("a");
  back.className = "btn ghost";
  back.href = "index.html";
  back.textContent = "게임 목록";
  row.appendChild(back);

  choicesEl.appendChild(row);
}

function button(label, onClick, primary) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn" + (primary ? " primary" : " ghost");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

/* ---------- 엔딩 도감 ---------- */

function endingList() {
  return Object.keys(STORY).filter((k) => STORY[k].ending);
}

/* 도감은 예전부터 쓰던 저장 형식(엔딩별 도달 횟수)을 그대로 둔다.
   저장 위치만 공용 기록 레이어를 거치게 해서, 나중에 서버로 옮길 때
   다른 게임과 함께 넘어가게 한다. 그래서 Promise 를 돌려준다. */
function loadCodex() {
  return GameScore.loadBlob(CODEX_KEY, {});
}

function recordEnding(nodeId, node) {
  loadCodex()
    .then((codex) => {
      codex[nodeId] = (codex[nodeId] || 0) + 1;
      return GameScore.saveBlob(CODEX_KEY, codex).then(() => codex);
    })
    .then((codex) => {
      if (codex[nodeId] === 1) log("새로운 엔딩을 발견했습니다 — " + node.title, "good");

      // 기록으로는 "지금까지 본 서로 다른 엔딩 수" 하나만 남긴다.
      const found = endingList().filter((k) => codex[k]).length;
      return GameScore.submit("adventure", { outcome: "", score: found });
    });
}

function openCodex() {
  codexEl.hidden = false;
  codexRateEl.textContent = "불러오는 중…";
  codexGridEl.innerHTML = "";
  loadCodex().then(paintCodex);

  /* 이 게임만 perPlayer 를 켠다.

     다른 게임은 한 판이 한 기록이지만, 여기서는 엔딩을 하나 볼 때마다
     "지금까지 발견한 엔딩 수" 를 새 기록으로 남긴다. 그래서 5 개를 발견한
     사람은 1, 2, 3, 4, 5 다섯 줄을 갖는다. 그대로 줄 세우면 한 사람의
     진행 과정이 순위표를 통째로 차지하므로, 사람마다 한 줄만 올린다. */
  GameRank.paint(document.getElementById("ranking"), "adventure", {
    perPlayer: true,
    title: "엔딩 발견 랭킹",
    note: () => "",
  });
}

function paintCodex(codex) {
  const all = endingList();
  const found = all.filter((k) => codex[k]);

  codexRateEl.textContent =
    "발견 " + found.length + " / " + all.length +
    "  (" + Math.round(found.length / all.length * 100) + "%)";

  codexGridEl.innerHTML = "";
  all.forEach((k) => {
    const node = STORY[k];
    const kind = endingKind(node);
    const seen = !!codex[k];

    const card = document.createElement("div");
    card.className = "codex-card " + (seen ? kind.cls : "unknown");
    card.innerHTML =
      '<span class="codex-kind">' + (seen ? kind.label : "❓ ???") + "</span>" +
      '<span class="codex-title">' + (seen ? node.title : "아직 보지 못한 엔딩") + "</span>" +
      (seen ? '<span class="codex-count">' + codex[k] + "번 도달</span>" : "");
    codexGridEl.appendChild(card);
  });
}

document.getElementById("codex-open").addEventListener("click", openCodex);
document.getElementById("codex-close").addEventListener("click", () => { codexEl.hidden = true; });
codexEl.addEventListener("click", (e) => { if (e.target === codexEl) codexEl.hidden = true; });
/* 예전에는 누르는 즉시 지워졌다. 이제 두 번 눌러야 실행된다.
   도감(엔딩별 도달 횟수)과 판 기록을 함께 지운다 — 도감만 지우면
   랭킹에 "엔딩 5개" 가 그대로 남아 앞뒤가 안 맞는다.
   이어하기 저장(SAVE_KEY)은 건드리지 않는다. 그건 기록이 아니라
   하던 판이라서, 기록을 지웠다고 진행 중인 모험이 날아가면 곤란하다. */
GameReset.wire(document.getElementById("codex-reset"), {
  game: "adventure",
  blobs: [CODEX_KEY],
  label: "기록 초기화",
  onDone: openCodex,
});

/* ---------- 저장 / 이어하기 ---------- */

function saveGame() {
  const data = {
    node: currentNode,
    hp: hp,
    inv: [...inventory],
    stats: stats,
    flags: [...flags],
    time: document.body.dataset.time,
  };
  storage(() => localStorage.setItem(SAVE_KEY, JSON.stringify(data)));
}

function loadSave() {
  return storage(() => JSON.parse(localStorage.getItem(SAVE_KEY) || "null"), null);
}

function clearSave() {
  storage(() => localStorage.removeItem(SAVE_KEY));
}

/* ---------- 시작 화면 ---------- */

function resetState() {
  hp = MAX_HP;
  inventory = new Set();
  stats = { 용기: 0, 신중함: 0 };
  flags = new Set();
  combat = null;
  logEl.innerHTML = "";
  logEl.hidden = true;
  enemyEl.hidden = true;
  document.body.dataset.time = "dusk";
}

function startNewGame() {
  resetState();
  clearSave();
  goTo("start");
}

function continueGame(save) {
  resetState();
  hp = save.hp;
  inventory = new Set(save.inv || []);
  stats = Object.assign({ 용기: 0, 신중함: 0 }, save.stats || {});
  flags = new Set(save.flags || []);
  if (save.time) document.body.dataset.time = save.time;
  goTo(save.node);
}

function showTitle() {
  resetState();
  hudEl.hidden = true;
  invEl.hidden = true;
  choicesEl.innerHTML = "";

  typeText(you() + "님, 해가 저물어 가는 숲의 입구입니다.\n" +
           "당신의 선택과 소지품, 그리고 체력이 이야기의 끝을 바꿉니다.");

  const save = loadSave();
  if (save && STORY[save.node]) {
    const node = STORY[save.node];
    const where = (node.text || "").split("\n")[0].slice(0, 24) + "…";
    addChoice("이어하기  (체력 " + save.hp + " · " + where + ")", () => continueGame(save));
  }
  addChoice("처음부터 시작하기", startNewGame);
  addChoice("엔딩 도감 보기", openCodex);
}

// 허브에서 정한 닉네임. 아직 없으면 기본값.
function you() {
  return (window.GameNick && GameNick.name()) || "플레이어";
}

GameNick.require(showTitle);
