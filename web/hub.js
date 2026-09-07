/* 허브 — 게임 목록과 각 게임의 내 최고 기록.

   이름은 여기서 묻지 않는다. 오락실 기계처럼 순위에 들었을 때 그 자리에서
   받는다 (highscore.js). 미리 정해 두고 싶은 사람을 위해 버튼만 남겨 둔다. */

(function () {
  const greetEl = document.getElementById("hub-greet");
  const renameBtn = document.getElementById("hub-rename");

  function paint() {
    const n = GameNick.get();
    greetEl.textContent = n
      ? "안녕하세요, " + n + "님. 하고 싶은 게임을 골라주세요."
      : "하고 싶은 게임을 골라주세요. 순위에 들면 이름을 남길 수 있습니다.";
    // 아직 이름이 없으면 "정하기", 있으면 "바꾸기" — 버튼은 늘 보인다
    renameBtn.textContent = n ? "이름 바꾸기" : "이름 정하기";
  }

  /* 카드에 붙는 최고 기록 한 줄.
     게임마다 자랑거리가 달라서 문구도 따로 만든다.
     기록이 없으면 빈 문자열을 돌려주고, 그러면 줄이 나타나지 않는다. */
  const BADGE = {
    omok: function () {
      return GameScore.best("omok", { outcome: "win" }).then(function (b) {
        return b ? "최고 " + b.score + "점 · " + b.detail.difficulty + " " +
                   b.detail.moves + "수" : "";
      });
    },

    blackjack: function () {
      // 이긴 세션만 자랑거리다 (점수에 최종 칩이 들어 있어 파산은 0 대다)
      return GameScore.best("blackjack", { outcome: "win" }).then(function (b) {
        return b ? "최고 " + b.score + "점 · " + b.detail.difficulty +
                   " 승리 · 승률 " + b.detail.winRate + "%" : "";
      });
    },

    tikatuka: function () {
      return GameScore.best("tikatuka").then(function (b) {
        return b ? "최고 " + b.score + "연승 · " + b.detail.round + "판 도달" : "";
      });
    },

    number: function () {
      return GameScore.best("number", { outcome: "win" }).then(function (b) {
        return b ? "최고 " + b.score + "점 · " + b.detail.difficulty + " " +
                   b.detail.tries + "번 만에" : "";
      });
    },

    adventure: function () {
      return GameScore.best("adventure").then(function (b) {
        return b ? "엔딩 " + b.score + "개 발견" : "";
      });
    },

    /* 퍼즐은 자기만의 통계 형식을 그대로 쓴다. 저장 위치가 같으므로
       여기서도 같은 통로로 읽는다. */
    puzzle: function () {
      return GameScore.loadBlob("puzzle:stats:v1", {}).then(function (table) {
        const t = table || {};
        const cleared = Object.keys(t).filter(function (k) {
          return k !== "endless" && (t[k].cleared || 0) > 0;
        }).length;
        const bestRound = (t.endless && t.endless.bestRound) || 0;

        const parts = [];
        if (cleared > 0) parts.push(cleared + "단계 클리어");
        if (bestRound > 0) parts.push("무한 " + bestRound + "라운드");
        return parts.join(" · ");
      });
    },
  };

  function paintBadges() {
    [].slice.call(document.querySelectorAll(".game-card")).forEach(function (card) {
      const key = card.getAttribute("data-game");
      const slot = card.querySelector(".card-record");
      if (!key || !slot || !BADGE[key]) return;

      BADGE[key]().then(function (text) {
        slot.textContent = text;
        slot.hidden = !text;
      });
    });
  }

  renameBtn.addEventListener("click", function () {
    const has = !!GameNick.get();
    GameNick.ask(paint, {
      title: has ? "닉네임 바꾸기" : "닉네임 정하기",
      okText: "저장",
      cancel: true,
    });
  });

  /* 게임마다 돌아다니지 않고 여기서 한 번에 지운다. 게임별 버튼과 같은
     것을 지우므로 목록이 어긋나지 않게 한곳에 적어 둔다.

     닉네임은 지우지 않는다 — 기록이 아니라 사람이고, 지우면 다음에 들어올
     때 이름부터 다시 물어보게 된다.
     어드벤처의 이어하기 저장도 그대로 둔다. 하던 판이지 기록이 아니다. */
  GameReset.wire(document.getElementById("hub-reset"), {
    games: ["omok", "blackjack", "tikatuka", "number", "adventure", "puzzle"],
    blobs: ["lostforest.codex", "puzzle:stats:v1"],
    label: "전체 기록 초기화",
    // "전부" 가 남의 기록까지가 아니라 내 것 전부라는 뜻임을 분명히 한다
    confirmLabel: function () { return GameReset.who() + " 기록을 전부 삭제합니다"; },
    onDone: paintBadges,
  });

  paint();
  paintBadges();
})();
