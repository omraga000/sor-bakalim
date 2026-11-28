/**
 * Sor Bakalım - Admin Dashboard & Kategori / Soru Yönetim Sistemi
 * Vanilla JavaScript CRUD Engine & Tam Senkronizasyon (localStorage)
 */

(function () {
  'use strict';

  // --- STRICT ADMIN ACCESS CONFIGURATION ---
  const ADMIN_EMAIL = "sorbakalim.iletisim@outlook.com";
  const SUPABASE_URL = "https://fzxrqvobatablbtssggo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM";

  function getAdminSupabaseClient() {
    if (window.SorBakalimAuth && typeof window.SorBakalimAuth.getClient === 'function') {
      const authClient = window.SorBakalimAuth.getClient();
      if (authClient) return authClient;
    }
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        return window.supabaseClient;
      } catch (e) {
        console.error("Admin Supabase istemcisi başlatılamadı:", e);
      }
    }
    return null;
  }

  function isAuthorizedAdmin(session) {
    return Boolean(
      session &&
      session.user &&
      typeof session.user.email === 'string' &&
      session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
  }

  function revealAdminUI() {
    const header = document.getElementById('adminHeader');
    const main = document.getElementById('adminMainContainer') || document.querySelector('main.admin-container');
    const footer = document.getElementById('adminFooter');
    if (header) header.style.display = '';
    if (main) main.style.display = '';
    if (footer) footer.style.display = '';
  }

  // --- LOCAL STORAGE KEYS (Sadece İstatistik ve Mesajlar - Kategoriler ve Sorular 100% Supabase'de) ---
  const STORAGE_KEYS = {
    STATS: 'sorBakalimStats',
    MESSAGES: 'sorBakalimMessages'
  };

  // --- STATE ---
  let categories = [];
  let questions = [];
  let stats = {};
  let editingQuestionId = null;
  let questionPendingDeleteId = null;
  let categoryPendingDeleteId = null;
  let currentCategoryBase64 = '';
  let currentQuestionBase64 = '';

  // --- DOM SELECTORS ---
  const el = {
    // Stats
    statVisitors: document.getElementById('statVisitors'),
    statGamesPlayed: document.getElementById('statGamesPlayed'),
    statTotalCategories: document.getElementById('statTotalCategories'),
    statTotalQuestions: document.getElementById('statTotalQuestions'),
    categoriesRankingGrid: document.getElementById('categoriesRankingGrid'),

    // Category Management
    categoryForm: document.getElementById('categoryForm'),
    categoryNameInput: document.getElementById('categoryNameInput'),
    categoryEmojiInput: document.getElementById('categoryEmojiInput'),
    categoryInfoInput: document.getElementById('categoryInfoInput'),
    categoryImageInput: document.getElementById('categoryImageInput'),
    categoryImagePreviewWrap: document.getElementById('categoryImagePreviewWrap'),
    categoryImagePreviewImg: document.getElementById('categoryImagePreviewImg'),
    removeCategoryImgBtn: document.getElementById('removeCategoryImgBtn'),
    categoryCardsGrid: document.getElementById('categoryCardsGrid'),
    categoryCountBadge: document.getElementById('categoryCountBadge'),

    // Question Management Form
    questionForm: document.getElementById('questionForm'),
    formTitle: document.getElementById('formTitle'),
    editBadgeIndicator: document.getElementById('editBadgeIndicator'),
    questionIdInput: document.getElementById('questionIdInput'),
    categorySelect: document.getElementById('categorySelect'),
    questionTextInput: document.getElementById('questionTextInput'),
    questionImageInput: document.getElementById('questionImageInput'),
    imagePreviewWrap: document.getElementById('imagePreviewWrap'),
    imagePreviewImg: document.getElementById('imagePreviewImg'),
    removeQuestionImgBtn: document.getElementById('removeQuestionImgBtn'),
    answerInput: document.getElementById('answerInput'),
    submitBtn: document.getElementById('submitBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    resetFormBtn: document.getElementById('resetFormBtn'),

    // Questions Table & Filters
    questionsTableBody: document.getElementById('questionsTableBody'),
    tableEmptyState: document.getElementById('tableEmptyState'),
    tableCountBadge: document.getElementById('tableCountBadge'),
    searchInput: document.getElementById('searchInput'),
    filterCategory: document.getElementById('filterCategory'),
    filterPoints: document.getElementById('filterPoints'),
    quickAddBtn: document.getElementById('quickAddBtn'),
    resetDataBtn: document.getElementById('resetDataBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),

    // Modals
    deleteModal: document.getElementById('deleteModal'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    deleteModalQuestionText: document.getElementById('deleteModalQuestionText'),

    deleteCategoryModal: document.getElementById('deleteCategoryModal'),
    cancelDeleteCategoryBtn: document.getElementById('cancelDeleteCategoryBtn'),
    confirmDeleteCategoryBtn: document.getElementById('confirmDeleteCategoryBtn'),
    delCatModalDesc: document.getElementById('delCatModalDesc'),
    delCatWarningBox: document.getElementById('delCatWarningBox'),

    imageModal: document.getElementById('imageModal'),
    modalPreviewPic: document.getElementById('modalPreviewPic'),
    closeImageModalBtn: document.getElementById('closeImageModalBtn'),

    // Messages Modal & Buttons
    viewMessagesBtn: document.getElementById('viewMessagesBtn'),
    messagesCountBadge: document.getElementById('messagesCountBadge'),
    messagesModal: document.getElementById('messagesModal'),
    modalMessagesCount: document.getElementById('modalMessagesCount'),
    clearAllMessagesBtn: document.getElementById('clearAllMessagesBtn'),
    messagesListContainer: document.getElementById('messagesListContainer'),
    closeMessagesModalBtn: document.getElementById('closeMessagesModalBtn'),

    // Supabase Cloud Sync UI Elements
    syncSupabaseBtn: document.getElementById('syncSupabaseBtn'),
    supabaseSyncStatus: document.getElementById('supabaseSyncStatus'),
    supabaseStatusText: document.getElementById('supabaseStatusText'),

    // Admin Credits Top-Up Card
    adminAddCreditsForm: document.getElementById('adminAddCreditsForm'),
    adminCreditEmailInput: document.getElementById('adminCreditEmailInput'),
    adminCreditAmountInput: document.getElementById('adminCreditAmountInput'),
    adminAddCreditsBtn: document.getElementById('adminAddCreditsBtn'),
    adminCreditsResult: document.getElementById('adminCreditsResult'),
    adminOwnCreditsBadge: document.getElementById('adminOwnCreditsBadge'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- SUPABASE STATUS HELPER ---
  function updateSupabaseStatus(text, statusClass = '') {
    if (el.supabaseStatusText) el.supabaseStatusText.textContent = text;
    if (el.supabaseSyncStatus) {
      el.supabaseSyncStatus.classList.remove('online', 'error');
      if (statusClass) el.supabaseSyncStatus.classList.add(statusClass);
    }
  }

  // Helper: Refresh Admin's Own Live Credit Balance Badge
  async function refreshAdminOwnCredits() {
    const supabase = getAdminSupabaseClient();
    if (!supabase) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: row, error } = await supabase
        .from('user_game_credits')
        .select('games_remaining, total_purchased')
        .eq('user_id', user.id)
        .maybeSingle();

      const bal = (!error && row && typeof row.games_remaining === 'number') ? row.games_remaining : 0;
      if (el.adminOwnCreditsBadge) {
        el.adminOwnCreditsBadge.textContent = `🎟️ Kalan Oyun Hakkım: ${bal}`;
      }
      if (window.SorBakalimCredits && typeof window.SorBakalimCredits.fetchCredits === 'function') {
        window.SorBakalimCredits.fetchCredits().catch(() => {});
      }
      return { user, row, balance: bal };
    } catch (_) {
      return null;
    }
  }

  // --- INITIALIZATION ---
  async function init() {
    // 1. Strict Admin Session Verification (Hide UI & halt until verified)
    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      window.location.replace("index.html");
      return;
    }

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !isAuthorizedAdmin(session)) {
        window.location.replace("index.html");
        return;
      }
      // Sunucu doğrulamalı JWT kontrolü (getUser) — yerel sahte oturumları engeller
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user || typeof user.email !== 'string' || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        window.location.replace("index.html");
        return;
      }
    } catch (authErr) {
      console.warn("Admin oturum doğrulaması başarısız:", authErr);
      window.location.replace("index.html");
      return;
    }

    // 2. Real-time Auth State Change Guard (Redirect immediately on sign out)
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !isAuthorizedAdmin(session)) {
        window.location.replace("index.html");
      }
    });

    // 3. Verified Admin — Reveal Admin UI and load live data
    revealAdminUI();
    refreshAdminOwnCredits();

    try {
      loadStats();
      renderCategoriesGrid();
      populateCategoryDropdowns();
      renderStats();
      renderQuestionsTable();
      updateMessagesBadge();
      setupEventListeners();

      // Supabase'den güncel satırları TEK ORTAK FONKSİYONDAN çek (Single Source of Truth)
      if (window.SorBakalimData && typeof window.SorBakalimData.loadGlobalCategories === 'function') {
        updateSupabaseStatus("Bağlanıyor...", "");
        try {
          const res = await window.SorBakalimData.loadGlobalCategories();
          if (res && res.success) {
            categories = window.SorBakalimData.getCategories();
            questions = window.SorBakalimData.getQuestions();
            renderCategoriesGrid();
            populateCategoryDropdowns();
            renderStats();
            renderQuestionsTable();
            updateSupabaseStatus(`Aktif (${res.count} Kategori)`, "online");
          } else {
            categories = window.SorBakalimData.getCategories();
            questions = window.SorBakalimData.getQuestions();
            renderCategoriesGrid();
            populateCategoryDropdowns();
            renderStats();
            renderQuestionsTable();
            updateSupabaseStatus("Çevrimdışı / Tablo Bekleniyor", "error");
          }
        } catch (err) {
          console.warn("admin.html Supabase bağlantı uyarısı:", err);
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      }
    } catch (err) {
      console.error("admin.html başlatılırken yakalanan hata:", err);
    }
  }

  // ==========================================================================
  // CATEGORIES LOGIC (CRUD)
  // ==========================================================================

  async function handleCategorySubmit(e) {
    e.preventDefault();

    const name = el.categoryNameInput.value.trim();
    if (!name) {
      showToast("Lütfen bir kategori adı girin.", "error");
      el.categoryNameInput.focus();
      return;
    }

    // Check duplicate name
    const nameExists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      showToast(`'${name}' adında bir kategori zaten mevcut.`, "error");
      el.categoryNameInput.focus();
      return;
    }

    const emoji = el.categoryEmojiInput.value.trim() || "🎯";
    const info = el.categoryInfoInput.value.trim() || `${name} kategorisi hakkında sorular`;
    const img = currentCategoryBase64 || "";

    // Generate unique slug
    const slugBase = slugifyTurkish(name);
    let id = slugBase;
    let counter = 1;
    while (categories.some(c => c.id === id)) {
      id = `${slugBase}-${counter++}`;
    }

    const newCategory = {
      id: id,
      name: name,
      emoji: emoji,
      img: img,
      info: info,
      created_at: new Date().toISOString()
    };

    // Reset Form & Base64
    el.categoryForm.reset();
    el.categoryEmojiInput.value = "🎯";
    currentCategoryBase64 = '';
    if (el.categoryImageInput) el.categoryImageInput.value = '';
    if (el.categoryImagePreviewWrap) el.categoryImagePreviewWrap.style.display = 'none';
    if (el.categoryImagePreviewImg) el.categoryImagePreviewImg.src = '';

    updateSupabaseStatus("Kaydediliyor...", "");

    // Doğrudan Supabase'e yaz ve listeyi Supabase'den canlı yenile
    if (window.SorBakalimData && typeof window.SorBakalimData.saveCategory === 'function') {
      try {
        const res = await window.SorBakalimData.saveCategory(newCategory, []);
        if (res && res.success) {
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();

          showToast(`'${name}' kategorisi Supabase bulut veritabanına kaydedildi! 🌐`, "success");
          updateSupabaseStatus(`Aktif (${categories.length} Kategori)`, "online");
        } else {
          showToast(`Hata: ${res.error || 'Kategori kaydedilemedi'}`, "error");
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      } catch (err) {
        showToast(`Hata: ${err.message || err}`, "error");
        updateSupabaseStatus("Bağlantı Hatası", "error");
      }
    } else {
      showToast("Supabase senkronizasyon motoru hazır değil.", "error");
    }
  }

  function promptDeleteCategory(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    categoryPendingDeleteId = catId;

    // Count how many questions belong to this category
    const catQuestionsCount = questions.filter(q => 
      q.categoryId === catId || 
      (q.category && q.category.toLowerCase() === cat.name.toLowerCase())
    ).length;

    if (el.delCatModalDesc) {
      el.delCatModalDesc.innerHTML = `<strong>${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</strong> kategorisini silmek üzeresiniz.`;
    }

    if (el.delCatWarningBox) {
      el.delCatWarningBox.innerHTML = `⚠️ DİKKAT: Bu kategoriyi sildiğinizde, bu kategoriye ait <strong>${catQuestionsCount} adet soru</strong> da otomatik olarak sistemden ve oyundan silinecektir!`;
    }

    openModal(el.deleteCategoryModal);
  }

  async function confirmDeleteCategory() {
    if (!categoryPendingDeleteId) return;

    const cat = categories.find(c => c.id === categoryPendingDeleteId);
    const catName = cat ? cat.name : categoryPendingDeleteId;
    const catId = categoryPendingDeleteId;

    closeModal(el.deleteCategoryModal);
    categoryPendingDeleteId = null;

    updateSupabaseStatus("Siliniyor...", "");

    // Doğrudan Supabase'den sil ve listeyi Supabase'den canlı yenile
    if (window.SorBakalimData && typeof window.SorBakalimData.deleteCategory === 'function') {
      try {
        const res = await window.SorBakalimData.deleteCategory(catId);
        if (res && res.success) {
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();

          showToast(`'${catName}' kategorisi Supabase veritabanından kalıcı olarak silindi. 🌐`, "info");
          updateSupabaseStatus(`Aktif (${categories.length} Kategori)`, "online");
        } else {
          showToast(`Silme hatası: ${res.error || 'Silinemedi'}`, "error");
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      } catch (err) {
        showToast(`Silme hatası: ${err.message || err}`, "error");
        updateSupabaseStatus("Bağlantı Hatası", "error");
      }
    } else {
      showToast("Supabase senkronizasyon motoru hazır değil.", "error");
    }
  }

  function renderCategoriesGrid() {
    if (!el.categoryCardsGrid) return;

    if (el.categoryCountBadge) {
      el.categoryCountBadge.textContent = `${categories.length} Kategori`;
    }

    if (categories.length === 0) {
      el.categoryCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-dim);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏷️</div>
          <p style="font-weight: 600; color: #FFFFFF;">Henüz kategori eklenmemiş.</p>
          <p style="font-size: 0.85rem;">Soldaki formu kullanarak ilk kategorinizi ekleyebilirsiniz.</p>
        </div>
      `;
      return;
    }

    el.categoryCardsGrid.innerHTML = categories.map(cat => {
      // Count questions in this category
      const qCount = questions.filter(q => 
        q.categoryId === cat.id || 
        (q.category && q.category.toLowerCase() === cat.name.toLowerCase())
      ).length;

      const hasImg = cat.img && cat.img.trim().length > 5;

      return `
        <div class="cat-admin-card" data-cat-id="${cat.id}">
          <div class="cat-card-top">
            <div class="cat-emoji-avatar">
              ${hasImg ? `<img src="${escapeHtml(cat.img)}" alt="${escapeHtml(cat.name)}">` : (cat.emoji || '🎯')}
            </div>
            <div class="cat-card-details">
              <h4 class="cat-card-title" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</h4>
              <span class="cat-card-slug">id: ${escapeHtml(cat.id)}</span>
              <p class="cat-card-desc" title="${escapeHtml(cat.info)}">${escapeHtml(cat.info || 'Açıklama belirtilmedi.')}</p>
            </div>
          </div>
          <div class="cat-card-bottom">
            <span class="cat-q-badge">${qCount} Soru</span>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.SorBakalimAdmin.deleteCategory('${cat.id}')" title="Bu kategoriyi ve tüm sorularını sil">
              Sil
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // QUESTIONS LOGIC (CRUD)
  // ==========================================================================

  function populateCategoryDropdowns() {
    // Populate Question Form Category Select
    if (el.categorySelect) {
      const currentSelected = el.categorySelect.value;
      if (categories.length === 0) {
        el.categorySelect.innerHTML = `<option value="" disabled selected>Önce yukarıdan kategori ekleyin</option>`;
      } else {
        el.categorySelect.innerHTML = `
          <option value="" disabled ${!currentSelected ? 'selected' : ''}>Kategori Seçin...</option>
          ${categories.map(c => `
            <option value="${escapeHtml(c.id)}" ${currentSelected === c.id ? 'selected' : ''}>
              ${c.emoji || '🏷️'} ${escapeHtml(c.name)}
            </option>
          `).join('')}
        `;
      }
    }

    // Populate Table Filter Category Select
    if (el.filterCategory) {
      const curFilter = el.filterCategory.value;
      el.filterCategory.innerHTML = `
        <option value="all">Tüm Kategoriler (${questions.length})</option>
        ${categories.map(c => {
          const count = questions.filter(q => q.categoryId === c.id || (q.category && q.category.toLowerCase() === c.name.toLowerCase())).length;
          return `<option value="${escapeHtml(c.id)}" ${curFilter === c.id ? 'selected' : ''}>
            ${c.emoji || '🏷️'} ${escapeHtml(c.name)} (${count})
          </option>`;
        }).join('')}
      `;
    }
  }

  async function handleQuestionSubmit(e) {
    e.preventDefault();

    const categoryId = el.categorySelect.value;
    if (!categoryId) {
      showToast("Lütfen bir kategori seçin.", "error");
      el.categorySelect.focus();
      return;
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const categoryName = selectedCategory ? selectedCategory.name : categoryId;
    const categoryEmoji = selectedCategory ? selectedCategory.emoji : "🎯";

    const questionText = el.questionTextInput.value.trim();
    if (!questionText) {
      showToast("Lütfen soru metnini yazın.", "error");
      el.questionTextInput.focus();
      return;
    }

    const answer = el.answerInput.value.trim();
    if (!answer) {
      showToast("Lütfen doğru cevabı belirtin.", "error");
      el.answerInput.focus();
      return;
    }

    const pointsRadio = document.querySelector('input[name="points"]:checked');
    const points = pointsRadio ? parseInt(pointsRadio.value, 10) : 200;
    const imageUrl = currentQuestionBase64 || "";

    const questionObj = {
      id: editingQuestionId || ("q_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
      categoryId: categoryId,
      category: categoryName,
      categoryEmoji: categoryEmoji,
      points: points,
      question: questionText,
      answer: answer,
      imageUrl: imageUrl
    };

    updateSupabaseStatus("Kaydediliyor...", "");
    resetQuestionForm();

    // Doğrudan Supabase'e yaz ve listeyi Supabase'den canlı yenile
    if (window.SorBakalimData && typeof window.SorBakalimData.saveQuestion === 'function') {
      try {
        const res = await window.SorBakalimData.saveQuestion(questionObj, categoryId);
        if (res && res.success) {
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();

          showToast(`Soru Supabase bulut veritabanına kaydedildi! 🌐`, "success");
          updateSupabaseStatus(`Aktif (${categories.length} Kategori)`, "online");
        } else {
          showToast(`Hata: ${res.error || 'Soru kaydedilemedi'}`, "error");
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      } catch (err) {
        showToast(`Hata: ${err.message || err}`, "error");
        updateSupabaseStatus("Bağlantı Hatası", "error");
      }
    } else {
      showToast("Supabase senkronizasyon motoru hazır değil.", "error");
    }
  }

  function startEditQuestion(id) {
    const q = questions.find(item => item.id === id);
    if (!q) {
      showToast("Soru bulunamadı.", "error");
      return;
    }

    editingQuestionId = id;
    el.questionIdInput.value = q.id;

    // Set category select
    const matchingCat = categories.find(c => c.id === q.categoryId || c.name.toLowerCase() === (q.category || '').toLowerCase());
    if (matchingCat) {
      el.categorySelect.value = matchingCat.id;
    }

    el.questionTextInput.value = q.question;
    el.answerInput.value = q.answer;
    currentQuestionBase64 = q.imageUrl || '';

    // Set points radio
    const targetRadio = document.querySelector(`input[name="points"][value="${q.points}"]`);
    if (targetRadio) targetRadio.checked = true;

    // Update image preview
    if (currentQuestionBase64) {
      if (el.imagePreviewImg) el.imagePreviewImg.src = currentQuestionBase64;
      if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'flex';
    } else {
      if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'none';
      if (el.imagePreviewImg) el.imagePreviewImg.src = '';
    }

    // UI State changes
    el.formTitle.innerHTML = '✏️ Soruyu Düzenle';
    el.editBadgeIndicator.style.display = 'inline-block';
    el.submitBtn.textContent = 'Değişiklikleri Güncelle';
    el.cancelEditBtn.style.display = 'inline-flex';

    // Smooth scroll to form
    el.questionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.questionTextInput.focus();
  }

  function resetQuestionForm() {
    editingQuestionId = null;
    el.questionForm.reset();
    el.questionIdInput.value = '';
    el.formTitle.innerHTML = '➕ Yeni Soru Ekle';
    el.editBadgeIndicator.style.display = 'none';
    el.submitBtn.textContent = '💾 Kaydet';
    el.cancelEditBtn.style.display = 'none';
    currentQuestionBase64 = '';

    // Reset default points to 200
    const radio200 = document.querySelector('input[name="points"][value="200"]');
    if (radio200) radio200.checked = true;

    // Clear preview & file input
    if (el.questionImageInput) el.questionImageInput.value = '';
    if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'none';
    if (el.imagePreviewImg) el.imagePreviewImg.src = '';
  }

  function promptDeleteQuestion(id) {
    const q = questions.find(item => item.id === id);
    if (!q) return;

    questionPendingDeleteId = id;
    if (el.deleteModalQuestionText) {
      el.deleteModalQuestionText.textContent = `"${q.question}"`;
    }
    openModal(el.deleteModal);
  }

  async function confirmDeleteQuestion() {
    if (!questionPendingDeleteId) return;

    const q = questions.find(item => item.id === questionPendingDeleteId);
    const qId = questionPendingDeleteId;
    const catId = q ? q.categoryId : null;

    closeModal(el.deleteModal);
    questionPendingDeleteId = null;

    if (editingQuestionId === qId) {
      resetQuestionForm();
    }

    updateSupabaseStatus("Siliniyor...", "");

    // Doğrudan Supabase'den sil ve listeyi Supabase'den canlı yenile
    if (catId && window.SorBakalimData && typeof window.SorBakalimData.deleteQuestion === 'function') {
      try {
        const res = await window.SorBakalimData.deleteQuestion(qId, catId);
        if (res && res.success) {
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();

          showToast("Soru Supabase bulut veritabanından silindi! 🌐", "info");
          updateSupabaseStatus(`Aktif (${categories.length} Kategori)`, "online");
        } else {
          showToast(`Soru silme hatası: ${res.error || 'Silinemedi'}`, "error");
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      } catch (err) {
        showToast(`Soru silme hatası: ${err.message || err}`, "error");
        updateSupabaseStatus("Bağlantı Hatası", "error");
      }
    } else {
      showToast("Supabase senkronizasyon motoru hazır değil.", "error");
    }
  }

  function renderQuestionsTable() {
    if (!el.questionsTableBody) return;

    const searchTerm = (el.searchInput ? el.searchInput.value.trim().toLowerCase() : '');
    const categoryFilter = (el.filterCategory ? el.filterCategory.value : 'all');
    const pointsFilter = (el.filterPoints ? el.filterPoints.value : 'all');

    const filtered = questions.filter(q => {
      // Category filter match
      if (categoryFilter !== 'all') {
        const cat = categories.find(c => c.id === categoryFilter);
        const matchesId = q.categoryId === categoryFilter;
        const matchesName = cat && q.category && q.category.toLowerCase() === cat.name.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Points match
      if (pointsFilter !== 'all' && q.points.toString() !== pointsFilter) {
        return false;
      }

      // Search match
      if (searchTerm) {
        const inQuestion = (q.question || '').toLowerCase().includes(searchTerm);
        const inAnswer = (q.answer || '').toLowerCase().includes(searchTerm);
        const inCategory = (q.category || '').toLowerCase().includes(searchTerm);
        if (!inQuestion && !inAnswer && !inCategory) return false;
      }

      return true;
    });

    // Update count badge
    if (el.tableCountBadge) {
      el.tableCountBadge.textContent = `${filtered.length} / ${questions.length} Soru`;
    }

    if (filtered.length === 0) {
      el.questionsTableBody.innerHTML = '';
      if (el.tableEmptyState) el.tableEmptyState.style.display = 'flex';
      return;
    }

    if (el.tableEmptyState) el.tableEmptyState.style.display = 'none';

    el.questionsTableBody.innerHTML = filtered.map((q, idx) => {
      // Find category details
      const cat = categories.find(c => c.id === q.categoryId || (c.name && q.category && c.name.toLowerCase() === q.category.toLowerCase()));
      const catDisplayName = cat ? cat.name : (q.category || 'Genel');
      const emoji = cat ? (cat.emoji || '🎯') : (q.categoryEmoji || '🏷️');
      const pointClass = `pts-badge-${q.points}`;
      const hasImage = q.imageUrl && q.imageUrl.trim().length > 5;

      return `
        <tr data-id="${q.id}">
          <td class="td-id">#${idx + 1}</td>
          <td class="td-category">
            <span class="cat-chip">
              <span>${emoji}</span>
              <span>${escapeHtml(catDisplayName)}</span>
            </span>
          </td>
          <td class="td-question">
            <div class="q-text-bold">${escapeHtml(q.question)}</div>
            ${hasImage ? `
              <div class="q-image-thumbnail" onclick="window.SorBakalimAdmin.viewQuestionImage('${q.id}')">
                Görseli Görüntüle
              </div>
            ` : ''}
          </td>
          <td class="td-points">
            <span class="pts-badge ${pointClass}">${q.points} Puan</span>
          </td>
          <td class="td-answer" title="${escapeHtml(q.answer)}">
            ${escapeHtml(q.answer)}
          </td>
          <td class="td-actions">
            <div class="actions-wrap">
              <button type="button" class="btn-table-action btn-edit" onclick="window.SorBakalimAdmin.editQuestion('${q.id}')" title="Soruyu Düzenle">
                Düzenle
              </button>
              <button type="button" class="btn-table-action btn-delete" onclick="window.SorBakalimAdmin.deleteQuestion('${q.id}')" title="Soruyu Sil">
                Sil
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // STATS ENGINE
  // ==========================================================================

  function loadStats() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STATS);
      if (stored) {
        stats = JSON.parse(stored);
      } else {
        stats = {
          visitors: 14250,
          gamesPlayed: 1840,
          categoryPlays: {
            "Tarih": 415,
            "Türk Futbolu": 482,
            "Genel Kültür": 378,
            "Yemek": 294,
            "Coğrafya": 235,
            "Dizi ve Film": 196
          }
        };
      }
    } catch (e) {
      stats = { visitors: 14250, gamesPlayed: 1840, categoryPlays: {} };
    }

    // Increment visitors per visit
    stats.visitors = (stats.visitors || 14250) + (Math.floor(Math.random() * 3) + 1);
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {}
  }

  function renderStats() {
    if (el.statVisitors) {
      el.statVisitors.textContent = (stats.visitors || 14250).toLocaleString('tr-TR');
    }

    if (el.statGamesPlayed) {
      el.statGamesPlayed.textContent = (stats.gamesPlayed || 1840).toLocaleString('tr-TR');
    }

    if (el.statTotalCategories) {
      el.statTotalCategories.textContent = categories.length;
    }

    if (el.statTotalQuestions) {
      el.statTotalQuestions.textContent = questions.length;
    }

    // Render category leaderboard
    if (el.categoriesRankingGrid) {
      const playEntries = Object.entries(stats.categoryPlays || {})
        .sort((a, b) => b[1] - a[1]);

      if (playEntries.length === 0) {
        el.categoriesRankingGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 1rem;">
            Henüz kategori oyunu verisi kaydedilmedi.
          </div>
        `;
        return;
      }

      const maxPlays = Math.max(...playEntries.map(e => e[1]), 1);

      el.categoriesRankingGrid.innerHTML = playEntries.slice(0, 6).map(([catName, count], index) => {
        const percentage = Math.round((count / maxPlays) * 100);
        let rankClass = "rank-other";
        if (index === 0) rankClass = "rank-1";
        else if (index === 1) rankClass = "rank-2";
        else if (index === 2) rankClass = "rank-3";

        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        const emoji = cat ? (cat.emoji || "🎯") : "🏷️";

        return `
          <div class="ranking-item">
            <div class="ranking-item-top">
              <div class="ranking-info">
                <span class="ranking-badge ${rankClass}">#${index + 1}</span>
                <span class="ranking-name">${emoji} ${escapeHtml(catName)}</span>
              </div>
              <span class="ranking-count">${count.toLocaleString('tr-TR')} oyun</span>
            </div>
            <div class="ranking-progress-track">
              <div class="ranking-progress-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================================================
  // BACKUP & RESET LOGIC
  // ==========================================================================

  async function resetAllToDefault() {
    if (confirm("Supabase bulut veritabanındaki güncel kategori ve soruları yeniden çekip ekranı yenilemek istiyor musunuz?")) {
      if (window.SorBakalimData && typeof window.SorBakalimData.loadGlobalCategories === 'function') {
        updateSupabaseStatus("Yenileniyor...", "");
        try {
          const res = await window.SorBakalimData.loadGlobalCategories(true);
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          resetQuestionForm();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();
          updateSupabaseStatus(`Aktif (${categories.length} Kategori)`, "online");
          showToast("Kategoriler ve sorular Supabase'den başarıyla yenilendi. 🌐", "success");
        } catch (err) {
          showToast("Yenileme hatası: " + (err.message || err), "error");
          updateSupabaseStatus("Bağlantı Hatası", "error");
        }
      }
    }
  }

  function exportAllDataJson() {
    try {
      const backupData = {
        app: "Sor Bakalım",
        exportDate: new Date().toISOString(),
        categories: categories,
        questions: questions,
        stats: stats
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `sor_bakalim_yedek_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast("Tüm kategori ve sorular JSON dosyası olarak indirildi.", "success");
    } catch (e) {
      showToast("Dışa aktarma başarısız: " + e.message, "error");
    }
  }

  // ==========================================================================
  // HELPERS & MODALS
  // ==========================================================================

  /**
   * Dosyayı FileReader API kullanarak Base64 Data URL'e dönüştürür.
   * Tarayıcı localStorage hafıza limitini aşmamak için yüksek çözünürlüklü
   * fotoğrafları canvas ile makul boyutlara optimize eder.
   */
  function readFileAsBase64(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve('');
        return;
      }
      if (!file.type || !file.type.startsWith('image/')) {
        reject(new Error("Lütfen geçerli bir görsel dosyası (PNG, JPG, WEBP vb.) seçin."));
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = function () {
          // Eğer görsel zaten belirlenen boyutlardan küçükse ve boyutu 250KB'dan azsa doğrudan kabul et
          if (img.width <= maxWidth && img.height <= maxHeight && file.size < 250 * 1024) {
            resolve(dataUrl);
            return;
          }

          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG formatında Base64 üret
          const optimized = canvas.toDataURL('image/jpeg', 0.85);
          resolve(optimized);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = err => reject(err);
      reader.readAsDataURL(file);
    });
  }

  function viewQuestionImage(id) {
    const q = questions.find(item => item.id === id);
    if (!q || !q.imageUrl || !el.imageModal || !el.modalPreviewPic) return;
    el.modalPreviewPic.src = q.imageUrl;
    openModal(el.imageModal);
  }

  function viewImageModal(url) {
    if (!url || !el.imageModal || !el.modalPreviewPic) return;
    el.modalPreviewPic.src = url;
    openModal(el.imageModal);
  }

  function openModal(modal) {
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function showToast(message, type = 'info') {
    if (!el.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugifyTurkish(text) {
    const trMap = {
      'ç': 'c', 'Ç': 'c',
      'ğ': 'g', 'Ğ': 'g',
      'ı': 'i', 'I': 'i', 'İ': 'i',
      'ö': 'o', 'Ö': 'o',
      'ş': 's', 'Ş': 's',
      'ü': 'u', 'Ü': 'u'
    };
    return text
      .split('')
      .map(char => trMap[char] || char)
      .join('')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-');
  }

  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ==========================================================================
  // INCOMING CONTACT MESSAGES (sorBakalimMessages)
  // ==========================================================================

  function getStoredMessages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveStoredMessages(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(list));
    } catch (e) {
      console.warn('Mesajlar kaydedilemedi:', e);
    }
  }

  function updateMessagesBadge() {
    const list = getStoredMessages();
    if (el.messagesCountBadge) {
      el.messagesCountBadge.textContent = list.length;
      el.messagesCountBadge.style.display = list.length > 0 ? 'inline-block' : 'none';
    }
  }

  function renderMessagesList() {
    const list = getStoredMessages();
    if (el.modalMessagesCount) {
      el.modalMessagesCount.textContent = `${list.length} Mesaj`;
    }
    if (el.clearAllMessagesBtn) {
      el.clearAllMessagesBtn.style.display = list.length > 0 ? 'inline-block' : 'none';
    }

    if (!el.messagesListContainer) return;

    if (list.length === 0) {
      el.messagesListContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); background: #FFF9F2; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">📭</div>
          <h4 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">Gelen Mesaj Yok</h4>
          <p style="font-size: 0.9rem; margin: 0;">iletisim.html sayfasından gönderilen form mesajları burada listelenir.</p>
        </div>
      `;
      return;
    }

    el.messagesListContainer.innerHTML = list.map((msg, idx) => {
      const safeName = escapeHtml(msg.name || 'İsimsiz');
      const safeEmail = escapeHtml(msg.email || '');
      const safeSubject = escapeHtml(msg.subject || 'Genel İletişim');
      const safeDate = escapeHtml(msg.dateFormatted || (msg.date ? new Date(msg.date).toLocaleString('tr-TR') : ''));
      const safeMessage = escapeHtml(msg.message || '');
      const msgId = msg.id || 'msg_' + idx;

      return `
        <div class="message-item-card" data-id="${msgId}" style="background: #FFF9F2; border: 2px solid var(--border-color); box-shadow: 0 3px 0 var(--border-color); border-radius: var(--radius-md); padding: 16px; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="display: inline-block; font-size: 0.78rem; font-weight: 800; background: var(--primary-orange-light); color: var(--primary-orange-deep); padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--border-color); margin-bottom: 4px;">
                ${safeSubject}
              </span>
              <h4 style="font-family: var(--font-display); font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">
                ${safeName}
              </h4>
              <a href="mailto:${safeEmail}" style="font-size: 0.88rem; font-weight: 600; color: var(--primary-orange); text-decoration: underline;">
                ${safeEmail}
              </a>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">
                ${safeDate}
              </span>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.SorBakalimAdmin.deleteSingleMessage('${msgId}')" title="Bu mesajı sil" style="padding: 4px 10px; font-size: 0.78rem;">
                Sil
              </button>
            </div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; font-size: 0.92rem; font-weight: 500; color: var(--text-main); white-space: pre-wrap; line-height: 1.45;">
            ${safeMessage}
          </div>
        </div>
      `;
    }).join('');
  }

  function openMessagesModal() {
    renderMessagesList();
    openModal(el.messagesModal);
  }

  function deleteSingleMessage(msgId) {
    let list = getStoredMessages();
    list = list.filter(m => m.id !== msgId);
    saveStoredMessages(list);
    updateMessagesBadge();
    renderMessagesList();
    showToast('Mesaj başarıyla silindi.', 'info');
  }

  function clearAllMessages() {
    if (!confirm('Tüm gelen mesajları kalıcı olarak silmek istediğinize emin misiniz?')) return;
    saveStoredMessages([]);
    updateMessagesBadge();
    renderMessagesList();
    showToast('Tüm mesajlar temizlendi.', 'info');
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  function setupEventListeners() {
    // Category Form Submit
    if (el.categoryForm) {
      el.categoryForm.addEventListener('submit', handleCategorySubmit);
    }

    // Category Delete Confirmation
    if (el.confirmDeleteCategoryBtn) {
      el.confirmDeleteCategoryBtn.addEventListener('click', confirmDeleteCategory);
    }
    if (el.cancelDeleteCategoryBtn) {
      el.cancelDeleteCategoryBtn.addEventListener('click', () => closeModal(el.deleteCategoryModal));
    }

    // Question Form Submit
    if (el.questionForm) {
      el.questionForm.addEventListener('submit', handleQuestionSubmit);
    }
    if (el.cancelEditBtn) {
      el.cancelEditBtn.addEventListener('click', resetQuestionForm);
    }
    if (el.resetFormBtn) {
      el.resetFormBtn.addEventListener('click', resetQuestionForm);
    }

    // Category Image File Select (Supabase Storage 'category-images' -> Public URL, Base64 fallback)
    if (el.categoryImageInput) {
      el.categoryImageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          let imageUrl = '';
          let uploadedToCloud = false;
          if (window.SorBakalimData && typeof window.SorBakalimData.uploadImage === 'function') {
            showToast("Kategori görseli yükleniyor...", "info");
            const res = await window.SorBakalimData.uploadImage(file, 'categories', 400, 400);
            imageUrl = res.url;
            uploadedToCloud = Boolean(res.storage);
          } else {
            imageUrl = await readFileAsBase64(file, 400, 400);
          }
          currentCategoryBase64 = imageUrl;
          if (el.categoryImagePreviewImg) el.categoryImagePreviewImg.src = imageUrl;
          if (el.categoryImagePreviewWrap) el.categoryImagePreviewWrap.style.display = 'flex';
          showToast(
            uploadedToCloud
              ? "Kategori görseli Supabase Storage'a yüklendi! ☁️"
              : "Kategori görseli yüklendi (Storage kovası hazır olduğunda buluta aktarılır).",
            uploadedToCloud ? "success" : "info"
          );
        } catch (err) {
          showToast(err.message || "Görsel yüklenemedi.", "error");
        }
      });
    }

    if (el.removeCategoryImgBtn) {
      el.removeCategoryImgBtn.addEventListener('click', () => {
        currentCategoryBase64 = '';
        if (el.categoryImageInput) el.categoryImageInput.value = '';
        if (el.categoryImagePreviewWrap) el.categoryImagePreviewWrap.style.display = 'none';
        if (el.categoryImagePreviewImg) el.categoryImagePreviewImg.src = '';
      });
    }

    // Question Image File Select (Supabase Storage 'category-images' -> Public URL, Base64 fallback)
    if (el.questionImageInput) {
      el.questionImageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          let imageUrl = '';
          let uploadedToCloud = false;
          if (window.SorBakalimData && typeof window.SorBakalimData.uploadImage === 'function') {
            showToast("Soru görseli yükleniyor...", "info");
            const res = await window.SorBakalimData.uploadImage(file, 'questions', 800, 800);
            imageUrl = res.url;
            uploadedToCloud = Boolean(res.storage);
          } else {
            imageUrl = await readFileAsBase64(file, 800, 800);
          }
          currentQuestionBase64 = imageUrl;
          if (el.imagePreviewImg) el.imagePreviewImg.src = imageUrl;
          if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'flex';
          showToast(
            uploadedToCloud
              ? "Soru görseli Supabase Storage'a yüklendi! ☁️"
              : "Soru görseli yüklendi (Storage kovası hazır olduğunda buluta aktarılır).",
            uploadedToCloud ? "success" : "info"
          );
        } catch (err) {
          showToast(err.message || "Görsel yüklenemedi.", "error");
        }
      });
    }

    if (el.removeQuestionImgBtn) {
      el.removeQuestionImgBtn.addEventListener('click', () => {
        currentQuestionBase64 = '';
        if (el.questionImageInput) el.questionImageInput.value = '';
        if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'none';
        if (el.imagePreviewImg) el.imagePreviewImg.src = '';
      });
    }

    // Question Filters & Search
    if (el.searchInput) {
      el.searchInput.addEventListener('input', debounce(renderQuestionsTable, 250));
    }
    if (el.filterCategory) {
      el.filterCategory.addEventListener('change', renderQuestionsTable);
    }
    if (el.filterPoints) {
      el.filterPoints.addEventListener('change', renderQuestionsTable);
    }

    // Question Delete Confirmation
    if (el.confirmDeleteBtn) {
      el.confirmDeleteBtn.addEventListener('click', confirmDeleteQuestion);
    }
    if (el.cancelDeleteBtn) {
      el.cancelDeleteBtn.addEventListener('click', () => closeModal(el.deleteModal));
    }

    // Image Preview Modal Close
    if (el.closeImageModalBtn) {
      el.closeImageModalBtn.addEventListener('click', () => closeModal(el.imageModal));
    }

    function showAdminCreditResult(message, isSuccess) {
      if (!el.adminCreditsResult) return;
      el.adminCreditsResult.textContent = isSuccess ? `✅ ${message}` : `⚠️ ${message}`;
      el.adminCreditsResult.style.background = isSuccess ? '#D1FAE5' : '#FFEAE8';
      el.adminCreditsResult.style.color = isSuccess ? '#065F46' : '#DC2626';
      el.adminCreditsResult.style.border = isSuccess ? '1.5px solid #10B981' : '1.5px solid #DC2626';
      el.adminCreditsResult.style.display = 'block';
    }

    // Admin Credits Top-Up Form
    if (el.adminAddCreditsForm) {
      el.adminAddCreditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailValue = (el.adminCreditEmailInput ? el.adminCreditEmailInput.value.trim().toLowerCase() : '');
        const amountValue = (el.adminCreditAmountInput ? el.adminCreditAmountInput.value : '');
        const parsedAmount = parseInt(amountValue, 10);

        if (!emailValue || !emailValue.includes('@')) {
          showToast("Lütfen geçerli bir e-posta adresi girin.", "error");
          if (el.adminCreditEmailInput) el.adminCreditEmailInput.focus();
          return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          showToast("Lütfen 1 veya daha büyük bir oyun adedi girin.", "error");
          if (el.adminCreditAmountInput) el.adminCreditAmountInput.focus();
          return;
        }

        const supabase = getAdminSupabaseClient();
        if (!supabase) {
          showToast("Supabase bağlantısı hazır değil.", "error");
          return;
        }

        const btn = el.adminAddCreditsBtn;
        const originalBtnText = btn ? btn.textContent : '➕ Oyun Hakkı Ekle';
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Ekleniyor...";
        }
        if (el.adminCreditsResult) {
          el.adminCreditsResult.style.display = 'none';
        }

        try {
          const { data: { user: adminUser } } = await supabase.auth.getUser();
          const isSelfAdmin = Boolean(adminUser && adminUser.email && emailValue === adminUser.email.toLowerCase());

          // 1. Öncelikli olarak güvenli RPC çağrısını dene
          const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_credits', {
            target_email: emailValue,
            amount: parsedAmount
          });

          if (!rpcError && rpcData !== null && rpcData !== undefined) {
            const successMsg = `${emailValue} hesabına +${parsedAmount} oyun hakkı eklendi. Yeni bakiye: ${rpcData}`;
            showAdminCreditResult(successMsg, true);
            showToast(`Oyun hakkı eklendi! Yeni bakiye: ${rpcData}`, "success");
            await refreshAdminOwnCredits();
            return;
          }

          // 2. Kendi admin hesabı için satır yoksa veya RPC 0 satır döndürdüyse doğrudan upsert dene
          if (isSelfAdmin && adminUser) {
            const { data: existingRow } = await supabase
              .from('user_game_credits')
              .select('games_remaining, total_purchased')
              .eq('user_id', adminUser.id)
              .maybeSingle();

            const curRemaining = (existingRow && typeof existingRow.games_remaining === 'number') ? existingRow.games_remaining : 0;
            const curPurchased = (existingRow && typeof existingRow.total_purchased === 'number') ? existingRow.total_purchased : 0;
            const nextRemaining = curRemaining + parsedAmount;
            const nextPurchased = curPurchased + parsedAmount;

            const { data: upserted, error: upsertErr } = await supabase
              .from('user_game_credits')
              .upsert({
                user_id: adminUser.id,
                email: adminUser.email,
                games_remaining: nextRemaining,
                total_purchased: nextPurchased
              }, { onConflict: 'user_id' })
              .select('games_remaining')
              .single();

            if (!upsertErr && upserted) {
              const finalBal = upserted.games_remaining;
              const successMsg = `${emailValue} hesabına +${parsedAmount} oyun hakkı eklendi. Yeni bakiye: ${finalBal}`;
              showAdminCreditResult(successMsg, true);
              showToast(`Oyun hakkı eklendi! Yeni bakiye: ${finalBal}`, "success");
              await refreshAdminOwnCredits();
              return;
            }

            // Eğer ilk RPC başarısız olduysa ve yukarıda satır oluşturulamadıysa net Türkçe hata göster
            const detailErr = (rpcError && rpcError.message) || (upsertErr && upsertErr.message) || "Yönetici hesabı için kredi satırı bulunamadı veya güncellenemedi.";
            showAdminCreditResult(`Hata: ${detailErr}`, false);
            showToast(`Hata: ${detailErr}`, "error");
            return;
          }

          // 3. Başka bir kullanıcı için RPC hata verdiyse veya 0 satır güncellediyse net Türkçe hata göster
          const errMsg = rpcError
            ? `Hata: ${rpcError.message || 'Oyun hakkı eklenemedi.'}`
            : `Hata: '${emailValue}' e-posta adresine ait kayıt bulunamadı. Kullanıcının önce kayıt olup giriş yapması gerekir.`;
          showAdminCreditResult(errMsg, false);
          showToast(errMsg, "error");
        } catch (err) {
          const errMsg = `İşlem hatası: ${err.message || err}`;
          showAdminCreditResult(errMsg, false);
          showToast(errMsg, "error");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = originalBtnText;
          }
        }
      });
    }

    // Reset Data & Export Buttons
    if (el.resetDataBtn) {
      el.resetDataBtn.addEventListener('click', resetAllToDefault);
    }
    if (el.exportJsonBtn) {
      el.exportJsonBtn.addEventListener('click', exportAllDataJson);
    }

    // Messages Modal Listeners
    if (el.viewMessagesBtn) {
      el.viewMessagesBtn.addEventListener('click', openMessagesModal);
    }
    if (el.closeMessagesModalBtn) {
      el.closeMessagesModalBtn.addEventListener('click', () => closeModal(el.messagesModal));
    }
    if (el.clearAllMessagesBtn) {
      el.clearAllMessagesBtn.addEventListener('click', clearAllMessages);
    }

    // Supabase Cloud Sync Buttons
    if (el.syncSupabaseBtn) {
      el.syncSupabaseBtn.addEventListener('click', async () => {
        if (!window.SorBakalimData || typeof window.SorBakalimData.loadGlobalCategories !== 'function') {
          showToast("Supabase senkronizasyon motoru henüz hazır değil.", "warning");
          return;
        }
        updateSupabaseStatus("Eşitleniyor...", "");
        showToast("Supabase bulut veritabanıyla eşitleniyor...", "info");
        try {
          const res = await window.SorBakalimData.loadGlobalCategories(true);
          categories = window.SorBakalimData.getCategories();
          questions = window.SorBakalimData.getQuestions();
          renderCategoriesGrid();
          populateCategoryDropdowns();
          renderStats();
          renderQuestionsTable();

          if (res.success) {
            updateSupabaseStatus(`Aktif (${res.count} Kategori)`, "online");
            showToast(`Bulut senkronizasyonu tamamlandı! (${res.count} kategori güncellendi) 🌐`, "success");
          } else {
            updateSupabaseStatus("Bağlantı Uyarısı", "error");
            showToast(`Supabase bulut uyarısı: ${res.error || 'Tablo kontrol ediniz'}`, "warning");
          }
        } catch (err) {
          updateSupabaseStatus("Hata", "error");
          showToast(`Senkronizasyon hatası: ${err.message || err}`, "error");
        }
      });
    }

    // Live Supabase Sync Event Listener (Triggers when data arrives from cloud)
    window.addEventListener('sorBakalimDataSynced', (e) => {
      if (window.SorBakalimData) {
        categories = window.SorBakalimData.getCategories();
        questions = window.SorBakalimData.getQuestions();
      } else {
        categories = (e.detail && e.detail.categories) || [];
        questions = (e.detail && e.detail.questions) || [];
      }
      renderCategoriesGrid();
      populateCategoryDropdowns();
      renderStats();
      renderQuestionsTable();
      const count = (e.detail && e.detail.count) || categories.length;
      updateSupabaseStatus(`Aktif (${count} Kategori)`, "online");
    });

    // Quick Add button
    if (el.quickAddBtn) {
      el.quickAddBtn.addEventListener('click', () => {
        resetQuestionForm();
        if (el.questionTextInput) el.questionTextInput.focus();
      });
    }

    // Modals backdrop and escape key
    window.addEventListener('click', (e) => {
      if (e.target === el.deleteModal) closeModal(el.deleteModal);
      if (e.target === el.deleteCategoryModal) closeModal(el.deleteCategoryModal);
      if (e.target === el.imageModal) closeModal(el.imageModal);
      if (e.target === el.messagesModal) closeModal(el.messagesModal);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(el.deleteModal);
        closeModal(el.deleteCategoryModal);
        closeModal(el.imageModal);
        closeModal(el.messagesModal);
      }
    });
  }

  // --- GLOBAL EXPORTS (For inline button clicks) ---
  window.SorBakalimAdmin = {
    setCategoryEmoji: function (emoji) {
      if (el.categoryEmojiInput) {
        el.categoryEmojiInput.value = emoji;
      }
    },
    deleteCategory: promptDeleteCategory,
    editQuestion: startEditQuestion,
    deleteQuestion: promptDeleteQuestion,
    viewImage: viewImageModal,
    viewQuestionImage: viewQuestionImage,
    deleteSingleMessage: deleteSingleMessage
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
