/* ============================================================
   닉네임 — 모든 게임이 함께 쓴다.

   게임을 시작할 때는 이름을 묻지 않는다. 오락실 기계처럼, 순위에 들었을
   때 그 자리에서 받는다 (highscore.js). 그렇게 한 번 받은 이름은
   브라우저(localStorage)에 남아서 다음부터 게임 안 문장에도 쓰이고,
   다음 순위 등록 화면에도 미리 채워진다.

   아직 이름을 정하지 않았으면 name() 이 "플레이어" 를 돌려준다.
   허브의 "이름 정하기 / 바꾸기" 로 미리 정해 둘 수도 있다.
   ============================================================ */

(function () {
  const KEY = "gm:nickname";
  const MAX = 12;
  const FALLBACK = "플레이어";

  let cached = null;   // 아직 안 읽었으면 null

  function read() {
    try { return (localStorage.getItem(KEY) || "").trim(); } catch (e) { return ""; }
  }

  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* 저장이 막혀도 이번 판은 그대로 쓴다 */ }
  }

  // 저장된 이름. 아직 정하지 않았으면 빈 문자열.
  function get() {
    if (cached === null) cached = read();
    return cached;
  }

  // 화면에 쓸 이름. 어떤 이유로든 비어 있으면 기본값으로 대신한다.
  function name() {
    return get() || FALLBACK;
  }

  function clean(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, MAX);
  }

  /* 닉네임 화면을 띄운다.
     onDone(이름) — 확정했을 때만 부른다
     opts.title / opts.hint / opts.okText / opts.cancelText / opts.cancel
     opts.onCancel — 취소를 눌렀을 때. 순위 등록처럼 "안 남기겠다" 는
       선택도 결과인 경우에 쓴다 (highscore.js). */
  function ask(onDone, opts) {
    const o = opts || {};

    const wrap = document.createElement("div");
    wrap.className = "nick-overlay";
    wrap.innerHTML =
      '<div class="nick-box">' +
        '<h2 class="nick-title"></h2>' +
        '<p class="hint nick-hint"></p>' +
        '<input class="nick-input" type="text" autocomplete="off" spellcheck="false" />' +
        '<p class="nick-error" hidden></p>' +
        '<div class="row nick-actions"></div>' +
      "</div>";

    wrap.querySelector(".nick-title").textContent = o.title || "닉네임을 정해주세요";
    wrap.querySelector(".nick-hint").textContent =
      o.hint || ("게임 안에서 이 이름으로 불립니다. 1~" + MAX + "자.");

    const input = wrap.querySelector(".nick-input");
    input.maxLength = MAX;
    input.placeholder = FALLBACK;
    input.value = get();

    const err = wrap.querySelector(".nick-error");
    const actions = wrap.querySelector(".nick-actions");

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn primary";
    okBtn.textContent = o.okText || "시작";
    actions.appendChild(okBtn);

    if (o.cancel) {
      const noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "btn ghost";
      noBtn.textContent = o.cancelText || "취소";
      noBtn.addEventListener("click", function () {
        close();
        if (o.onCancel) o.onCancel();
      });
      actions.appendChild(noBtn);
    }

    document.body.appendChild(wrap);
    input.focus();
    input.select();

    function close() {
      wrap.remove();
    }

    function confirm() {
      const v = clean(input.value);
      if (!v) {
        err.hidden = false;
        err.textContent = "이름을 한 글자 이상 적어주세요.";
        input.focus();
        return;
      }
      cached = v;
      write(v);
      close();
      if (onDone) onDone(v);
    }

    okBtn.addEventListener("click", confirm);
    input.addEventListener("input", function () { err.hidden = true; });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); confirm(); }
    });
  }

  /* 게임을 띄운다. 예전에는 이름이 없으면 여기서 먼저 물었지만, 이제는
     묻지 않고 바로 시작한다 — 오락실 기계처럼 순위에 들었을 때 받는다.

     각 게임이 이 함수로 시작 코드를 감싸고 있어서 이름은 그대로 둔다.
     부르는 쪽을 다 고치는 것보다, 이 한 곳의 뜻을 바꾸는 게 낫다. */
  function require(onReady) {
    onReady(name());
  }

  window.GameNick = { get: get, name: name, ask: ask, require: require, clean: clean, MAX: MAX };
})();
