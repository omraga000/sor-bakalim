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

/* ---------- oyun durumu (sayfalar arasında localStorage'da saklanır) ---------- */
const state = (() => {
  try {
    const g = JSON.parse(localStorage.getItem("game"));
    if (g && Array.isArray(g.score) && g.used) return g;
  } catch (e) {}
  return { score: [0, 0], turn: 0, used: {}, msg: "" };
})();
const save = () => { try { localStorage.setItem("game", JSON.stringify(state)); } catch (e) {} };
const usedCount = () => CATS.reduce((n, c) => n + c.items.filter((_, i) => state.used[c.id + "-" + i]).length, 0);

/* ---------- ekran ---------- */
function renderBoard() {
  $("boardGrid").innerHTML = CATS.map(c => `
    <div class="board-column">
      <div class="column-header"><span class="cat-icon">${c.emoji}</span><span class="cat-title">${c.name}</span></div>
      <div class="tiles-container">
        ${c.items.map((it, i) => state.used[c.id + "-" + i]
          ? `<span class="point-tile used">${it.p}</span>`
          : `<a class="point-tile" href="soru.html?c=${encodeURIComponent(c.id)}&i=${i}">${it.p}</a>`
        ).join("")}
      </div>
    </div>`).join("");
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
  save();
  refreshBar();
}

function closeModal() { $("questionModal").style.display = "none"; }

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
  $("lifes" + t).innerHTML =