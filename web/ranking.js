/* ============================================================
   랭킹 페이지 — 모든 게임의 상위 10위를 한자리에.

   게임마다 무엇으로 줄을 세우는 게 옳은지가 달라서, 그 판단만 여기에
   표로 모아 둔다. 실제로 그리는 일은 ranking-ui.js 가 한다.
   ============================================================ */

(function () {
  const gridEl = document.getElementById("rank-grid");
  const introEl = document.getElementById("rank-intro");

  /* 게임별 줄 세우기 기준.
     outcome 을 win 으로 묶는 게임들은 진 판에 0 점을 주기 때문이다 —
     안 걸러내면 0 점 줄만 쌓인다. */
  const BOARDS = [
    {
      game: "omok",
      title: "⚫ 오목",
      opts: { outcome: "win", note: (r) => r.detail.difficulty + " · " + r.detail.moves + "수" },
    },
    {
      game: "blackjack",
      title: "🃏 블랙잭 — 딜러 파산",
      opts: { outcome: "win", note: (r) => r.detail.difficulty + " · 승률 " + r.detail.winRate + "%" },
    },
    {
      game: "tikatuka",
      title: "🎲 티카투카 — 도달 판 수",
      opts: { note: (r) => r.detail.bestStreak + "연승" },
    },
    {
      game: "number",
      title: "🔢 숫자 맞추기",
      opts: { outcome: "win", note: (r) => r.detail.difficulty + " · " + r.detail.tries + "번 만에" },
    },
    {
      /* 이 게임만 사람마다 한 줄이다. 엔딩을 볼 때마다 "지금까지 발견한
         수" 를 새 기록으로 남겨서, 그대로 세우면 한 사람의 1, 2, 3, 4, 5 개가
         순위표를 통째로 차지한다. */
      game: "adventure",
      title: "🌲 텍스트 게임 — 발견한 엔딩",
      opts: { perPlayer: true, note: () => "" },
    },
    {
      /* 퍼즐은 단계마다 소환 예산과 등급 기준이 달라서 섞어 세우면 안 된다.
         여기서는 무한모드만 싣는다 — "몇 라운드까지 갔나" 는 단계와 무관한
         하나의 잣대라 사람끼리 그대로 견줄 수 있다.
         단계별 랭킹은 퍼즐 화면 안에서 볼 일이다. */
      game: "puzzle",
      title: "🗿 석판 부수기 — 무한모드 라운드",
      opts: { mode: "endless", note: () => "" },
    },
  ];

  BOARDS.forEach(function (b) {
    const slot = document.createElement("div");
    gridEl.appendChild(slot);

    const opts = Object.assign({ limit: 10, emptyText: "아직 기록이 없습니다." },
                               b.opts, { title: b.title });
    GameRank.paint(slot, b.game, opts);
  });

  // 서버 없이 열면(파일을 직접 열었거나 서버가 꺼져 있으면) 랭킹이 있을 수 없다.
  if (GameScore.backend().name !== "server") {
    introEl.textContent = "랭킹은 서버가 켜져 있을 때만 볼 수 있습니다.";
  }
})();
