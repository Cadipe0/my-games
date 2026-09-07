/* ============================================================
   순위 등록 — 오락실 기계처럼.

   판이 끝나면 기록은 늘 저장된다 (전적과 승률이 정확해야 하므로).
   그러고 나서 그 기록이 랭킹 안에 들었을 때만 이름을 받는다.
   실제 오락실도 매판 묻지 않고 TOP 10 에 들었을 때만 묻는다.

       GameScore.submit("omok", {...}).then(function (saved) {
         return GameHighScore.offer("omok", saved, {
           mode: aiLevel, outcome: "win",     // 게임 화면의 랭킹과 같은 조건
         });
       }).then(showRecord);

   돌려주는 Promise 는 이름을 받았든 안 받았든, 화면이 정리된 뒤에 끝난다.
   그래서 부르는 쪽은 .then 에 "기록 다시 그리기" 만 이어 붙이면 된다.

   순위 판정은 서버가 준 랭킹에 내 기록 id 가 있는지로 한다. 점수를 직접
   견주지 않는 이유는 동점 처리(먼저 세운 쪽이 위)와 사람마다 한 줄 같은
   규칙이 서버에 있어서다. 서버가 정한 순위를 그대로 믿는 게 어긋나지 않는다.
   ============================================================ */

(function () {
  const LIMIT = 10;

  // 이름을 남기지 않기로 했을 때 랭킹에 적히는 이름
  const ANON = "익명";

  /* 저장된 기록이 랭킹 몇 위인지. 안 들었으면 0. */
  function rankOf(game, saved, opts) {
    const o = opts || {};
    return GameScore.ranking(game, {
      mode: o.mode,
      outcome: o.outcome,
      perPlayer: o.perPlayer,
      limit: o.limit || LIMIT,
    }).then(function (rows) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === saved.id) return rows[i].rank;
      }
      return 0;
    });
  }

  // 기록의 이름만 바꿔 다시 저장한다. 같은 id 라서 덮어쓰기가 된다.
  function rename(game, saved, nickname) {
    const next = {};
    for (const k in saved) next[k] = saved[k];
    next.nickname = nickname;
    return GameScore.submit(game, next);
  }

  function ordinal(rank) {
    return rank + "위";
  }

  /* 순위에 들었으면 이름을 받는다. 안 들었으면 아무 일도 하지 않는다.
     opts: { mode, outcome, perPlayer, limit, what } */
  function offer(game, saved, opts) {
    const o = opts || {};

    // 점수가 없는 기록(진 판 등)은 애초에 순위 후보가 아니다
    if (!saved || typeof saved.score !== "number") return Promise.resolve(null);
    if (!GameNick || !GameNick.ask) return Promise.resolve(null);

    return rankOf(game, saved, o).then(function (rank) {
      if (rank === 0) return null;   // 순위 밖 — 조용히 넘어간다

      return new Promise(function (done) {
        GameNick.ask(
          function (name) { rename(game, saved, name).then(function () { done(rank); }); },
          {
            title: "🏆 " + ordinal(rank) + "! 이름을 남기시겠습니까?",
            hint: (o.what || "이 기록") + "이 랭킹 " + ordinal(rank) + "에 올랐습니다.",
            okText: "남기기",
            cancel: true,
            cancelText: "안 함",
            // 안 남기겠다는 것도 결정이다. 랭킹에는 "익명" 으로 남는다.
            onCancel: function () { rename(game, saved, ANON).then(function () { done(0); }); },
          },
        );
      });
    });
  }

  window.GameHighScore = { offer: offer, rankOf: rankOf, LIMIT: LIMIT, ANON: ANON };
})();
