const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const LIFE = {
  double: { icon: "✌️", name: "Cevabı İkiye Katla" },
  call:   { icon: "📞", name: "Telefonla Joker" },
  pit:    { icon: "💣", name: "Çukur" },
  rest:   { icon: "😴", name: "Dinlen" },
  trap:   { icon: "🪤", name: "Tuzak" }
};

/* ---------- ayarlar (index.html'den gelir) ---------- */
let setup = {};
try { setup = JSON.parse(localStorage.getItem("setup")) || {}; } catch (e) {}

let ids = Array.isArray(setup.cats) ? setup.cats.filter(id => QUESTIONS[id]) : [];
if (ids.length < 2) ids = Object.keys(QUESTIONS).slice(0, 6);   // doğrudan game.html açılırsa
const CATS = ids.map(id => ({ id, ...QUESTIONS[id] }));
const NAMES = [setup.team1 || "Birinci Takım", setup.team2 || "İkinci Takım"];
const TOTAL = CATS.reduce((n, c) => n + c.items.length, 0);

const state = { score: [0, 0], turn: 0, used: {}, cur: null };

/* ---------- ekran ---------- */
function renderBoard() {
  $("boardGrid").innerHTML = CATS.map(c => `
    <div class="board-column">
      <div class="column-header"><span class="cat-icon">${c.emoji}</span><span class="cat-title">${c.name}</span></div>
      <div class="tiles-container">
        ${c.items.map((it, i) => {
          const used = state.used[c.id + "-" + i];
          return `<button class="point-tile ${used ? "used" : ""}" data-c="${c.id}" data-i="${i}" ${used ? "disabled" : ""}>${it.p}</button>`;
        }).join("")}
      </div>
    </div>`).join("");
  document.querySelectorAll(".point-tile").forEach(b => {
    b.onclick = () => openQuestion(b.dataset.c, +b.dataset.i);
  });
}

function refreshBar() {
  $("score1").textContent = state.score[0];
  $("score2").textContent = state.score[1];
  $("currentTurnBadge").textContent = "Sıra: " + NAMES[state.turn];
  document.querySelector(".team-one").classList.toggle("turn", state.turn === 0);
  document.querySelector(".team-two").classList.toggle("turn", state.turn === 1);
}

function adjust(team, delta) {               // + / - düğmeleri (elle düzeltme)
  state.score[team] = Math.max(0, state.score[team] + delta);
  refreshBar();
}

/* ---------- tur akışı ---------- */
function openQuestion(catId, i) {
  const cat = CATS.find(c => c.id === catId);
  const it = cat.items[i];
  state.cur = { cat, i, q: it.q, a: it.a, pts: it.p, step: 0, ok: [null, null] };
  $("questionModal").style.display = "flex";
  renderStep();
}

function head() {
  const c = state.cur;
  return `<h3>${esc(c.cat.name)}</h3>
    <div class="modal-points">${c.pts} Puan · Soruyu seçen: ${esc(NAMES[state.turn])}</div>
    <div class="modal-question-text">${esc(c.q)}</div>`;
}

