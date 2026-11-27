/**
 * Sor Bakalım - Soru & Kategori Veri Tabanı ve Supabase Küresel Senkronizasyon Motoru
 * Supabase Tablosu: public.game_categories (100% Çevrim İçi Canlı Veri Tabanı)
 * SIFIR yerel kategori/soru depolaması - Tüm veriler doğrudan Supabase'den canlı çekilir.
 */

// Supabase Yapılandırması
const SUPABASE_CONFIG = {
  url: "https://fzxrqvobatablbtssggo.supabase.co",
  anonKey: "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM",
  table: "game_categories",
  storageBucket: "category-images"
};

// Eski yerel kategori ve soru artıklarını temizle (Stale Data Cleanup)
(function cleanupOldLocalStorage() {
  try {
    localStorage.removeItem("sorBakalimCategories");
    localStorage.removeItem("sorBakalimQuestions");
    localStorage.removeItem("sorBakalimDeletedCategories");
    localStorage.removeItem("sorBakalimDeletedQuestions");
    localStorage.removeItem("cats_backup");
  } catch (_) {}
})();

// Bellek içi canlı önbellek (Sadece oturum süresince hafızada tutulur, localStorage'a yazılmaz)
let _cachedCategories = [];
let _cachedQuestions = [];
let _supabaseClient = null;
let _inFlightLoadPromise = null;

/**
 * Supabase istemcisini başlatır ve döndürür.
 */
function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof window !== "undefined") {
    if (window.supabaseClient) {
      _supabaseClient = window.supabaseClient;
      return _supabaseClient;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        _supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        window.supabaseClient = _supabaseClient;
        return _supabaseClient;
      } catch (e) {
        console.warn("Supabase başlatma hatası:", e);
      }
    }
  }
  return null;
}

/**
 * Bellek içi canlı kategorileri döndürür.
 */
function getCategories() {
  return _cachedCategories.slice();
}

/**
 * Bellek içi canlı soruları döndürür.
 */
function getQuestions() {
  return _cachedQuestions.slice();
}

/**
 * Soru ve kategori haritasını inşa eder (QUESTIONS)
 */
function buildQuestionsMap(categories, questions) {
  const map = {};
  (categories || []).forEach(cat => {
    if (!cat || !cat.id) return;
    const catQuestions = (questions || []).filter(q => 
      q.categoryId === cat.id || 
      (q.category && q.category.toLowerCase() === cat.name.toLowerCase())
    );
    catQuestions.sort((a, b) => (a.points || 0) - (b.points || 0));

    map[cat.id] = {
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji || cat.icon || "🎯",
      icon: cat.icon || cat.emoji || "🎯",
      img: cat.img || "",
      info: cat.info || cat.description || "",
      description: cat.description || cat.info || "",
      items: catQuestions.map(q => ({
        id: q.id,
        p: q.points || 200,
        q: q.question || "",
        a: q.answer || "",
        img: q.imageUrl || ""
      }))
    };
  });
  return map;
}

/**
 * Supabase satırından kategori ve soru nesnelerini ayrıştırır.
 */
function parseSupabaseRow(row) {
  if (!row || typeof row !== "object") return null;
  const catId = String(row.id || "").trim();
  if (!catId || catId === "_deleted_meta" || catId === "_metadata" || row.is_deleted === true) return null;

  const category = {
    id: catId,
    name: row.name || catId,
    emoji: row.emoji || row.icon || "🎯",
    icon: row.icon || row.emoji || "🎯",
    img: row.img || "",
    info: row.info || row.description || "",
    description: row.description || row.info || "",
    created_at: row.created_at || new Date().toISOString()
  };

  let questionsRaw = row.questions || row.items || [];
  if (typeof questionsRaw === "string") {
    try { questionsRaw = JSON.parse(questionsRaw); } catch (_) { questionsRaw = []; }
  }
  if (!Array.isArray(questionsRaw)) questionsRaw = [];

  const questions = questionsRaw.map((q, idx) => ({
    id: q.id || `q_${catId}_${idx + 1}`,
    categoryId: catId,
    category: category.name,
    categoryEmoji: category.emoji,
    points: parseInt(q.points || q.p, 10) || 200,
    question: String(q.question || q.q || ""),
    answer: String(q.answer || q.a || ""),
    imageUrl: String(q.imageUrl || q.img || "")
  })).filter(q => q.question && q.question.trim().length > 0);

  return { category, questions };
}

/**
 * ============================================================================
 * ORTAK TEK OKUMA FONKSİYONU: loadGlobalCategories
 * ============================================================================
 * public.game_categories tablosundan satırları 'created_at' sıralı olarak çeker.
 * 0 satır gelirse 0 satır döndürür - Kesinlikle sahte/yerel kategori eklemez.
 */
