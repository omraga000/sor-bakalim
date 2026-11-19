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

/* ---------- oyun durumu ---------- */
const state = (() => {
  try {
    const g = JSON.parse(localStorage.getItem("game"));
    if (g && Array.isArray(g.score) && g.used) return g;
  } catch (e) {}
  return { score: [0, 0], turn: 0, used: {}, msg: "" };
})();
const save = () => { try { localStorage.setItem("game", JSON.stringify(state)); } catch (e) {} };
const usedCount = () => CATS.reduce((n, c) => n + c.items.filter((_, i) => state.used[c.id + "-" + i]).length, 0);

// İlk açılışta state'i kaydet (soru.html 'game' null hatası alıp geri dönmesin)
save();

/* ---------- ekran render ---------- */
function renderBoard() {
  if (!CATS || CATS.length === 0) {
    $("boardGrid").innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; color: var(--text-main, #241812);">
        <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 700;">Aktif Soru Tahtası Bulunamadı</h2>
        <p style="color: var(--text-muted, #635147); font-size: 1rem; max-width: 480px; margin: 0 auto 1.5rem;">
          Seçilen kategorilere ait soru bulunamadı. Lütfen ana sayfadan kategori seçerek yeni bir oyun başlatın.
        </p>
        <a href="index.html" class="primary-btn" style="display:inline-block; text-decoration: none;">
          Ana Sayfaya Dön
        </a>
      </div>
    `;
    return;
  }
  $("boardGrid").innerHTML = CATS.map(c => `
    <div class="board-column">
      <div class="column-header"><span class="cat-icon">${c.emoji}</span><span class="cat-title">${c.name}</span></div>
      <div class="tiles-container">
        ${(c.items || []).map((it, i) => state.used[c.id + "-" + i]
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
  const result = a === b ? "Berabere!" : "Kazanan: " + NAMES[a > b ? 0 : 1] + "";
  $("modalCard").innerHTML = `
    <h3>Oyun Sonucu</h3>
    <div class="final-scores">
      <div>${esc(NAMES[0])}<b>${a}</b></div>
      <div>${esc(NAMES[1])}<b>${b}</b></div>
    </div>
    <div class="reveal">${result}</div>
    <div class="row-btns">
      <button class="modal-close-btn" id="backBtn">Oyuna Dön</button>
      <button class="primary-btn" id="homeBtn">Ana Sayfa</button>
    </div>`;
  $("backBtn").onclick = closeModal;
  $("homeBtn").onclick = () => { location.href = "index.html"; };
  $("questionModal").style.display = "flex";
}

/* ---------- Başlangıç ---------- */
$("roomTitle").textContent = "Sor Bakalım - " + (setup.gameName || "Özel Maç");
$("displayTeam1").textContent = NAMES[0];
$("displayTeam2").textContent = NAMES[1];

[1, 2].forEach(t => {
  const list = (setup.lifelines && setup.lifelines[t]) || [];
  $("lifes" + t).innerHTML = list.filter(k => LIFE[k])
    .map(k => `<span class="lifeline-icon" title="${LIFE[k].name}">${LIFE[k].icon}</span>`).join("");
});

if (state.msg && $("gameStatusMsg")) {
  $("gameStatusMsg").textContent = state.msg;
}

renderBoard();
refreshBar();

// Yükleme ekranını kaldır
const loader = $("loadingScreen");
if (loader) {
  loader.style.opacity = "0";
  setTimeout(() => { loader.style.display = "none"; }, 500);
}

// Oyunu bitir parametresi veya tüm soruların bitmesi kontrolü
const params = new URLSearchParams(location.search);
if (params.get("finish") === "1" || (TOTAL > 0 && usedCount() === TOTAL)) {
  finishGame();
}