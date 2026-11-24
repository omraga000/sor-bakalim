/**
 * Sor Bakalım - Supabase Frontend Authentication & Shared Navbar Profile Module
 * Safe Auth Client - No plain-text passwords stored or logged.
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://fzxrqvobatablbtssggo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM";

  let supabaseClient = null;

  // Initialize or get the Supabase Client safely
  function getClient() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      } catch (err) {
        console.error("Supabase istemcisi oluşturulurken hata:", err);
      }
    } else {
      console.warn("Supabase SDK henüz yüklenmedi veya tanımlanmadı.");
    }
    return supabaseClient;
  }

  // Helper to format ISO date to readable Turkish date
  function formatTurkishDate(isoString) {
    if (!isoString) return "Yeni Üye";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(d);
    } catch (_) {
      return "Bilinmiyor";
    }
  }

  // Generate 2-character initials from full name or email
  function getInitials(name, email) {
    if (name && typeof name === 'string' && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && typeof email === 'string') {
      return email.slice(0, 2).toUpperCase();
    }
    return "SB";
  }

  // Safe HTML string escape
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Interactive Toast notification helper (matches index.html style)
  function showToast(message, type = "info") {
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
    }, 3800);
  }

  // Update Dynamic Navbar across all pages
  function updateNavbars(user) {
    const containers = document.querySelectorAll(".auth, #navAuth, #adminAuthNav, #gameAuthNav");
    if (!containers.length) return;

    const currentPath = (window.location.pathname || '').toLowerCase();
    const isGiris = currentPath.includes("giris.html");
    const isKayit = currentPath.includes("kayit.html");

    containers.forEach((container, index) => {
      if (!user) {
        // User is LOGGED OUT
        container.classList.remove("is-logged-in");
        container.innerHTML = `
          <a href="giris.html" class="${isGiris ? 'on' : ''}" title="Hesabına Giriş Yap">Giriş Yap</a>
          <span class="sep"></span>
          <a href="kayit.html" class="${isKayit ? 'on' : ''}" title="Yeni Hesap Oluştur">Hesap Oluştur</a>
        `;
      } else {
        // User is LOGGED IN
        container.classList.add("is-logged-in");
        const fullName = (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0];
        const email = user.email || "";
        const initials = getInitials(fullName, email);
        const joinDate = formatTurkishDate(user.created_at);
        const uniqueId = `profileMenu_${index}_${Math.random().toString(36).substr(2, 4)}`;

        container.innerHTML = `
          <div class="user-profile-menu" id="${uniqueId}">
            <button type="button" class="user-avatar-btn" aria-label="Kullanıcı Profili: ${escapeHtml(fullName)}" aria-expanded="false" title="${escapeHtml(fullName)} (${escapeHtml(email)})">
              <span class="avatar-initials">${escapeHtml(initials)}</span>
            </button>
            <div class="user-dropdown-card" style="display: none;" role="menu">
              <div class="dropdown-header">
                <div class="dropdown-avatar-circle">${escapeHtml(initials)}</div>
                <div class="dropdown-user-details">
                  <div class="dropdown-user-name" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
                  <div class="dropdown-user-email" title="${escapeHtml(email)}">${escapeHtml(email)}</div>
                  <span class="dropdown-status-badge">🎮 Oyuncu</span>
                </div>
              </div>
              <div class="dropdown-meta">
                <span class="meta-label">Kayıt Tarihi:</span>
                <span class="meta-val">${joinDate}</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-actions">
                <a href="index.html#oyun" class="dropdown-item-link" title="Yeni Bilgi Yarışması Başlat">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  <span>Oyun Başlat</span>
                </a>
                <a href="oyunlarim.html" class="dropdown-item-link" title="Kayıtlı ve Geçmiş Oyunlarım">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  <span>Oyunlarım</span>
                </a>
                <a href="iletisim.html" class="dropdown-item-link" title="Geri Bildirim &amp; İletişim">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <span>İletişim &amp; Destek</span>
                </a>
                <button type="button" class="dropdown-logout-btn" data-action="logout" title="Oturumu Güvenli Şekilde Sonlandır">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </div>
          </div>
        `;

        // Bind dropdown events
        const menuEl = container.querySelector(".user-profile-menu");
        const btn = menuEl.querySelector(".user-avatar-btn");
        const card = menuEl.querySelector(".user-dropdown-card");
        const logoutBtn = menuEl.querySelector('[data-action="logout"]');

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isClosed = card.style.display === "none";
          // Close all open menus first
          document.querySelectorAll(".user-dropdown-card").forEach(c => { c.style.display = "none"; });
          document.querySelectorAll(".user-avatar-btn").forEach(b => { b.setAttribute("aria-expanded", "false"); });

          if (isClosed) {
            card.style.display = "block";
            btn.setAttribute("aria-expanded", "true");
          }
        });

        if (logoutBtn) {
          logoutBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            logoutBtn.disabled = true;
            logoutBtn.innerHTML = `<span>Çıkış Yapılıyor...</span>`;
            await window.SorBakalimAuth.signOut();
            showToast("Başarıyla çıkış yapıldı.", "info");
          });
        }
      }
    });
  }

  // Close dropdown on outside click or escape key
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".user-profile-menu")) {
      document.querySelectorAll(".user-dropdown-card").forEach(c => {
        c.style.display = "none";
      });
      document.querySelectorAll(".user-avatar-btn").forEach(b => {
        b.setAttribute("aria-expanded", "false");
      });
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".user-dropdown-card").forEach(c => {
        c.style.display = "none";
      });
      document.querySelectorAll(".user-avatar-btn").forEach(b => {
        b.setAttribute("aria-expanded", "false");
      });
    }
  });

  // Global Auth Helper API
  window.SorBakalimAuth = {
    getClient: getClient,

    getSession: async function () {
      const client = getClient();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session;
      } catch (err) {
        console.warn("Session alma hatası:", err);
        return null;
      }
    },

    getUser: async function () {
      const client = getClient();
      if (!client) return null;
      try {
        const { data: { user } } = await client.auth.getUser();
        return user;
      } catch (_) {
        return null;
      }
    },

    signUp: async function (email, password, fullName) {
      const client = getClient();
      if (!client) throw new Error("Supabase bağlantısı kurulamadı.");
      return await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
    },

    signIn: async function (email, password) {
      const client = getClient();
      if (!client) throw new Error("Supabase bağlantısı kurulamadı.");
      return await client.auth.signInWithPassword({
        email: email,
        password: password
      });
    },

    signOut: async function () {
      const client = getClient();
      if (!client) return;
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn("Sign out hatası:", e);
      }
      updateNavbars(null);
    },

    updateNavbars: updateNavbars
  };

  // Auto-init on page load
  async function setup() {
    const client = getClient();
    if (!client) {
      updateNavbars(null);
      return;
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      updateNavbars(session ? session.user : null);
    } catch (_) {
      updateNavbars(null);
    }

    // Subscribe to real-time auth changes
    client.auth.onAuthStateChange((event, session) => {
      updateNavbars(session ? session.user : null);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