function renderStep() {
  const c = state.cur, card = $("modalCard");

  if (c.step === 0) {                         // 1. adım: soru sorulur, takımlar kendi aralarında cevaplar
    card.innerHTML = head() + `
      <p class="hint">Takımlar cevabını sesli söylesin. Hazır olunca cevabı göster.</p>
      <div class="row-btns">
        <button class="modal-close-btn" id="cancelBtn">Vazgeç</button>
        <button class="primary-btn" id="showBtn">Cevabı göster</button>
      </div>`;
    $("showBtn").onclick = () => { c.step = 1; renderStep(); };
    $("cancelBtn").onclick = closeModal;
    return;
  }

  card.innerHTML = head() + `                  <!-- 2. adım: doğru cevap açılır -->
    <div class="reveal">Doğru cevap: <strong>${esc(c.a)}</strong></div>
    <div class="review">
      ${[0, 1].map(t => `
        <div class="review-row">
          <div class="review-who"><b>${esc(NAMES[t])}</b></div>
          <div class="mark-btns">
            <button class="mark ok" data-t="${t}" data-v="1">Doğru</button>
            <button class="mark no" data-t="${t}" data-v="0">Yanlış</button>
          </div>
        </div>`).join("")}
    </div>
    <p class="hint">İki takım da doğruysa puanı soruyu seçen takım alır. İki takım da yanlışsa kimse puan almaz.</p>
    <div class="row-btns"><button class="primary-btn" id="applyBtn" disabled>Sonucu uygula</button></div>`;

  document.querySelectorAll(".mark").forEach(b => {
    b.onclick = () => {
      const t = +b.dataset.t;
      c.ok[t] = b.dataset.v === "1";
      document.querySelectorAll(`.mark[data-t="${t}"]`).forEach(x => x.classList.toggle("sel", x === b));
      $("applyBtn").disabled = c.ok[0] === null || c.ok[1] === null;
    };
  });
  $("applyBtn").onclick = applyResult;
}

function applyResult() {
  const c = state.cur, owner = state.turn;
  const [ok1, ok2] = c.ok;
  let winner = -1;
  if (ok1 && ok2) winner = owner;            // ikisi de doğru → sırası gelen takım
  else if (ok1) winner = 0;
  else if (ok2) winner = 1;                  // ikisi de yanlış → kimse puan almaz

  if (winner >= 0) state.score[winner] += c.pts;
  state.used[c.cat.id + "-" + c.i] = 1;
  state.turn = 1 - state.turn;               // her sorudan sonra sıra değişir

  $("gameStatusMsg").textContent = winner >= 0
    ? NAMES[winner] + " " + c.pts + " puan kazandı! 🎉"
    : "İki takım da bilemedi. Puan yok, sıra değişti.";

  state.cur = null;
  $("questionModal").style.display = "none";
  renderBoard();
  refreshBar();
  if (Object.keys(state.used).length === TOTAL) finishGame();
}

function closeModal() {                       // Vazgeç: soru yanmaz
  state.cur = null;
  $("questionModal").style.display = "none";
}

function finishGame() {
  const [a, b] = state.score;
  const result = a === b ? "Berabere! 🤝" : "Kazanan: " + NAMES[a > b ? 0 : 1] + " 🏆";
  $("modalCard").innerHTML = `
    <h3>Oyun sonucu</h3>
    <div class="final-scores">
      <div>${esc(NAMES[0])}<b>${a}</b></div>
      <div>${esc(NAMES[1])}<b>${b}</b></div>
    </div>
    <div class="reveal">${result}</div>
    <div class="row-btns">
      <button class="modal-close-btn" id="backBtn">Oyuna dön</button>
      <button class="primary-btn" id="homeBtn">Ana sayfa</button>
    </div>`;
  $("backBtn").onclick = closeModal;
  $("homeBtn").onclick = () => { location.href = "index.html"; };
  $("questionModal").style.display = "flex";
}

/* ---------- başlangıç ---------- */
$("roomTitle").textContent = "Sor Bakalım - " + (setup.gameName || "Özel Maç");
$("displayTeam1").textContent = NAMES[0];
$("displayTeam2").textContent = NAMES[1];
[1, 2].forEach(t => {
  const list = (setup.lifelines && setup.lifelines[t]) || [];
  $("lifes" + t).innerHTML = list.filter(k => LIFE[k])
    .map(k => `<span class="lifeline-icon" title="${LIFE[k].name}">${LIFE[k].icon}</span>`).join("");
});
renderBoard();
refreshBar();

window.addEventListener("load", () => {
  const l = $("loadingScreen");
  setTimeout(() => { l.style.opacity = "0"; setTimeout(() => { l.style.display = "none"; }, 500); }, 800);
});