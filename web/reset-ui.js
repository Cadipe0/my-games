/* ============================================================
   기록 초기화 버튼 — 모든 게임이 함께 쓴다.

   실수로 지우는 일이 없도록 두 번 눌러야 실행된다. 이 프로젝트가 이미
   쓰는 방식이다 (티카투카의 "포기" 버튼). 첫 클릭에서 빨갛게 바뀌고,
   그대로 두면 잠시 뒤 저절로 원래대로 돌아간다.

       GameReset.attach(자리, {
         game: "omok",                  // 지울 게임 기록
         blobs: ["lostforest.codex"],   // 함께 지울 통짜 저장값 (없으면 생략)
         onDone: showRecord,            // 지운 뒤 화면 다시 그리기
       });

   이미 있는 버튼에 동작만 걸려면 GameReset.wire(버튼, {...}) 를 쓴다.

   확인 문구는 기본이 "철수님의 기록을 삭제합니다" 다. confirmLabel 에
   문자열이나 함수를 주면 바꿀 수 있다 (함수는 누를 때마다 불린다).

   지울 때는 서버와 브라우저 저장소를 둘 다 지운다. 서버가 꺼져 있던
   동안의 기록은 브라우저에 남아 있어서(scores.js 의 폴백), 서버만 지우면
   그게 되살아나 보이기 때문이다.
   ============================================================ */

(function () {
  const ARM_MS = 4000;    // 이 시간 안에 다시 누르지 않으면 없던 일이 된다
  const DONE_MS = 1600;   // "초기화했습니다" 를 띄워 두는 시간

  /* 확인 문구에 쓸 주어. "무엇이 지워지는가" 를 분명히 하려는 것이다.

     지우는 범위는 서버에서 player_id 로 갈린다. 그런데 로그인이 없어서
     player_id 는 이 브라우저에 들어 있고, 한 브라우저를 여럿이 쓰면 그
     모두가 한 사람이 된다. 그래서 이름을 아직 정하지 않았으면 사람이
     아니라 "이 브라우저" 라고 적는다 — 실제로 지워지는 단위가 그것이다. */
  function who() {
    const n = (window.GameNick && GameNick.get()) || "";
    return n ? n + "님의" : "이 브라우저의";
  }

  function games(opts) {
    if (opts.games) return opts.games;
    return opts.game ? [opts.game] : [];
  }

  function wipe(opts) {
    const jobs = [];

    games(opts).forEach(function (g) {
      jobs.push(GameScore.clear(g));
      jobs.push(GameScore.LocalBackend.clear(g));
    });

    (opts.blobs || []).forEach(function (k) {
      jobs.push(GameScore.removeBlob(k));
      jobs.push(GameScore.LocalBackend.removeBlob(k));
    });

    return Promise.all(jobs);
  }

  /* 이미 화면에 있는 버튼에 "두 번 눌러 초기화" 동작을 건다. */
  function wire(btn, opts) {
    if (!btn) return btn;
    const o = opts || {};
    const label = o.label || "기록 초기화";

    let armed = false;
    let timer = null;

    function disarm() {
      armed = false;
      if (timer) { clearTimeout(timer); timer = null; }
      btn.textContent = label;
      btn.classList.remove("armed");
    }

    /* 문구는 누를 때마다 새로 만든다. 순위에 들어 방금 이름을 남겼다면
       그 이름이 바로 반영돼야 한다 (highscore.js). */
    function confirmText() {
      if (typeof o.confirmLabel === "function") return o.confirmLabel();
      if (o.confirmLabel) return o.confirmLabel;
      return who() + " 기록을 삭제합니다";
    }

    function arm() {
      armed = true;
      btn.textContent = confirmText();
      btn.classList.add("armed");
      timer = setTimeout(disarm, ARM_MS);
    }

    btn.classList.add("btn", "danger");
    btn.textContent = label;

    btn.addEventListener("click", function () {
      if (btn.disabled) return;

      if (!armed) { arm(); return; }   // 첫 클릭 — 아직 지우지 않는다

      if (timer) { clearTimeout(timer); timer = null; }
      armed = false;
      btn.classList.remove("armed");
      btn.disabled = true;
      btn.textContent = "지우는 중…";

      wipe(o).then(function () {
        btn.textContent = "초기화했습니다";
        // 지운 뒤의 화면을 다시 그린다 (전적 · 랭킹 · 배지)
        if (o.onDone) { try { o.onDone(); } catch (e) { /* 화면 갱신 실패로 버튼이 멈추면 안 된다 */ } }
        setTimeout(function () { btn.disabled = false; disarm(); }, DONE_MS);
      });
    });

    // 다른 곳을 누르면 겨눈 상태를 푼다 — 눌러 둔 채 잊고 있다가 실수하는 걸 막는다
    document.addEventListener("click", function (e) {
      if (armed && e.target !== btn) disarm();
    });

    return btn;
  }

  /* 버튼을 만들어 자리에 넣는다. */
  function attach(container, opts) {
    if (!container) return null;
    const o = opts || {};

    const row = document.createElement("div");
    row.className = "reset-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("small");
    row.appendChild(btn);

    container.appendChild(row);
    return wire(btn, o);
  }

  window.GameReset = { attach: attach, wire: wire, wipe: wipe, who: who };
})();
