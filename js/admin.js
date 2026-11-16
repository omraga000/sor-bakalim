/**
 * Sor Bakalım - Admin Dashboard & Kategori / Soru Yönetim Sistemi
 * Vanilla JavaScript CRUD Engine & Tam Senkronizasyon (localStorage)
 */

(function () {
  'use strict';

  // --- LOCAL STORAGE KEYS (Ana Oyun ile 100% Senkronize) ---
  const STORAGE_KEYS = {
    CATEGORIES: 'sorBakalimCategories',
    QUESTIONS: 'sorBakalimQuestions',
    STATS: 'sorBakalimStats'
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

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- INITIALIZATION ---
  function init() {
    loadCategories();
    loadQuestions();
    loadStats();

    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderStats();
    renderQuestionsTable();
    setupEventListeners();
  }

  // ==========================================================================
  // CATEGORIES LOGIC (CRUD)
  // ==========================================================================

  function loadCategories() {
    if (typeof window.getStoredCategories === 'function') {
      categories = window.getStoredCategories();
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
        if (stored) {
          categories = JSON.parse(stored);
        } else {
          categories = (window.DEFAULT_CATEGORIES || []).slice();
          saveCategories();
        }
      } catch (e) {
        console.warn("Categories parse error:", e);
        categories = (window.DEFAULT_CATEGORIES || []).slice();
      }
    }
  }

  function saveCategories() {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      showToast("Kategoriler kaydedilirken hata oluştu: " + e.message, "error");
    }
  }

  function handleCategorySubmit(e) {
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
      info: info
    };

    categories.push(newCategory);
    saveCategories();

    // Reset Form & Base64
    el.categoryForm.reset();
    el.categoryEmojiInput.value = "🎯";
    currentCategoryBase64 = '';
    if (el.categoryImageInput) el.categoryImageInput.value = '';
    if (el.categoryImagePreviewWrap) el.categoryImagePreviewWrap.style.display = 'none';
    if (el.categoryImagePreviewImg) el.categoryImagePreviewImg.src = '';

    showToast(`'${name}' kategorisi başarıyla eklendi! 🎉`, "success");

    // Refresh UI
    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderStats();
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

  function confirmDeleteCategory() {
    if (!categoryPendingDeleteId) return;

    const cat = categories.find(c => c.id === categoryPendingDeleteId);
    if (!cat) {
      closeModal(el.deleteCategoryModal);
      return;
    }

    const catNameLower = cat.name.toLowerCase();

    // 1. Remove category from categories array
    categories = categories.filter(c => c.id !== categoryPendingDeleteId);
    saveCategories();

    // 2. Cascade delete all questions belonging to this category
    const initialQuestionCount = questions.length;
    questions = questions.filter(q => 
      q.categoryId !== categoryPendingDeleteId && 
      (!q.category || q.category.toLowerCase() !== catNameLower)
    );
    const deletedQuestionsCount = initialQuestionCount - questions.length;
    saveQuestions();

    // 3. Clean up user's active picked categories in localStorage if it contained this category
    try {
      const storedPicked = JSON.parse(localStorage.getItem("cats"));
      if (Array.isArray(storedPicked)) {
        const updatedPicked = storedPicked.filter(id => id !== categoryPendingDeleteId);
        localStorage.setItem("cats", JSON.stringify(updatedPicked));
      }
    } catch (e) {}

    showToast(`'${cat.name}' kategorisi ve ${deletedQuestionsCount} adet soru silindi.`, "info");

    closeModal(el.deleteCategoryModal);
    categoryPendingDeleteId = null;

    // Refresh all views
    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderStats();
    renderQuestionsTable();
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
          <p style="font-weight: 600; color: #FFFFFF;">Henüz kayıtlı kategori bulunmuyor.</p>
          <p style="font-size: 0.85rem;">Soldaki formu kullanarak yeni bir kategori ekleyin.</p>
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
              🗑️ Sil
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // QUESTIONS LOGIC (CRUD)
  // ==========================================================================

  function loadQuestions() {
    if (typeof window.getStoredQuestions === 'function') {
      questions = window.getStoredQuestions();
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
        if (stored) {
          questions = JSON.parse(stored);
        } else {
          questions = (window.DEFAULT_QUESTIONS || []).slice();
          saveQuestions();
        }
      } catch (e) {
        console.warn("Questions parse error:", e);
        questions = (window.DEFAULT_QUESTIONS || []).slice();
      }
    }
  }

  function saveQuestions() {
    try {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    } catch (e) {
      showToast("Sorular kaydedilirken hata oluştu: " + e.message, "error");
    }
  }

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

  function handleQuestionSubmit(e) {
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

    if (editingQuestionId) {
      // UPDATE EXISTING
      const index = questions.findIndex(q => q.id === editingQuestionId);
      if (index !== -1) {
        questions[index] = {
          ...questions[index],
          categoryId: categoryId,
          category: categoryName,
          categoryEmoji: categoryEmoji,
          points: points,
          question: questionText,
          answer: answer,
          imageUrl: imageUrl,
          updatedAt: Date.now()
        };
        saveQuestions();
        showToast("Soru başarıyla güncellendi! ✓", "success");
      } else {
        showToast("Düzenlenen soru bulunamadı.", "error");
      }
      resetQuestionForm();
    } else {
      // CREATE NEW QUESTION
      const newQuestion = {
        id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        categoryId: categoryId,
        category: categoryName,
        categoryEmoji: categoryEmoji,
        points: points,
        question: questionText,
        answer: answer,
        imageUrl: imageUrl,
        createdAt: Date.now()
      };

      questions.unshift(newQuestion);
      saveQuestions();
      showToast("Yeni soru başarıyla eklendi! 🎉", "success");
      resetQuestionForm();
    }

    // Refresh views
    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderStats();
    renderQuestionsTable();
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

  function confirmDeleteQuestion() {
    if (!questionPendingDeleteId) return;

    const index = questions.findIndex(q => q.id === questionPendingDeleteId);
    if (index !== -1) {
      questions.splice(index, 1);
      saveQuestions();
      showToast("Soru sistemden ve oyundan silindi.", "info");

      if (editingQuestionId === questionPendingDeleteId) {
        resetQuestionForm();
      }

      renderCategoriesGrid();
      populateCategoryDropdowns();
      renderStats();
      renderQuestionsTable();
    }

    closeModal(el.deleteModal);
    questionPendingDeleteId = null;
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
                🖼️ Görseli Görüntüle
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
                ✏️ Düzenle
              </button>
              <button type="button" class="btn-table-action btn-delete" onclick="window.SorBakalimAdmin.deleteQuestion('${q.id}')" title="Soruyu Sil">
                🗑️ Sil
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

  function resetAllToDefault() {
    if (confirm("DİKKAT: Tüm soru ve kategorileri orijinal başlangıç ayarlarına sıfırlamak istediğinize emin misiniz? Eklediğiniz veya düzenlediğiniz tüm özel veriler silinecektir.")) {
      categories = (window.DEFAULT_CATEGORIES || []).slice();
      questions = (window.DEFAULT_QUESTIONS || []).slice();

      saveCategories();
      saveQuestions();

      // Clean setup in localStorage
      try {
        localStorage.removeItem("cats");
        localStorage.removeItem("game");
      } catch (e) {}

      resetQuestionForm();
      renderCategoriesGrid();
      populateCategoryDropdowns();
      renderStats();
      renderQuestionsTable();

      showToast("Tüm kategoriler ve sorular varsayılan ayarlara sıfırlandı.", "success");
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

    // Category Image File Select (Local Computer Upload -> Base64)
    if (el.categoryImageInput) {
      el.categoryImageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const base64 = await readFileAsBase64(file, 400, 400);
          currentCategoryBase64 = base64;
          if (el.categoryImagePreviewImg) el.categoryImagePreviewImg.src = base64;
          if (el.categoryImagePreviewWrap) el.categoryImagePreviewWrap.style.display = 'flex';
          showToast("Kategori görseli yüklendi.", "info");
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

    // Question Image File Select (Local Computer Upload -> Base64)
    if (el.questionImageInput) {
      el.questionImageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const base64 = await readFileAsBase64(file, 800, 800);
          currentQuestionBase64 = base64;
          if (el.imagePreviewImg) el.imagePreviewImg.src = base64;
          if (el.imagePreviewWrap) el.imagePreviewWrap.style.display = 'flex';
          showToast("Soru görseli yüklendi.", "info");
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

    // Reset Data & Export Buttons
    if (el.resetDataBtn) {
      el.resetDataBtn.addEventListener('click', resetAllToDefault);
    }
    if (el.exportJsonBtn) {
      el.exportJsonBtn.addEventListener('click', exportAllDataJson);
    }

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
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(el.deleteModal);
        closeModal(el.deleteCategoryModal);
        closeModal(el.imageModal);
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
    viewQuestionImage: viewQuestionImage
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
