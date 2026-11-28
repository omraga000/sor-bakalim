const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } };

const LIFE = {
  double: { icon: "✌️", name: "Cevabı İkiye Katla" },
  call:   { icon: "📞", name: "Telefonla Joker" },
  pit:    { icon: "💣", name: "Çukur" },
  rest:   { icon: "😴", name: "Dinlen" },
  trap:   { icon: "🪤", name: "Tuzak" }
};

const TIME = 30;                               // saniye

const setup = read("setup", {});
const game = read("game", null);
const params = new URLSearchParams(location.search);
const catId = params.get("c");
const idx = parseInt(params.get("i"), 10);
let cat = (window.QUESTIONS || {})[catId];
let item = cat && cat.items && cat.items[idx];
const key = catId + "-" + idx;
const NAMES = [setup.team1 || "Birinci Takım", setup.team2 || "İkinci Takım"];

let secs = TIME, paused = false, view = "q";

function start() {
  if (!cat || !item) {
    showFatal("Soru veya kategori bulunamadı.");
    return;
  }
  $("roomTitle").textContent = "Sor Bakalım - " + (setup.gameName || "Özel Maç");
  $("currentTurnBadge").textContent = "Sıra: " + NAMES[game.turn];
  renderSide();
  showQuestion();
  setInterval(tick, 1000);
}

function renderSide() {
  $("side").innerHTML = [0, 1].map(t => {
    const list = ((setup.lifelines && setup.lifelines[t + 1]) || []).filter(k => LIFE[k]);
    return `<div class="q-team ${game.turn === t ? "turn" : ""}">
      <div class="q-team-name">${esc(NAMES[t])}</div>
      <div class="q-team-score">${game.score[t]}</div>
      <div class="q-help">Yardımcılar</div>
      <div class="q-icons">${list.map(k => `<span title="${LIFE[k].name}">${LIFE[k].icon}</span>`).join("")}</div>
    </div>`;
  }).join("");
}

/* ---------- zamanlayıcı ---------- */
const fmt = s => "00:" + String(s).padStart(2, "0");
function paintTimer() {
  const t = $("tTime");
  if (!t) return;
  t.textContent = fmt(secs);
  t.classList.toggle("end", secs === 0);
  $("tPause").textContent = paused ? "▶" : "⏸";
}
function tick() {
  if (view !== "q" || paused || secs <= 0) return;
  secs--;
  paintTimer();
}

/* ---------- 1. sayfa: soru ---------- */
function showQuestion() {
  view = "q";
  $("frame").innerHTML = `
    <div class="q-timer">
      <button id="tPause" title="Durdur">⏸</button>
      <span id="tTime">${fmt(secs)}</span>
      <button id="tReset" title="Sıfırla">↻</button>
    </div>
    <div class="q-pts">${item.p} Puan</div>
    ${item.img ? `<div style="text-align:center;margin:10px 0;"><img src="${esc(item.img)}" alt="Görsel" style="max-height:220px;max-width:90%;border-radius:12px;object-fit:cover;box-shadow:0 4px 15px rgba(0,0,0,0.4);"></div>` : ''}
    <div class="q-text">${esc(item.q)}</div>
    <button class="q-btn q-green q-left" id="toAns">Cevap</button>
    <div class="q-btn q-tag q-right">${esc(cat.name)}</div>`;
  $("tPause").onclick = () => { paused = !paused; paintTimer(); };
  $("tReset").onclick = () => { secs = TIME; paused = false; paintTimer(); };
  $("toAns").onclick = showAnswer;
  paintTimer();
}

/* ---------- 2. sayfa: cevap ---------- */
function showAnswer() {
  view = "a";
  $("frame").innerHTML = `
    <div class="q-pts">${item.p} Puan</div>
    ${item.img ? `<div style="text-align:center;margin:10px 0;"><img src="${esc(item.img)}" alt="Görsel" style="max-height:220px;max-width:90%;border-radius:12px;object-fit:cover;box-shadow:0 4px 15px rgba(0,0,0,0.4);"></div>` : ''}
    <div class="q-sub">${esc(item.q)}</div>
    <div class="q-answer">${esc(item.a)}</div>
    <button class="q-btn q-blue q-left" id="toWho">Hangi takım?</button>
    <button class="q-btn q-red q-right" id="toQ">Soruya Dön</button>`;
  $("toWho").onclick = showWho;
  $("toQ").onclick = showQuestion;
}

