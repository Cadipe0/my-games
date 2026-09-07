/* ============================================================
   랭킹 표 — 모든 게임이 함께 쓴다.

   기록을 어디서 가져올지는 scores.js 가 정하고, 여기서는 그리기만 한다.
   게임마다 자랑거리가 다르므로(오목은 "30수", 블랙잭은 "12라운드")
   줄 오른쪽에 붙는 설명만 게임이 넘겨 준다.

       GameRank.paint(엘리먼트, "omok", {
         mode: "hard", outcome: "win",
         title: "어려움 랭킹",
         note: (r) => r.detail.moves + "수",
       });

   서버가 없으면(브라우저 저장소만 쓸 때) 남의 기록이 없으므로 빈 목록이
   온다. 그때는 표 자체를 감춘다 — 아무도 없는 순위표는 볼 이유가 없다.
   ============================================================ */

(function () {
  const MEDAL = ["gold", "silver", "bronze"];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function row(r, note) {
    const li = el("li", "rank-row" + (r.mine ? " is-mine" : ""));

    const no = el("span", "rank-no", r.rank);
    if (r.rank <= 3) no.classList.add(MEDAL[r.rank - 1]);
    li.appendChild(no);

    li.appendChild(el("span", "rank-nick", r.nickname));

    // 게임이 넘긴 한마디. 없으면 그 자리는 비워 둔다 (칸은 유지해서 줄이 안 흔들린다)
    let text = "";
    if (note) { try { text = note(r) || ""; } catch (e) { text = ""; } }
    li.appendChild(el("span", "rank-note", text));

    li.appendChild(el("span", "rank-score", r.score));
    return li;
  }

  /* 랭킹을 el 안에 그린다. 부를 때마다 안을 비우고 새로 그리므로
     같은 자리에 몇 번이든 다시 그릴 수 있다 (난이도를 바꿀 때처럼).

     opts: { mode, outcome, limit, perPlayer, order, title, note, emptyText }
     기록이 하나도 없으면 기본은 표를 감추는 것이다. emptyText 를 주면
     대신 그 문구를 띄운다 — 랭킹 페이지처럼 자리가 비면 이상해 보이는
     곳에서 쓴다.
     돌려주는 Promise 는 다 그린 뒤에 끝난다 (테스트와 순서 맞추기용). */
  function paint(target, game, opts) {
    if (!target) return Promise.resolve();
    const o = opts || {};

    target.innerHTML = "";
    target.hidden = true;

    return GameScore.ranking(game, o).then(function (rows) {
      const empty = !rows || rows.length === 0;
      if (empty && !o.emptyText) return;   // 아무도 없으면 표를 띄우지 않는다

      const box = el("div", "rank-box");
      box.appendChild(el("h3", "rank-title", o.title || "랭킹"));

      if (empty) {
        box.appendChild(el("p", "rank-empty", o.emptyText));
      } else {
        const list = el("ol", "rank-list");
        rows.forEach(function (r) { list.appendChild(row(r, o.note)); });
        box.appendChild(list);
      }

      target.appendChild(box);
      target.hidden = false;
    });
  }

  window.GameRank = { paint: paint };
})();
