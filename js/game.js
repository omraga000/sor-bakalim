/* ---------- YENİLEME (REFRESH) & GEÇERSİZ GİRİŞ KORUMASI ---------- */
(function enforceFreshGameEntry() {
  let isReload = false;
  try {
    const navEntries = performance.getEntriesByType && performance.getEntriesByType("navigation");
    if (navEntries && navEntries.length > 0 && navEntries[0].type === "reload") {
      isReload = true;
    } else if (performance.navigation && performance.navigation.type === 1) {
      isReload = true;
    }
  } catch (_) {}

  let validEntry = null;
  try {
    validEntry = sessionStorage.getItem("sorBakalimValidGameEntry");
    sessionStorage.removeItem("sorBakalimValidGameEntry");
  } catch (_) {}

  let rawSetup = null;
  try { rawSetup = JSON.parse(localStorage.getItem("setup") || "null"); } catch (_) {}
  const hasValidSetup = Boolean(rawSetup && Array.isArray(rawSetup.cats) && rawSetup.cats.length >= 2);

  if (isReload || !validEntry || !hasValidSetup) {
    try {
      localStorage.removeItem("game");
      sessionStorage.removeItem("sorBakalimValidGameEntry");
      if (rawSetup) {
        delete rawSetup.matchId;
        delete rawSetup.createdAt;
        localStorage.setItem("setup", JSON.stringify(rawSetup));
      }
    } catch (_) {}
    window.location.replace("index.html");
    throw new Error("GAME_RELOAD_REDIRECT");
  }
})();

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
  if (TOTAL > 0 && usedCount() >= TOTAL && !state.finished) {
    finishGame(true);
  }
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

/* ---------- oyun durumu (Tek Aktif Maç Koruması) ---------- */
if (!setup.matchId) {
  setup.matchId = "match_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
  try { localStorage.setItem("setup", JSON.stringify(setup)); } catch (_) {}
}
const ACTIVE_MATCH_ID = setup.matchId;
let matchSuperseded = false;

const state = (() => {
  try {
    const g = JSON.parse(localStorage.getItem("game"));
    if (
      g &&
      Array.isArray(g.score) &&
      g.used &&
      !g.finished &&
      (!g.matchId || g.matchId === ACTIVE_MATCH_ID)
    ) {
      g.matchId = ACTIVE_MATCH_ID;
      return g;
    }
  } catch (e) {}
  return { matchId: ACTIVE_MATCH_ID, score: [0, 0], turn: 0, used: {}, msg: "", finished: false };
})();

function clearActiveMatchSession() {
  try {
    localStorage.removeItem("game");
    const curSetup = JSON.parse(localStorage.getItem("setup") || "null");
    if (curSetup && curSetup.matchId === ACTIVE_MATCH_ID) {
      delete curSetup.matchId;
      delete curSetup.createdAt;
      localStorage.setItem("setup", JSON.stringify(curSetup));
    }
  } catch (_) {}
}