async function loadGlobalCategories(forceFetch = false) {
  if (!forceFetch && _inFlightLoadPromise) {
    return _inFlightLoadPromise;
  }

  const client = getSupabase();
  if (!client) {
    console.warn("Supabase istemcisi hazır değil.");
    return {
      success: false,
      error: "Supabase istemcisi yüklenemedi.",
      categories: _cachedCategories,
      questions: _cachedQuestions,
      count: _cachedCategories.length
    };
  }

  const runFetch = (async () => {
    try {
      const { data, error } = await client
        .from(SUPABASE_CONFIG.table)
        .select("id, name, emoji, icon, img, info, description, questions, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Supabase game_categories okuma hatası:", error.message, error.code);
        return {
          success: false,
          error: error.message,
          code: error.code,
          categories: _cachedCategories,
          questions: _cachedQuestions,
          count: _cachedCategories.length
        };
      }

      const rows = (data || []).filter(r => 
        r && r.id && r.id !== "_deleted_meta" && r.id !== "_metadata" && !r.is_deleted
      );

      let newCategories = [];
      let newQuestions = [];

      if (rows.length > 0) {
        rows.forEach(r => {
          const parsed = parseSupabaseRow(r);
          if (parsed) {
            newCategories.push(parsed.category);
            if (parsed.questions && parsed.questions.length > 0) {
              newQuestions.push(...parsed.questions);
            }
          }
        });
      }

      // Canlı hafıza değişkenlerini güncelle
      _cachedCategories = newCategories;
      _cachedQuestions = newQuestions;

      // window.QUESTIONS haritasını inşa et
      window.QUESTIONS = buildQuestionsMap(_cachedCategories, _cachedQuestions);

      // Canlı senkronizasyon olayını yayınla
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sorBakalimDataSynced", {
          detail: {
            categories: _cachedCategories,
            questions: _cachedQuestions,
            count: _cachedCategories.length,
            source: "supabase"
          }
        }));
      }

      return {
        success: true,
        categories: _cachedCategories,
        questions: _cachedQuestions,
        count: _cachedCategories.length,
        from: "supabase"
      };

    } catch (err) {
      console.warn("loadGlobalCategories istisnası:", err);
      return {
        success: false,
        error: err.message || err,
        categories: _cachedCategories,
        questions: _cachedQuestions,
        count: _cachedCategories.length
      };
    } finally {
      _inFlightLoadPromise = null;
    }
  })();

  _inFlightLoadPromise = runFetch;
  return runFetch;
}

/**
 * ============================================================================
 * ORTAK YAZMA FONKSİYONLARI (Doğrudan Supabase'e Yazar ve Listeyi Yeniler)
 * ============================================================================
 */

/**
 * Kategoriyi doğrudan Supabase public.game_categories tablosuna ekler/günceller (Upsert).
 */
async function saveCategoryDirect(category, questionsForCat = []) {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: "Supabase bağlantısı kurulamadı." };
  }

  const catObj = {
    id: category.id,
    name: category.name,
    emoji: category.emoji || category.icon || "🎯",
    icon: category.icon || category.emoji || "🎯",
    img: category.img || "",
    info: category.info || category.description || "",
    description: category.description || category.info || "",
    created_at: category.created_at || new Date().toISOString()
  };

  const formattedQuestions = (questionsForCat || []).map((q, idx) => ({
    id: q.id || `q_${category.id}_${idx + 1}`,
    points: parseInt(q.points || q.p, 10) || 200,
    question: q.question || q.q || "",
    answer: q.answer || q.a || "",
    imageUrl: q.imageUrl || q.img || ""
  }));

  const payload = {
    id: catObj.id,
    name: catObj.name,
    emoji: catObj.emoji,
    icon: catObj.icon,
    img: catObj.img,
    info: catObj.info,
    description: catObj.description,
    questions: formattedQuestions,
    created_at: catObj.created_at,
    updated_at: new Date().toISOString()
  };

  try {
    // 1. Doğrudan Supabase'e yaz
    const { data, error } = await client
      .from(SUPABASE_CONFIG.table)
      .upsert(payload, { onConflict: "id" });

    if (error) {
      return { success: false, error: error.message, code: error.code };
    }

    // 2. Güncel listeyi Supabase'den çekerek ekranları senkronize et
    await loadGlobalCategories(true);

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || err };
  }
}

/**
 * Kategoriyi doğrudan Supabase public.game_categories tablosundan siler.
 */
async function deleteCategoryDirect(categoryId) {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: "Supabase bağlantısı kurulamadı." };
  }

  try {
    // 1. Doğrudan Supabase'den sil
    const { error } = await client
      .from(SUPABASE_CONFIG.table)
      .delete()
      .eq("id", categoryId);

    if (error) {
      return { success: false, error: error.message, code: error.code };
    }

    // 2. Güncel listeyi Supabase'den çekerek ekranları senkronize et
    await loadGlobalCategories(true);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || err };
  }
}