/* ---------- 3. sayfa: hangi takım doğru bildi ---------- */
function showWho() {
  view = "w";
  $("frame").innerHTML = `
    <div class="q-text">Hangi takım doğru cevapladı?</div>
    <div class="q-teams">
      <button class="q-team-btn" data-w="0">${esc(NAMES[0])}</button>
      <button class="q-team-btn" data-w="1">${esc(NAMES[1])}</button>
      <button class="q-team-btn q-none" data-w="-1">Kimse bilemedi</button>
    </div>
    <button class="q-btn q-green q-left" id="toAns2">Cevaba dön</button>`;
  $("toAns2").onclick = showAnswer;
  document.querySelectorAll(".q-team-btn").forEach(b => {
    b.onclick = () => finish(+b.dataset.w);
  });
}

function finish(w) {
  // Tek aktif maç koruması: başka sekmede yeni maç başladıysa eski soruyu yazma
  const latestSetup = read("setup", {});
  if (setup.matchId && latestSetup.matchId && latestSetup.matchId !== setup.matchId) {
    location.replace("game.html");
    return;
  }

  if (w >= 0) game.score[w] += item.p;         // sadece bir takım puan alır
  game.used[key] = 1;
  game.turn = 1 - game.turn;                   // her sorudan sonra sıra değişir
  game.matchId = setup.matchId || game.matchId;
  game.msg = w >= 0 ? NAMES[w] + " " + item.p + " puan kazandı!" : "Kimse bilemedi. Puan yok, sıra değişti.";
  try { localStorage.setItem("game", JSON.stringify(game)); } catch (e) {}

  // Oyun oturumu anlık kütüphane güncellemesi
  try {
    const raw = localStorage.getItem("sorBakalimSavedGames");
    if (raw && setup.matchId) {
      let list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const match = list.find(g => g.id === setup.matchId);
        if (match) {
          match.score = [game.score[0] || 0, game.score[1] || 0];
          match.turn = game.turn;
          match.used = { ...game.used };
          match.answeredCount = Object.keys(game.used || {}).length;
          match.updatedAt = new Date().toISOString();
          localStorage.setItem("sorBakalimSavedGames", JSON.stringify(list));
        }
      }
    }
  } catch (_) {}

  try { sessionStorage.setItem("sorBakalimValidGameEntry", "from_soru"); } catch (_) {}
  location.href = "game.html";
}

/* ---------- başlat (her şey tanımlandıktan sonra) ---------- */
function initSoru() {
  if (!game) {
    location.replace("index.html");               // oyun oturumu yoksa → ana sayfaya dön
    return;
  }
  if (game.used && game.used[key]) {
    try { sessionStorage.setItem("sorBakalimValidGameEntry", "from_soru"); } catch (_) {}
    location.replace("game.html");               // zaten oynanmış soru → tahtaya dön
    return;
  }

  let currentQ = window.QUESTIONS || {};
  if (Array.isArray(setup.categoriesData)) {
    const fromSetup = setup.categoriesData.find(c => c && c.id === catId);
    if (fromSetup && fromSetup.items && fromSetup.items[idx]) {
      cat = fromSetup;
      item = fromSetup.items[idx];
    }
  }
  if (!cat || !item) {
    cat = currentQ[catId];
    item = cat && cat.items && cat.items[idx];
  }

  if (cat && item) {
    start();
  } else if (window.SorBakalimData && typeof window.SorBakalimData.loadGlobalCategories === 'function') {
    window.SorBakalimData.loadGlobalCategories().then(() => {
      const qAfter = window.QUESTIONS || {};
      cat = qAfter[catId];
      item = cat && cat.items && cat.items[idx];
      if (cat && item) {
        start();
      } else {
        location.replace("game.html");
      }
    }).catch(() => {
      location.replace("game.html");
    });
  } else {
    location.replace("game.html");
  }
}

initSoru();