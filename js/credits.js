/**
 * Sor Bakalım - Supabase Oyun Kredisi & Paket Satın Alma Modülü
 * Tablo: public.user_game_credits (user_id, email, games_remaining, total_purchased)
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://fzxrqvobatablbtssggo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM";
  const CREDITS_TABLE = "user_game_credits";

  const PACKAGES = [
    { id: "pkg_1",  games: 1,  title: "1 Oyun",  subtitle: "1 oyun hakkı",  badge: "Başlangıç", icon: "🎮" },
    { id: "pkg_2",  games: 2,  title: "2 Oyun",  subtitle: "2 oyun hakkı",  badge: "İkili",     icon: "🎯" },
    { id: "pkg_5",  games: 5,  title: "5 Oyun",  subtitle: "5 oyun hakkı",  badge: "Popüler",   icon: "🔥" },
    { id: "pkg_10", games: 10, title: "10 Oyun", subtitle: "10 oyun hakkı", badge: "Avantajlı", icon: "👑" }
  ];

  let _client = null;
  let _currentUser = null;
  let _gamesRemaining = null;
  let _totalPurchased = 0;
  let _isLoading = true;
  let _selectedPackage = null;
  let _authSubscribed = false;

  function getClient() {
    if (window.SorBakalimAuth && typeof window.SorBakalimAuth.getClient === "function") {
      const authClient = window.SorBakalimAuth.getClient();
      if (authClient) return authClient;
    }
    if (_client) return _client;
    if (window.supabaseClient) {
      _client = window.supabaseClient;
      return _client;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        window.supabaseClient = _client;
      } catch (e) {
        console.warn("Credits Supabase istemcisi başlatılamadı:", e);
      }
    }
    return _client;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notifyToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let icon = "ℹ️";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";
    if (type === "success") icon = "✅";
    toast.innerHTML = `<span style="font-size:1.15rem; flex-shrink:0;">${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("toast-hiding");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 3500);
  }

  function updateCreditBadges() {
    const badges = document.querySelectorAll("[data-credits-badge], #remainingGamesBadge, #setupRemainingGamesBadge");
    badges.forEach(el => {
      const valueEl = el.querySelector("[data-credits-count]");
      el.classList.remove("credits-zero", "credits-positive", "credits-guest", "credits-loading");

      if (_isLoading) {
        el.classList.add("credits-loading");
        if (valueEl) valueEl.textContent = "...";
        else el.textContent = "Kalan Oyun Hakkı: ...";
        return;
      }

      if (!_currentUser) {
        el.classList.add("credits-guest");
        if (valueEl) valueEl.textContent = "—";
        else el.textContent = "Kalan Oyun Hakkı: —";
        el.title = "Oyun hakkınızı görmek için giriş yapın";
        return;
      }

      if (typeof _gamesRemaining !== "number") {
        el.classList.add("credits-loading");
        if (valueEl) valueEl.textContent = "...";
        else el.textContent = "Kalan Oyun Hakkı: ...";
        return;
      }

      const count = _gamesRemaining;
      if (count <= 0) {
        el.classList.add("credits-zero");
        el.title = "Oyun krediniz bitti! Yeni oyun oynamak için 'Oyun Satın Al' menüsünden paket seçebilirsiniz.";
      } else {
        el.classList.add("credits-positive");
        el.title = `Hesabınızda ${count} adet oynanabilir oyun hakkı bulunuyor.`;
      }

      if (valueEl) valueEl.textContent = String(count);
      else el.textContent = `Kalan Oyun Hakkı: ${count}`;
    });

    window.dispatchEvent(new CustomEvent("sorBakalimCreditsUpdated", {
      detail: {
        loggedIn: Boolean(_currentUser),
        user: _currentUser,
        gamesRemaining: _gamesRemaining,
        totalPurchased: _totalPurchased
      }
    }));
  }

  /**
   * Giriş yapmış kullanıcının public.user_game_credits satırını YALNIZCA okur (SELECT).
   * İstemci tarafından doğrudan INSERT/UPDATE/DELETE kesinlikle yapılmaz (RLS uyumlu).
   */
  async function readUserCreditsRow(userId) {
    const client = getClient();
    if (!client || !userId) {
      return { success: false, error: "Kullanıcı bilgisi veya Supabase istemcisi eksik." };
    }

    try {
      const { data: existing, error: readErr } = await client
        .from(CREDITS_TABLE)
        .select("user_id, games_remaining, total_purchased")
        .eq("user_id", userId)
        .maybeSingle();

      if (readErr) {
        return { success: false, error: readErr.message };
      }

      if (!existing) {
        return {
          success: true,
          found: false,
          row: null,
          gamesRemaining: 0,
          totalPurchased: 0
        };
      }

      return {
        success: true,
        found: true,
        row: existing,
        gamesRemaining: Number(existing.games_remaining) || 0,
        totalPurchased: Number(existing.total_purchased) || 0
      };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async function fetchCredits() {
    const client = getClient();
    if (!client) {
      _currentUser = null;
      _gamesRemaining = null;
      _totalPurchased = 0;
      updateCreditBadges();
      return { success: false, loggedIn: false, gamesRemaining: null, error: "Supabase bağlantısı kurulamadı." };
    }

    _isLoading = true;
    updateCreditBadges();

    try {
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData && sessionData.session ? sessionData.session.user : null;
      _currentUser = user;

      if (!user) {
        _gamesRemaining = null;
        _totalPurchased = 0;
        _isLoading = false;
        updateCreditBadges();
        return { success: true, loggedIn: false, gamesRemaining: null };
      }

      let res = await readUserCreditsRow(user.id);
      // Yeni kayıt sonrası DB trigger henüz satırı oluşturuyorsa 1 kez kısa gecikmeyle tekrar oku
      if (res.success && !res.found) {
        await new Promise(r => setTimeout(r, 500));
        res = await readUserCreditsRow(user.id);
      }

      if (!res.success) {
        console.warn("user_game_credits okuma hatası:", res.error);
        _isLoading = false;
        updateCreditBadges();
        return { success: false, loggedIn: true, gamesRemaining: _gamesRemaining, error: res.error };
      }

      _gamesRemaining = res.gamesRemaining;
      _totalPurchased = res.totalPurchased;
      _isLoading = false;
      updateCreditBadges();
      return { success: true, loggedIn: true, gamesRemaining: _gamesRemaining, totalPurchased: _totalPurchased };
    } catch (err) {
      console.warn("fetchCredits istisnası:", err);
      _isLoading = false;
      updateCreditBadges();
      return { success: false, loggedIn: Boolean(_currentUser), gamesRemaining: _gamesRemaining, error: err.message || String(err) };
    }
  }

  // Ücretsiz kredi ekleme devre dışı (Paddle ödeme entegrasyonu eklenene kadar)
  async function addCredits() {
    notifyToast("Ödeme sistemi yakında aktif olacak!", "info");
    return { success: false, disabled: true, error: "Ödeme sistemi yakında aktif olacak!" };
  }

  /**
   * Güvenli Supabase RPC ile 1 oyun hakkı düşer: consume_game_credit()
   */
  async function consumeGameCredit() {
    const client = getClient();
    if (!client) {
      return { success: false, error: "Oyun hakkınız kalmadı." };
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    _currentUser = user;

    if (!user) {
      return { success: false, needsAuth: true, error: "Oyun hakkınız kalmadı." };
    }

    try {
      const { data, error } = await client.rpc("consume_game_credit");

      if (error) {
        console.warn("consume_game_credit RPC hatası:", error.message);
        if (String(error.message || "").toUpperCase().includes("NO_CREDITS_REMAINING")) {
          _gamesRemaining = 0;
          updateCreditBadges();
        }
        return {
          success: false,
          insufficient: true,
          gamesRemaining: _gamesRemaining,
          error: "Oyun hakkınız kalmadı."
        };
      }

      _gamesRemaining = Number(data);
      updateCreditBadges();
      return { success: true, gamesRemaining: _gamesRemaining };
    } catch (err) {
      console.warn("consumeGameCredit istisnası:", err);
      return { success: false, insufficient: true, error: "Oyun hakkınız kalmadı." };
    }
  }

  // --- DROPDOWN & MODAL UI HELPERS ---
  function closeAllPackageDropdowns() {
    document.querySelectorAll(".buy-games-dropdown-menu").forEach(menu => {
      menu.style.display = "none";
    });
    document.querySelectorAll(".buy-games-btn").forEach(btn => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function highlightBuyDropdown() {
    const buyBtn = document.getElementById("buyGamesBtn");
    const buyMenu = document.getElementById("buyGamesMenu");
    if (buyBtn) {
      buyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      buyBtn.classList.remove("credit-highlight-pulse");
      void buyBtn.offsetWidth;
      buyBtn.classList.add("credit-highlight-pulse");
      setTimeout(() => buyBtn.classList.remove("credit-highlight-pulse"), 2600);
    }
    if (buyMenu && buyBtn) {
      buyMenu.style.display = "block";
      buyBtn.setAttribute("aria-expanded", "true");
    }
  }

  function ensureModalsExist() {
    // 1. Purchase Confirmation Modal
    if (!document.getElementById("packageConfirmModal")) {
      const modal = document.createElement("div");
      modal.id = "packageConfirmModal";
      modal.className = "modal-overlay credits-modal-overlay";
      modal.style.display = "none";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <div class="modal-card credits-modal-card">
          <button type="button" class="credits-modal-close" id="closePkgModalBtn" aria-label="Kapat">✕</button>
          <div class="credits-modal-icon" id="pkgModalIcon">🎮</div>
          <h3 id="pkgModalTitle">Oyun Paketi Onayı</h3>
          <p class="credits-modal-subtitle" id="pkgModalDesc">Seçtiğiniz paket hesabınıza anında tanımlanacaktır.</p>
          <div class="credits-modal-summary">
            <div class="summary-row">
              <span>Seçilen Paket</span>
              <strong id="pkgSummaryName">1 Oyun</strong>
            </div>
            <div class="summary-row">
              <span>Paket İçeriği</span>
              <strong id="pkgSummaryDetail">1 oyun hakkı</strong>
            </div>
            <div class="summary-row">
              <span>Mevcut Kalan Oyun Hakkı</span>
              <strong id="pkgSummaryCurrent">0</strong>
            </div>
            <div class="summary-row summary-row-total">
              <span>İşlem Sonrası Toplam</span>
              <strong id="pkgSummaryAfter">1 Oyun</strong>
            </div>
          </div>
          <div class="credits-modal-actions">
            <button type="button" class="modal-close-btn" id="cancelPkgModalBtn">Vazgeç</button>
            <button type="button" class="primary-btn" id="confirmPkgPurchaseBtn">Satın Al</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeFn = () => {
        modal.style.display = "none";
        _selectedPackage = null;
      };

      document.getElementById("closePkgModalBtn").addEventListener("click", closeFn);
      document.getElementById("cancelPkgModalBtn").addEventListener("click", closeFn);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeFn();
      });

      document.getElementById("confirmPkgPurchaseBtn").addEventListener("click", async () => {
        if (!_selectedPackage) return;
        const confirmBtn = document.getElementById("confirmPkgPurchaseBtn");
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.textContent = "İşleniyor...";

        const res = await addCredits(_selectedPackage.games);

        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;

        if (res.needsAuth) {
          closeFn();
          openLoginPromptModal("Oyun paketi satın almak için hesabınıza giriş yapmalısınız.");
          return;
        }

        if (res.success) {
          const addedTitle = _selectedPackage.title;
          closeFn();
          notifyToast(`${addedTitle} hesabınıza eklendi! Kalan Oyun Hakkı: ${res.gamesRemaining} 🎉`, "success");
        } else {
          notifyToast(`Paket eklenirken hata oluştu: ${res.error || "Bilinmeyen hata"}`, "error");
        }
      });
    }

    // 2. Login Prompt Modal
    if (!document.getElementById("creditsLoginPromptModal")) {
      const loginModal = document.createElement("div");
      loginModal.id = "creditsLoginPromptModal";
      loginModal.className = "modal-overlay credits-modal-overlay";
      loginModal.style.display = "none";
      loginModal.setAttribute("role", "dialog");
      loginModal.setAttribute("aria-modal", "true");
      loginModal.innerHTML = `
        <div class="modal-card credits-modal-card">
          <button type="button" class="credits-modal-close" id="closeLoginPromptBtn" aria-label="Kapat">✕</button>
          <div class="credits-modal-icon">🔐</div>
          <h3>Giriş Yapmanız Gerekiyor</h3>
          <p class="credits-modal-subtitle" id="loginPromptReason">Devam etmek için lütfen hesabınıza giriş yapın.</p>
          <div class="credits-modal-actions">
            <a href="kayit.html" class="modal-close-btn" style="text-align:center;">Hesap Oluştur</a>
            <a href="giris.html" class="primary-btn" style="text-align:center;">Giriş Yap</a>
          </div>
        </div>
      `;
      document.body.appendChild(loginModal);

      const closeLoginFn = () => {
        loginModal.style.display = "none";
      };
      document.getElementById("closeLoginPromptBtn").addEventListener("click", closeLoginFn);
      loginModal.addEventListener("click", (e) => {
        if (e.target === loginModal) closeLoginFn();
      });
    }

    // 3. No Credits ("Oyun krediniz bitti!") Alert Modal
    if (!document.getElementById("noCreditsAlertModal")) {
      const noCreditsModal = document.createElement("div");
      noCreditsModal.id = "noCreditsAlertModal";
      noCreditsModal.className = "modal-overlay credits-modal-overlay";
      noCreditsModal.style.display = "none";
      noCreditsModal.setAttribute("role", "alertdialog");
      noCreditsModal.setAttribute("aria-modal", "true");
      noCreditsModal.innerHTML = `
        <div class="modal-card credits-modal-card">
          <button type="button" class="credits-modal-close" id="closeNoCreditsBtn" aria-label="Kapat">✕</button>
          <div class="credits-modal-icon">🎟️</div>
          <h3>Oyun Hakkınız Kalmadı</h3>
          <p class="credits-modal-subtitle" style="font-weight:700; color:var(--ink-dark, #241C18);">
            Oyun hakkınız kalmadı.
          </p>
          <div class="credits-modal-actions">
            <button type="button" class="modal-close-btn" id="cancelNoCreditsBtn">Kapat</button>
            <button type="button" class="primary-btn" id="openBuyMenuFromAlertBtn">🛒 Oyun Satın Al</button>
          </div>
        </div>
      `;
      document.body.appendChild(noCreditsModal);

      const closeNoCreditsFn = () => {
        noCreditsModal.style.display = "none";
      };
      document.getElementById("closeNoCreditsBtn").addEventListener("click", closeNoCreditsFn);
      document.getElementById("cancelNoCreditsBtn").addEventListener("click", closeNoCreditsFn);
      noCreditsModal.addEventListener("click", (e) => {
        if (e.target === noCreditsModal) closeNoCreditsFn();
      });
      document.getElementById("openBuyMenuFromAlertBtn").addEventListener("click", () => {
        closeNoCreditsFn();
        highlightBuyDropdown();
      });
    }
  }

  function openLoginPromptModal(reasonText) {
    ensureModalsExist();
    closeAllPackageDropdowns();
    const modal = document.getElementById("creditsLoginPromptModal");
    const reasonEl = document.getElementById("loginPromptReason");
    if (reasonEl && reasonText) reasonEl.textContent = reasonText;
    if (modal) modal.style.display = "flex";
  }

  function openNoCreditsModal() {
    ensureModalsExist();
    closeAllPackageDropdowns();
    const modal = document.getElementById("noCreditsAlertModal");
    if (modal) modal.style.display = "flex";
  }

  function openPurchaseModal() {
    closeAllPackageDropdowns();
    notifyToast("Ödeme sistemi yakında aktif olacak!", "info");
  }

  function bindDropdownUI() {
    const buyBtn = document.getElementById("buyGamesBtn");
    const buyMenu = document.getElementById("buyGamesMenu");

    if (buyBtn && buyMenu && !buyBtn.dataset.creditsBound) {
      buyBtn.dataset.creditsBound = "1";
      buyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isClosed = buyMenu.style.display === "none" || !buyMenu.style.display;
        closeAllPackageDropdowns();
        if (isClosed) {
          buyMenu.style.display = "block";
          buyBtn.setAttribute("aria-expanded", "true");
        }
      });

      buyMenu.querySelectorAll("[data-package-games]").forEach(itemBtn => {
        itemBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const gamesCount = parseInt(itemBtn.dataset.packageGames, 10);
          openPurchaseModal(gamesCount);
        });
      });
    }

    document.querySelectorAll("[data-credits-badge], #remainingGamesBadge, #setupRemainingGamesBadge").forEach(badge => {
      if (badge.dataset.badgeBound) return;
      badge.dataset.badgeBound = "1";
      badge.style.cursor = "pointer";
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!_currentUser) {
          openLoginPromptModal("Kalan oyun hakkınızı görmek ve yeni oyun başlatmak için giriş yapın.");
        } else if (document.getElementById("buyGamesBtn")) {
          highlightBuyDropdown();
        }
      });
    });

    window.addEventListener("click", (e) => {
      if (!e.target.closest(".buy-games-wrap")) {
        closeAllPackageDropdowns();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllPackageDropdowns();
        const pkgModal = document.getElementById("packageConfirmModal");
        const loginModal = document.getElementById("creditsLoginPromptModal");
        const noCreditsModal = document.getElementById("noCreditsAlertModal");
        if (pkgModal) pkgModal.style.display = "none";
        if (loginModal) loginModal.style.display = "none";
        if (noCreditsModal) noCreditsModal.style.display = "none";
      }
    });
  }

  function init() {
    bindDropdownUI();
    fetchCredits();

    const client = getClient();
    if (client && !_authSubscribed) {
      _authSubscribed = true;
      client.auth.onAuthStateChange((event, session) => {
        const nextUser = session ? session.user : null;
        const prevId = _currentUser ? _currentUser.id : null;
        const nextId = nextUser ? nextUser.id : null;
        if (prevId !== nextId) {
          _currentUser = nextUser;
          fetchCredits();
        }
      });
    }
  }

  window.SorBakalimCredits = {
    PACKAGES: PACKAGES,
    fetchCredits: fetchCredits,
    addCredits: addCredits,
    consumeGameCredit: consumeGameCredit,
    getGamesRemaining: () => _gamesRemaining,
    getTotalPurchased: () => _totalPurchased,
    getCurrentUser: () => _currentUser,
    isLoggedIn: () => Boolean(_currentUser),
    openPurchaseModal: openPurchaseModal,
    openLoginPromptModal: openLoginPromptModal,
    openNoCreditsModal: openNoCreditsModal,
    highlightBuyDropdown: highlightBuyDropdown,
    closeDropdowns: closeAllPackageDropdowns
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