/**
 * Soruyu doğrudan Supabase'e kaydeder / günceller.
 */
async function saveQuestionDirect(question, categoryId) {
  const cat = _cachedCategories.find(c => c.id === categoryId);
  if (!cat) return { success: false, error: "İlgili kategori bulunamadı." };

  let currentQuestions = _cachedQuestions.filter(q => q.categoryId === categoryId);
  const existingIdx = currentQuestions.findIndex(q => q.id === question.id);
  if (existingIdx >= 0) {
    currentQuestions[existingIdx] = { ...question, categoryId };
  } else {
    currentQuestions.unshift({ ...question, categoryId });
  }

  return await saveCategoryDirect(cat, currentQuestions);
}

/**
 * Soruyu doğrudan Supabase'den siler.
 */
async function deleteQuestionDirect(questionId, categoryId) {
  const cat = _cachedCategories.find(c => c.id === categoryId);
  if (!cat) return { success: false, error: "İlgili kategori bulunamadı." };

  const remainingQuestions = _cachedQuestions.filter(q => 
    q.categoryId === categoryId && q.id !== questionId
  );

  return await saveCategoryDirect(cat, remainingQuestions);
}

/**
 * Görseli optimize edip Supabase Storage 'category-images' public kovasına yükler
 * ve hafif herkese açık CDN URL'sini döndürür. Kova henüz oluşturulmamışsa geriye dönük
 * uyumluluk için optimize edilmiş Base64 Data URL'ye zarifçe düşer.
 */
async function uploadImageToStorage(file, folder = "categories", maxWidth = 800, maxHeight = 800) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Lütfen geçerli bir görsel dosyası (PNG, JPG, WEBP vb.) seçin.");
  }

  // 1. Canvas ile görseli makul boyut ve kaliteye optimize et (Blob + fallback Data URL)
  const optimized = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = function () {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        if (canvas.toBlob) {
          canvas.toBlob(
            (blob) => resolve({ blob, dataUrl: jpegDataUrl }),
            "image/jpeg",
            0.82
          );
        } else {
          resolve({ blob: null, dataUrl: jpegDataUrl });
        }
      };
      img.onerror = () => resolve({ blob: file, dataUrl });
      img.src = dataUrl;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  // 2. Supabase Storage 'category-images' kovasına yüklemeyi dene
  const client = getSupabase();
  if (client && client.storage && optimized.blob) {
    try {
      const safeFolder = String(folder || "categories").replace(/[^a-z0-9_-]/gi, "");
      const fileName = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadError } = await client.storage
        .from(SUPABASE_CONFIG.storageBucket)
        .upload(fileName, optimized.blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false
        });

      if (!uploadError) {
        const { data: pubData } = client.storage
          .from(SUPABASE_CONFIG.storageBucket)
          .getPublicUrl(fileName);

        if (pubData && pubData.publicUrl) {
          return { success: true, url: pubData.publicUrl, storage: true };
        }
      } else {
        console.warn("Supabase Storage yükleme uyarısı (fallback devrede):", uploadError.message);
        return { success: true, url: optimized.dataUrl, storage: false, warning: uploadError.message };
      }
    } catch (storageErr) {
      console.warn("Supabase Storage istisnası (fallback devrede):", storageErr);
    }
  }

  return { success: true, url: optimized.dataUrl, storage: false };
}

// Global QUESTIONS nesnesi (başlangıçta boş, Supabase'den dolacak)
window.QUESTIONS = {};

// Global API
if (typeof window !== "undefined") {
  window.SorBakalimData = {
    loadGlobalCategories: loadGlobalCategories,
    getCategories: getCategories,
    getQuestions: getQuestions,
    saveCategory: saveCategoryDirect,
    deleteCategory: deleteCategoryDirect,
    saveQuestion: saveQuestionDirect,
    deleteQuestion: deleteQuestionDirect,
    uploadImage: uploadImageToStorage,
    getSupabase: getSupabase
  };

  // Geriye dönük uyumluluk takma adları
  window.SorBakalimSync = {
    fetchAndSync: loadGlobalCategories,
    upsertCategory: saveCategoryDirect,
    deleteCategory: deleteCategoryDirect,
    getSupabase: getSupabase
  };

  window.getStoredCategories = getCategories;
  window.getStoredQuestions = getQuestions;
  window.buildQuestionsMap = buildQuestionsMap;

  // Sayfa açıldığında doğrudan Supabase'den yükle (admin.html kendi yetki doğrulaması sonrası yükler)
  const isAdminPage = typeof window !== "undefined" &&
    window.location &&
    String(window.location.pathname || "").toLowerCase().includes("admin.html");

  if (!isAdminPage) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => loadGlobalCategories(), 50);
      });
    } else {
      setTimeout(() => loadGlobalCategories(), 50);
    }
  }
}
