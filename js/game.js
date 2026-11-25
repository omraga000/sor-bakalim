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

function getActiveQuestionsMap() {
  if (window.QUESTIONS && Object.keys(window.QUESTIONS).length > 0) {
    return window.QUESTIONS;
  }
  if (Array.isArray(setup.categoriesData) && setup.categoriesData.length > 0) {
    const map = {};
    setup.categoriesData.forEach(c => {
      if (c && c.id) map[c.id] = c;
    });
    return map;
  }
  if (window.SorBakalimData && typeof window.SorBakalimData.getCategories === 'function') {
    const cats = window.SorBakalimData.getCategories();
    const qs = window.SorBakalimData.getQuestions();
    if (typeof buildQuestionsMap === 'function') {
      return buildQuestionsMap(cats, qs);
    }
  }
  return window.QUESTIONS || {};
}

const MAX_CATEGORIES = 6;

let qMap = getActiveQuestionsMap();
let ids = Array.isArray(setup.cats) ? setup.cats.filter(id => qMap[id]).slice(0, MAX_CATEGORIES) : [];
if (ids.length < 2) ids = Object.keys(qMap).slice(0, MAX_CATEGORIES);
let CATS = ids.map(id => ({ id, ...qMap[id] }));
const NAMES = [setup.team1 || "Birinci Takım", setup.team2 || "İkinci Takım"];
let TOTAL = CATS.reduce((n, c) => n + ((c && c.items) ? c.items.length : 0), 0);

function updateGameCategories() {
  const currentQ = getActiveQuestionsMap();
  ids = Array.isArray(setup.cats) ? setup.cats.filter(id => currentQ[id]).slice(0, MAX_CATEGORIES) : [];
  if (ids.length < 2) ids = Object.keys(currentQ).slice(0, MAX_CATEGORIES);
  CATS = ids.map(id => ({ id, ...currentQ[id] }));
  TOTAL = CATS.reduce((n, c) => n + ((c && c.items) ? c.items.length : 0), 0);
  renderBoard();
}

// Supabase Canlı Senkronizasyon Olayı (Buluttan yeni soru/kategori gelirse tahtayı güncelle)
window.addEventListener('sorBakalimDataSynced', () => {
  updateGameCategories();
});

// game.html açıldığında Supabase'den kategorileri doğrula ve eşitle
if (window.SorBakalimData && typeof window.SorBakalimData.loadGlobalCategories === 'function') {
  window.SorBakalimData.loadGlobalCategories().then(res => {
    if (res && res.categories && res.categories.length > 0) {
      updateGameCategories();
    }
  }).catch(() => {});
}

/* ---------- oyun durumu ---------- */
const state = (() => {
  try {
    const g = JSON.parse(localStorage.getItem("game"));
    if (g && Array.isArray(g.score) && g.used) return g;
  } catch (e) {}
  return { score: [0, 0], turn: 0, used: {}, msg: "" };
})();

/* ---------- Otomatik Oyun Kaydı (Oyunlarım Kütüphanesi) ---------- */
function saveMatchSnapshot(forceCompleted = false) {
  try {
    if (!setup.matchId) {
      setup.matchId = "match_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      try { localStorage.setItem("setup", JSON.stringify(setup)); } catch (_) {}
    }

    const answered = usedCount();
    const isCompleted = forceCompleted || (TOTAL > 0 && answered === TOTAL);

    // Aktif kullanıcıyı al (Supabase oturumu veya misafir)
    let userId = "guest";
    let userEmail = "guest";
    try {
      const sbToken = localStorage.getItem("sb-fzxrqvobatablbtssggo-auth-token");
      if (sbToken) {
        const parsed = JSON.parse(sbToken);
        if (parsed && parsed.user) {
          userId = parsed.user.id || "guest";
          userEmail = parsed.user.email || "guest";
        }
      }
    } catch (_) {}

    const snapshot = {
      id: setup.matchId,
      userId: userId,
      userEmail: userEmail,
      gameName: setup.gameName || "Özel Maç",
      createdAt: setup.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dateFormatted: new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date()),
      team1: NAMES[0],
      team2: NAMES[1],
      score: [state.score[0] || 0, state.score[1] || 0],
      turn: state.turn || 0,
      cats: ids,
      categoriesData: CATS.map(c => ({ id: c.id, name: c.name, emoji: c.emoji })),
      totalQuestions: TOTAL,
      answeredCount: answered,
      used: { ...state.used },
      lifelines: setup.lifelines || { 1: [], 2: [] },
      status: isCompleted ? "Tamamlandı" : "Devam Ediyor",
      setup: { ...setup }
    };

    if (!setup.createdAt) {
      setup.createdAt = snapshot.createdAt;
      try { localStorage.setItem("setup", JSON.stringify(setup)); } catch (_) {}
    }

    let savedGames = [];
    try {
      const raw = localStorage.getItem("sorBakalimSavedGames");
      if (raw) savedGames = JSON.parse(raw);
    } catch (_) {}
    if (!Array.isArray(savedGames)) savedGames = [];

    const existingIdx = savedGames.findIndex(g => g.id === setup.matchId);
    if (existingIdx >= 0) {
      savedGames[existingIdx] = snapshot;
    } else {
      savedGames.unshift(snapshot);
    }

    if (savedGames.length > 50) savedGames = savedGames.slice(0, 50);

    localStorage.setItem("sorBakalimSavedGames", JSON.stringify(savedGames));
  } catch (err) {
    console.warn("Oyun oturumu kütüphaneye kaydedilemedi:", err);
  }
}

const save = () => {
  try { localStorage.setItem("game", JSON.stringify(state)); } catch (e) {}
  saveMatchSnapshot();
};
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
      <div class="column-header">
        ${c.img ? `<img src="${esc(c.img)}" alt="" class="cat-icon-img" style="width:24px;height:24px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px;">` : `<span class="cat-icon">${c.emoji || '🎯'}</span>`}
        <span class="cat-title">${esc(c.name || c.id)}</span>
      </div>
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
  saveMatchSnapshot(true);
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