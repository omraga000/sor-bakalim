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
   * Kullanıcı için public.user_game_credits satırının var olmasını garanti eder.
   * Satır yoksa { user_id, email, games_remaining: 1, total_purchased: 0 } ekler.
   */
  async function ensureUserCreditsRow(userId, email) {
    const client = getClient();
    if (!client || !userId) {
      return { success: false, error: "Kullanıcı bilgisi veya Supabase istemcisi eksik." };
    }

    try {
      const { data: existing, error: readErr } = await client
        .from(CREDITS_TABLE)
        .select("user_id, email, games_remaining, total_purchased")
        .eq("user_id", userId)
        .maybeSingle();

      if (readErr) {
        return { success: false, error: readErr.message };
      }

      if (existing) {
        return {
          success: true,
          created: false,
          row: existing,
          gamesRemaining: Number(existing.games_remaining) || 0,
          totalPurchased: Number(existing.total_purchased) || 0
        };
      }

      const payload = {
        user_id: userId,
        email: email || "",
        games_remaining: 1,
        total_purchased: 0
      };

      const { data: inserted, error: insertErr } = await client
        .from(CREDITS_TABLE)
        .insert(payload)
        .select("user_id, email, games_remaining, total_purchased")
        .single();

      if (insertErr) {
        // Eşzamanlı ekleme çakışması durumunda tekrar oku
        const { data: retryRow } = await client
          .from(CREDITS_TABLE)
          .select("user_id, email, games_remaining, total_purchased")
          .eq("user_id", userId)
          .maybeSingle();

        if (retryRow) {
          return {
            success: true,
            created: false,
            row: retryRow,
            gamesRemaining: Number(retryRow.games_remaining) || 0,
            totalPurchased: Number(retryRow.total_purchased) || 0
          };
        }
        return { success: false, error: insertErr.message };
      }

      return {
        success: true,
        created: true,
        row: inserted,
        gamesRemaining: inserted ? Number(inserted.games_remaining) : 1,
        totalPurchased: inserted ? Number(inserted.total_purchased) : 0
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

      const res = await ensureUserCreditsRow(user.id, user.email || "");
      if (!res.success) {
        console.warn("user_game_credits okuma/oluşturma hatası:", res.error);
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

  async function addCredits(amount) {
    const gamesToAdd = parseInt(amount, 10);
    if (!gamesToAdd || gamesToAdd <= 0) {
      return { success: false, error: "Geçersiz oyun paketi miktarı." };
    }

    const client = getClient();
    if (!client) {
      return { success: false, error: "Supabase bağlantısı kurulamadı." };
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    _currentUser = user;

    if (!user) {
      return { success: false, needsAuth: true, error: "Paket satın almak için giriş yapmalısınız." };
    }

    try {
      const ensured = await ensureUserCreditsRow(user.id, user.email || "");
      if (!ensured.success) {
        return { success: false, error: ensured.error };
      }

      const newRemaining = (Number(ensured.gamesRemaining) || 0) + gamesToAdd;
      const newPurchased = (Number(ensured.totalPurchased) || 0) + gamesToAdd;

      const { data: updated, error: updErr } = await client
        .from(CREDITS_TABLE)
        .update({
          email: user.email || "",
          games_remaining: newRemaining,
          total_purchased: newPurchased
        })
        .eq("user_id", user.id)
        .select("games_remaining, total_purchased")
        .single();

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      _gamesRemaining = updated ? Number(updated.games_remaining) : newRemaining;
      _totalPurchased = updated ? Number(updated.total_purchased) : newPurchased;

      updateCreditBadges();
      return { success: true, gamesRemaining: _gamesRemaining, totalPurchased: _totalPurchased };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async function consumeGameCredit() {
    const client = getClient();
    if (!client) {
      return { success: false, error: "Supabase bağlantısı kurulamadı." };
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    _currentUser = user;

    if (!user) {
      return { success: false, needsAuth: true, error: "Oyuna başlamak için giriş yapmalısınız." };
    }

    try {
      const ensured = await ensureUserCreditsRow(user.id, user.email || "");
      if (!ensured.success) {
        return { success: false, error: ensured.error };
      }

      const currentCount = Number(ensured.gamesRemaining) || 0;

      if (currentCount <= 0) {
        _gamesRemaining = 0;
        _totalPurchased = Number(ensured.totalPurchased) || 0;
        updateCreditBadges();
        return {
          success: false,
          insufficient: true,
          gamesRemaining: 0,
          error: "Oyun krediniz bitti! Yeni oyun oynamak için paket satın almalısınız."
        };
      }

      const newCount = currentCount - 1;
      const { data: updated, error: updErr } = await client
        .from(CREDITS_TABLE)
        .update({ games_remaining: newCount })
        .eq("user_id", user.id)
        .select("games_remaining, total_purchased")
        .single();

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      _gamesRemaining = updated ? Number(updated.games_remaining) : newCount;
      _totalPurchased = updated ? Number(updated.total_purchased) : _totalPurchased;
      updateCreditBadges();
      return { success: true, gamesRemaining: _gamesRemaining };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
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
          <h3>Oyun Krediniz Bitti!</h3>
          <p class="credits-modal-subtitle" style="font-weight:700; color:var(--ink-dark, #241C18);">
            Oyun krediniz bitti! Yeni oyun oynamak için paket satın almalısınız.
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

  function openPurchaseModal(pkgId) {
    const pkg = typeof pkgId === "object" ? pkgId : PACKAGES.find(p => p.id === pkgId || p.games === Number(pkgId));
    if (!pkg) return;

    closeAllPackageDropdowns();

    if (!_currentUser) {
      openLoginPromptModal(`${pkg.title} paketini satın almak için lütfen önce giriş yapın.`);
      return;
    }

    ensureModalsExist();
    _selectedPackage = pkg;

    const currentCount = typeof _gamesRemaining === "number" ? _gamesRemaining : 0;
    const afterCount = currentCount + pkg.games;

    const iconEl = document.getElementById("pkgModalIcon");
    const titleEl = document.getElementById("pkgModalTitle");
    const nameEl = document.getElementById("pkgSummaryName");
    const detailEl = document.getElementById("pkgSummaryDetail");
    const curEl = document.getElementById("pkgSummaryCurrent");
    const afterEl = document.getElementById("pkgSummaryAfter");

    if (iconEl) iconEl.textContent = pkg.icon;
    if (titleEl) titleEl.textContent = `${pkg.title} Paketi`;
    if (nameEl) nameEl.textContent = pkg.title;
    if (detailEl) detailEl.textContent = pkg.subtitle;
    if (curEl) curEl.textContent = `${currentCount} Oyun`;
    if (afterEl) afterEl.textContent = `${afterCount} Oyun`;

    const modal = document.getElementById("packageConfirmModal");
    if (modal) modal.style.display = "flex";
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
    ensureUserCreditsRow: ensureUserCreditsRow,
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