// Başka bir sekmede yeni maç başlatılırsa bu eski sekmenin veriyi ezmesini engelle
window.addEventListener("storage", (e) => {
  if (e.key === "setup" && e.newValue) {
    try {
      const nextSetup = JSON.parse(e.newValue);
      if (nextSetup && nextSetup.matchId && nextSetup.matchId !== ACTIVE_MATCH_ID) {
        matchSuperseded = true;
        if ($("modalCard") && $("questionModal")) {
          $("modalCard").innerHTML = `
            <h3>Yeni Maç Başlatıldı</h3>
            <p style="margin: 12px 0 18px; color: var(--ink-muted, #574B45);">
              Başka bir tarayıcı sekmesinde yeni bir oyun başlatıldı. Veri karışıklığını önlemek için bu eski sekme kilitlendi.
            </p>
            <div class="row-btns">
              <button class="modal-close-btn" id="supersededHomeBtn">Ana Sayfa</button>
              <button class="primary-btn" id="supersededReloadBtn">Yeni Maça Geç</button>
            </div>`;
          $("supersededHomeBtn").onclick = () => { location.href = "index.html"; };
          $("supersededReloadBtn").onclick = () => { location.reload(); };
          $("questionModal").style.display = "flex";
        }
      }
    } catch (_) {}
  }
});

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

    const catSig = (arr) => Array.isArray(arr) ? arr.slice().sort().join(",") : "";
    const curCatSig = catSig(ids);

    let existingIdx = savedGames.findIndex(g => g && g.id === setup.matchId);
    if (existingIdx < 0) {
      existingIdx = savedGames.findIndex(g =>
        g &&
        (g.userId || "guest") === userId &&
        String(g.gameName || "").trim().toLowerCase() === String(snapshot.gameName || "").trim().toLowerCase() &&
        String(g.team1 || "").trim().toLowerCase() === String(snapshot.team1 || "").trim().toLowerCase() &&
        String(g.team2 || "").trim().toLowerCase() === String(snapshot.team2 || "").trim().toLowerCase() &&
        catSig(g.cats) === curCatSig
      );
    }

    if (existingIdx >= 0) {
      const prev = savedGames[existingIdx];
      snapshot.id = prev.id;
      snapshot.createdAt = prev.createdAt || snapshot.createdAt;
      snapshot.dateFormatted = prev.dateFormatted || snapshot.dateFormatted;
      snapshot.setup = { ...setup, matchId: prev.id, createdAt: snapshot.createdAt };
      setup.matchId = prev.id;
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
  if (matchSuperseded) return;
  state.matchId = ACTIVE_MATCH_ID;
  try { localStorage.setItem("game", JSON.stringify(state)); } catch (e) {}
  saveMatchSnapshot(Boolean(state.finished));
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
        ${c.img ? `<img src="${esc(c.img)}" alt="" class="cat-icon-img" style="width:24px;height:24px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px;">` : `<span class="cat-icon">${esc(c.emoji || '🎯')}</span>`}
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

function exitToHome() {
  if (state.finished || (TOTAL > 0 && usedCount() >= TOTAL)) {
    clearActiveMatchSession();
  }
  location.href = "index.html";
}

function finishGame(isAllDone = false) {
  const allAnswered = Boolean(isAllDone) || (TOTAL > 0 && usedCount() >= TOTAL);
  state.finished = true;
  saveMatchSnapshot(true);
  try { localStorage.setItem("game", JSON.stringify(state)); } catch (_) {}

  const [a, b] = state.score;
  const isTie = a === b;
  const trophy = isTie ? "🤝" : "🏆";
  const result = isTie ? "Berabere!" : "Kazanan: " + esc(NAMES[a > b ? 0 : 1]);

  $("modalCard").innerHTML = `
    <div style="font-size: 3rem; line-height: 1; margin-bottom: 8px;">${trophy}</div>
    <h3>${allAnswered ? "Oyun Tamamlandı!" : "Oyun Sonucu"}</h3>
    <div class="final-scores">
      <div>${esc(NAMES[0])}<b>${a}</b></div>
      <div>${esc(NAMES[1])}<b>${b}</b></div>
    </div>
    <div class="reveal">${result}</div>
    <div class="row-btns" ${allAnswered ? 'style="grid-template-columns: 1fr;"' : ''}>
      ${allAnswered ? '' : '<button class="modal-close-btn" id="backBtn">Oyuna Dön</button>'}
      <button class="primary-btn" id="homeBtn">Ana Sayfaya Dön</button>
    </div>`;

  if ($("backBtn")) {
    $("backBtn").onclick = () => {
      state.finished = false;
      save();
      closeModal();
    };
  }

  $("homeBtn").onclick = () => {
    clearActiveMatchSession();
    location.href = "index.html";
  };

  $("questionModal").style.display = "flex";
  setTimeout(() => {
    if ($("homeBtn")) $("homeBtn").focus();
  }, 50);
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
if (params.get("finish") === "1" || (TOTAL > 0 && usedCount() >= TOTAL)) {
  finishGame(TOTAL > 0 && usedCount() >= TOTAL);
}