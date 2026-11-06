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
const cat = QUESTIONS[catId];
const item = cat && cat.items[idx];
const key = catId + "-" + idx;
const NAMES = [setup.team1 || "Birinci Takım", setup.team2 || "İkinci Takım"];

let secs = TIME, paused = false, view = "q";

function start() {
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
    <div class="q-sub">${esc(item.q)}</div>
    <div class="q-answer">${esc(item.a)}</div>
    <button class="q-btn q-blue q-left" id="toWho">Hangi takım?</button>
    <button class="q-btn q-red q-right" id="toQ">Soruya dön ›</button>`;
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
  if (w >= 0) game.score[w] += item.p;         // sadece bir takım puan alır
  game.used[key] = 1;
  game.turn = 1 - game.turn;                   // her sorudan sonra sıra değişir
  game.msg = w >= 0 ? NAMES[w] + " " + item.p + " puan kazandı! 🎉" : "Kimse bilemedi. Puan yok, sıra değişti.";
  try { localStorage.setItem("game", JSON.stringify(game)); } catch (e) {}
  location.href = "game.html";
}

/* ---------- başlat (her şey tanımlandıktan sonra) ---------- */
if (!game || !item || game.used[key]) {
  location.replace("game.html");               // geçersiz veya oynanmış soru → tahtaya dön
} else {
  start();
}