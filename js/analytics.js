/**
 * Sor Bakalım - Gerçek Ziyaret ve Oyun İstatistikleri Modülü
 * Sahte/sabit sayılar kullanmaz; Supabase (site_visits, game_sessions)
 * ve gerçek oynanan oturumlardan canlı veri toplar.
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://fzxrqvobatablbtssggo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM";
  const VISITS_TABLE = "site_visits";
  const SESSIONS_TABLE = "game_sessions";

  // Eski sahte localStorage istatistiklerini temizle
  try {
    localStorage.removeItem("sorBakalimStats");
  } catch (_) {}

  function getClient() {
    if (window.SorBakalimAuth && typeof window.SorBakalimAuth.getClient === "function") {
      const c = window.SorBakalimAuth.getClient();
      if (c) return c;
    }
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.supabaseClient;
      } catch (_) {}
    }
    return null;
  }

  /**
   * Tarayıcı oturumu başına 1 gerçek ziyaret kaydeder (site_visits).
   */
  async function logSiteVisit(pagePath) {
    try {
      if (sessionStorage.getItem("sorBakalimVisitLogged")) return;
      sessionStorage.setItem("sorBakalimVisitLogged", "1");
    } catch (_) {}

    const client = getClient();
    if (!client) return;

    try {
      const page = pagePath || (window.location && window.location.pathname) || "/";
      await client.from(VISITS_TABLE).insert({
        page: String(page).slice(0, 120),
        created_at: new Date().toISOString()
      });
    } catch (_) {
      // Tablo henüz oluşturulmadıysa veya RLS yazmaya kapalıysa sessizce geç
    }
  }

  /**
   * Gerçek bir oyun oturumunu Supabase game_sessions tablosuna kaydeder.
   */
  async function logGameSession(info) {
    if (!info || !info.matchId) return;
    const dedupKey = "sorBakalimLoggedMatch_" + info.matchId + "_" + (info.status || "started");
    try {
      if (sessionStorage.getItem(dedupKey)) return;
      sessionStorage.setItem(dedupKey, "1");
    } catch (_) {}

    const client = getClient();
    if (!client) return;

    try {
      await client.from(SESSIONS_TABLE).upsert({
        match_id: String(info.matchId),
        game_name: String(info.gameName || "Özel Maç").slice(0, 120),
        team1: String(info.team1 || "Birinci Takım").slice(0, 80),
        team2: String(info.team2 || "İkinci Takım").slice(0, 80),
        categories: Array.isArray(info.categories) ? info.categories : [],
        status: info.status === "Tamamlandı" ? "completed" : "in_progress",
        created_at: info.createdAt || new Date().toISOString()
      }, { onConflict: "match_id" });
    } catch (_) {
      // Tablo henüz oluşturulmadıysa sessizce geç
    }
  }

  /**
   * Admin paneli için canlı istatistikleri hesaplar (0 sahte veri).
   */
  async function fetchAdminStats(activeCategories = []) {
    const result = {
      visitors30d: 0,
      visitorsPrev30d: 0,
      visitorsGrowthText: "—",
      visitorsGrowthClass: "",
      gamesPlayed: 0,
      categoryPlays: {},
      source: "empty"
    };

    const client = getClient();
    const now = Date.now();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const since30dIso = new Date(now - ms30d).toISOString();
    const since60dIso = new Date(now - (2 * ms30d)).toISOString();

    // 1. Son 30 gün & önceki 30 gün ziyaretleri (public.site_visits)
    if (client) {
      try {
        const { data: visitRows, error: visitErr } = await client
          .from(VISITS_TABLE)
          .select("created_at")
          .gte("created_at", since60dIso);

        if (!visitErr && Array.isArray(visitRows)) {
          let cur30 = 0;
          let prev30 = 0;
          visitRows.forEach(r => {
            const ts = r && r.created_at ? Date.parse(r.created_at) : 0;
            if (!ts) return;
            if (ts >= now - ms30d) cur30++;
            else prev30++;
          });
          result.visitors30d = cur30;
          result.visitorsPrev30d = prev30;

          if (prev30 > 0) {
            const pct = ((cur30 - prev30) / prev30) * 100;
            const rounded = Math.abs(pct).toFixed(1);
            if (pct > 0) {
              result.visitorsGrowthText = `↗ +%${rounded}`;
              result.visitorsGrowthClass = "badge-growth";
            } else if (pct < 0) {
              result.visitorsGrowthText = `↘ -%${rounded}`;
              result.visitorsGrowthClass = "badge-fire";
            } else {
              result.visitorsGrowthText = "%0";
            }
          } else if (cur30 > 0) {
            result.visitorsGrowthText = "Yeni";
            result.visitorsGrowthClass = "badge-growth";
          } else {
            result.visitorsGrowthText = "—";
          }
        }
      } catch (_) {}
    }

    // 2. Gerçek oynanan oyunlar & kategori bazlı oynanma sayıları (public.game_sessions)
    let loadedFromSupabaseSessions = false;
    if (client) {
      try {
        const { data: sessionRows, error: sessErr } = await client
          .from(SESSIONS_TABLE)
          .select("match_id, categories, status");

        if (!sessErr && Array.isArray(sessionRows)) {
          loadedFromSupabaseSessions = true;
          result.gamesPlayed = sessionRows.length;
          result.source = "supabase";

          sessionRows.forEach(row => {
            const cats = Array.isArray(row.categories) ? row.categories : [];
            cats.forEach(catKey => {
              const label = resolveCategoryLabel(catKey, activeCategories);
              if (!label) return;
              result.categoryPlays[label] = (result.categoryPlays[label] || 0) + 1;
            });
          });
        }
      } catch (_) {}
    }

    // Supabase game_sessions tablosu henüz oluşturulmadıysa gerçek localStorage kayıtlarını oku (asla sahte veri üretme)
    if (!loadedFromSupabaseSessions) {
      try {
        const raw = localStorage.getItem("sorBakalimSavedGames");
        const saved = raw ? JSON.parse(raw) : [];
        if (Array.isArray(saved) && saved.length > 0) {
          result.gamesPlayed = saved.length;
          result.source = "local_real";
          saved.forEach(match => {
            const cats = Array.isArray(match.categoriesData) && match.categoriesData.length > 0
              ? match.categoriesData.map(c => (c && (c.name || c.id)) || "")
              : (Array.isArray(match.cats) ? match.cats : []);
            cats.forEach(catKey => {
              const label = resolveCategoryLabel(catKey, activeCategories);
              if (!label) return;
              result.categoryPlays[label] = (result.categoryPlays[label] || 0) + 1;
            });
          });
        }
      } catch (_) {}
    }

    return result;
  }

  function resolveCategoryLabel(catKey, activeCategories) {
    if (!catKey) return "";
    const keyStr = String(catKey).trim();
    if (!keyStr) return "";
    const found = (activeCategories || []).find(
      c => c && (c.id === keyStr || (c.name && c.name.toLowerCase() === keyStr.toLowerCase()))
    );
    return found ? found.name : keyStr;
  }

  window.SorBakalimAnalytics = {
    logSiteVisit: logSiteVisit,
    logGameSession: logGameSession,
    fetchAdminStats: fetchAdminStats
  };

  // Ana sayfa ve genel sayfalarda oturum başına 1 gerçek ziyaret kaydet (admin.html hariç)
  const isAdminPage = typeof window !== "undefined" &&
    window.location &&
    String(window.location.pathname || "").toLowerCase().includes("admin.html");

  if (!isAdminPage) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => logSiteVisit(), 400);
      });
    } else {
      setTimeout(() => logSiteVisit(), 400);
    }
  }
})();
