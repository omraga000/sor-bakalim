/**
 * Sor Bakalım - Soru & Kategori Veri Tabanı ve Senkronizasyon Motoru
 * localStorage anahtarları: 'sorBakalimCategories' ve 'sorBakalimQuestions'
 */

// Varsayılan Başlangıç Kategorileri (12 Orijinal Kategori)
const DEFAULT_CATEGORIES = [
  { id: "tarih",     name: "Tarih",             emoji: "🏛️", img: "", info: "Osmanlı’dan Cumhuriyet’e tarih soruları" },
  { id: "cografya",  name: "Coğrafya",          emoji: "🗺️", img: "", info: "Şehirler, dağlar, nehirler" },
  { id: "yemek",     name: "Yemek",             emoji: "🍢", img: "", info: "Türk mutfağı ve lezzetler" },
  { id: "spor",      name: "Spor",              emoji: "⚽", img: "", info: "Futbol, basketbol ve daha fazlası" },
  { id: "kultur",    name: "Kültür ve Sanat",   emoji: "🎭", img: "", info: "Edebiyat, müzik, sinema" },
  { id: "genel",     name: "Genel Kültür",      emoji: "💡", img: "", info: "Her konudan karışık sorular" },
  { id: "hayvan",    name: "Hayvanlar Alemi",   emoji: "🦁", img: "", info: "Hayvanlar hakkında ilginç sorular" },
  { id: "teknoloji", name: "Teknoloji",         emoji: "💻", img: "", info: "Bilgisayar, telefon, internet" },
  { id: "muzik",     name: "Müzik",             emoji: "🎵", img: "", info: "Sanatçılar ve şarkılar" },
  { id: "dizi",      name: "Dizi ve Film",      emoji: "🎬", img: "", info: "Türk dizileri ve filmleri" },
  { id: "sehir",     name: "Şehirler",          emoji: "🌆", img: "", info: "81 ilimiz hakkında sorular" },
  { id: "atasozu",   name: "Atasözleri",        emoji: "📜", img: "", info: "Atasözleri ve deyimler" }
];

// Varsayılan Başlangıç Soruları (Her kategori için 200, 400 ve 600 puanlık sorular)
const DEFAULT_QUESTIONS = [
  // Tarih
  { id: "q_tar_1", categoryId: "tarih", category: "Tarih", points: 200, question: "İstanbul hangi yıl fethedildi?", answer: "1453", imageUrl: "" },
  { id: "q_tar_2", categoryId: "tarih", category: "Tarih", points: 200, question: "Türkiye Cumhuriyeti’nin kurucusu kimdir?", answer: "Mustafa Kemal Atatürk", imageUrl: "" },
  { id: "q_tar_3", categoryId: "tarih", category: "Tarih", points: 400, question: "Türkiye Cumhuriyeti hangi tarihte ilan edildi?", answer: "29 Ekim 1923", imageUrl: "" },
  { id: "q_tar_4", categoryId: "tarih", category: "Tarih", points: 400, question: "Çanakkale Deniz Savaşı hangi yıl yapıldı?", answer: "1915", imageUrl: "" },
  { id: "q_tar_5", categoryId: "tarih", category: "Tarih", points: 600, question: "Malazgirt Savaşı hangi yıl yapıldı?", answer: "1071", imageUrl: "" },
  { id: "q_tar_6", categoryId: "tarih", category: "Tarih", points: 600, question: "Kanuni Sultan Süleyman hangi yıl tahta çıktı?", answer: "1520", imageUrl: "" },

  // Coğrafya
  { id: "q_cog_1", categoryId: "cografya", category: "Coğrafya", points: 200, question: "Türkiye’nin başkenti neresidir?", answer: "Ankara", imageUrl: "" },
  { id: "q_cog_2", categoryId: "cografya", category: "Coğrafya", points: 200, question: "Türkiye’nin en kalabalık şehri neresidir?", answer: "İstanbul", imageUrl: "" },
  { id: "q_cog_3", categoryId: "cografya", category: "Coğrafya", points: 400, question: "Türkiye’nin en yüksek dağı hangisidir?", answer: "Ağrı Dağı", imageUrl: "" },
  { id: "q_cog_4", categoryId: "cografya", category: "Coğrafya", points: 400, question: "Türkiye’nin en büyük gölü hangisidir?", answer: "Van Gölü", imageUrl: "" },
  { id: "q_cog_5", categoryId: "cografya", category: "Coğrafya", points: 600, question: "Karadeniz’e dökülen ve Türkiye’nin en uzun nehri olarak bilinen nehir hangisidir?", answer: "Kızılırmak", imageUrl: "" },
  { id: "q_cog_6", categoryId: "cografya", category: "Coğrafya", points: 600, question: "Türkiye kaç coğrafi bölgeye ayrılır?", answer: "7", imageUrl: "" },

  // Yemek
  { id: "q_yem_1", categoryId: "yemek", category: "Yemek", points: 200, question: "İskender kebap hangi şehirle anılır?", answer: "Bursa", imageUrl: "" },
  { id: "q_yem_2", categoryId: "yemek", category: "Yemek", points: 200, question: "Baklava hangi hamurdan yapılır?", answer: "Yufka", imageUrl: "" },
  { id: "q_yem_3", categoryId: "yemek", category: "Yemek", points: 400, question: "Menemenin ana malzemeleri nelerdir?", answer: "Yumurta, domates, biber", imageUrl: "" },
  { id: "q_yem_4", categoryId: "yemek", category: "Yemek", points: 400, question: "Gaziantep’in en ünlü tatlısı hangisidir?", answer: "Baklava", imageUrl: "" },
  { id: "q_yem_5", categoryId: "yemek", category: "Yemek", points: 600, question: "Türk kahvesi hangi yıl UNESCO listesine girdi?", answer: "2013", imageUrl: "" },
  { id: "q_yem_6", categoryId: "yemek", category: "Yemek", points: 600, question: "Hamsi hangi bölgemizin simgesel balığıdır?", answer: "Karadeniz", imageUrl: "" },

  // Spor
  { id: "q_spo_1", categoryId: "spor", category: "Spor", points: 200, question: "Galatasaray’ın renkleri nelerdir?", answer: "Sarı ve kırmızı", imageUrl: "" },
  { id: "q_spo_2", categoryId: "spor", category: "Spor", points: 200, question: "Futbolda bir takım sahaya kaç oyuncuyla çıkar?", answer: "11", imageUrl: "" },
  { id: "q_spo_3", categoryId: "spor", category: "Spor", points: 400, question: "Türkiye 2002 Dünya Kupası’nda kaçıncı oldu?", answer: "Üçüncü", imageUrl: "" },
  { id: "q_spo_4", categoryId: "spor", category: "Spor", points: 400, question: "Fenerbahçe’nin renkleri nelerdir?", answer: "Sarı ve lacivert", imageUrl: "" },
  { id: "q_spo_5", categoryId: "spor", category: "Spor", points: 600, question: "“Cep Herkülü” lakaplı halterci kimdir?", answer: "Naim Süleymanoğlu", imageUrl: "" },
  { id: "q_spo_6", categoryId: "spor", category: "Spor", points: 600, question: "Türkiye Milli Takımı hangi yıl Avrupa Şampiyonası’nda yarı finale çıktı?", answer: "2008", imageUrl: "" },

  // Kültür ve Sanat
  { id: "q_kul_1", categoryId: "kultur", category: "Kültür ve Sanat", points: 200, question: "Mevlana’nın türbesi hangi şehirdedir?", answer: "Konya", imageUrl: "" },
  { id: "q_kul_2", categoryId: "kultur", category: "Kültür ve Sanat", points: 200, question: "İstiklal Marşı’nın yazarı kimdir?", answer: "Mehmet Akif Ersoy", imageUrl: "" },
  { id: "q_kul_3", categoryId: "kultur", category: "Kültür ve Sanat", points: 400, question: "“İnce Memed” romanının yazarı kimdir?", answer: "Yaşar Kemal", imageUrl: "" },
  { id: "q_kul_4", categoryId: "kultur", category: "Kültür ve Sanat", points: 400, question: "Orhan Pamuk hangi yıl Nobel Edebiyat Ödülü’nü aldı?", answer: "2006", imageUrl: "" },
  { id: "q_kul_5", categoryId: "kultur", category: "Kültür ve Sanat", points: 600, question: "“Kürk Mantolu Madonna” romanının yazarı kimdir?", answer: "Sabahattin Ali", imageUrl: "" },
  { id: "q_kul_6", categoryId: "kultur", category: "Kültür ve Sanat", points: 600, question: "Mimar Sinan’ın “ustalık eserim” dediği cami hangisidir?", answer: "Selimiye Camii", imageUrl: "" },

  // Genel Kültür
  { id: "q_gen_1", categoryId: "genel", category: "Genel Kültür", points: 200, question: "Türk bayrağında hangi semboller vardır?", answer: "Ay ve yıldız", imageUrl: "" },
  { id: "q_gen_2", categoryId: "genel", category: "Genel Kültür", points: 200, question: "Türkiye hangi iki kıtada yer alır?", answer: "Asya ve Avrupa", imageUrl: "" },
  { id: "q_gen_3", categoryId: "genel", category: "Genel Kültür", points: 400, question: "Kapadokya’daki peri bacaları hangi ilde yoğundur?", answer: "Nevşehir", imageUrl: "" },
  { id: "q_gen_4", categoryId: "genel", category: "Genel Kültür", points: 400, question: "Türkiye’nin para birimi nedir?", answer: "Türk lirası", imageUrl: "" },
  { id: "q_gen_5", categoryId: "genel", category: "Genel Kültür", points: 600, question: "Pamukkale travertenleri hangi mineralden oluşur?", answer: "Kalsiyum karbonat", imageUrl: "" },
  { id: "q_gen_6", categoryId: "genel", category: "Genel Kültür", points: 600, question: "İstanbul’un plaka kodu kaçtır?", answer: "34", imageUrl: "" },

  // Hayvanlar Alemi
  { id: "q_hay_1", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 200, question: "“Hayvanların kralı” olarak bilinen hayvan hangisidir?", answer: "Aslan", imageUrl: "" },
  { id: "q_hay_2", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 200, question: "Yunuslar balık mıdır, memeli midir?", answer: "Memeli", imageUrl: "" },
  { id: "q_hay_3", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 400, question: "Dünyanın en hızlı kara hayvanı hangisidir?", answer: "Çita", imageUrl: "" },
  { id: "q_hay_4", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 400, question: "Dünyanın en büyük kara hayvanı hangisidir?", answer: "Afrika fili", imageUrl: "" },
  { id: "q_hay_5", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 600, question: "Dünyanın en uzun boylu hayvanı hangisidir?", answer: "Zürafa", imageUrl: "" },
  { id: "q_hay_6", categoryId: "hayvan", category: "Hayvanlar Alemi", points: 600, question: "Uçamayan kuşların en büyüğü hangisidir?", answer: "Deve kuşu", imageUrl: "" },

  // Teknoloji
  { id: "q_tek_1", categoryId: "teknoloji", category: "Teknoloji", points: 200, question: "Bilgisayarın “beyni” olarak adlandırılan parçası hangisidir?", answer: "İşlemci (CPU)", imageUrl: "" },
  { id: "q_tek_2", categoryId: "teknoloji", category: "Teknoloji", points: 200, question: "Wi-Fi ne işe yarar?", answer: "Kablosuz internet bağlantısı sağlar", imageUrl: "" },
  { id: "q_tek_3", categoryId: "teknoloji", category: "Teknoloji", points: 400, question: "“WWW” kısaltması neyin açılımıdır?", answer: "World Wide Web", imageUrl: "" },
  { id: "q_tek_4", categoryId: "teknoloji", category: "Teknoloji", points: 400, question: "Google’ın geliştirdiği mobil işletim sistemi hangisidir?", answer: "Android", imageUrl: "" },
  { id: "q_tek_5", categoryId: "teknoloji", category: "Teknoloji", points: 600, question: "“HTML” neyin kısaltmasıdır?", answer: "HyperText Markup Language", imageUrl: "" },
  { id: "q_tek_6", categoryId: "teknoloji", category: "Teknoloji", points: 600, question: "İlk iPhone hangi yıl tanıtıldı?", answer: "2007", imageUrl: "" },

  // Müzik
  { id: "q_muz_1", categoryId: "muzik", category: "Müzik", points: 200, question: "Bağlama hangi tür müzik aletidir?", answer: "Telli çalgı", imageUrl: "" },
  { id: "q_muz_2", categoryId: "muzik", category: "Müzik", points: 200, question: "Bir piyanoda kaç tuş vardır?", answer: "88", imageUrl: "" },
  { id: "q_muz_3", categoryId: "muzik", category: "Müzik", points: 400, question: "Sezen Aksu hangi lakapla anılır?", answer: "Minik Serçe", imageUrl: "" },
  { id: "q_muz_4", categoryId: "muzik", category: "Müzik", points: 400, question: "Ney hangi tür çalgıdır?", answer: "Üflemeli çalgı", imageUrl: "" },
  { id: "q_muz_5", categoryId: "muzik", category: "Müzik", points: 600, question: "Zeki Müren hangi unvanla anılır?", answer: "Sanat Güneşi", imageUrl: "" },
  { id: "q_muz_6", categoryId: "muzik", category: "Müzik", points: 600, question: "Neşet Ertaş hangi çalgının ustası olarak bilinir?", answer: "Bağlama", imageUrl: "" },

  // Dizi ve Film
  { id: "q_diz_1", categoryId: "dizi", category: "Dizi ve Film", points: 200, question: "“Kurtlar Vadisi” dizisinin baş karakteri kimdir?", answer: "Polat Alemdar", imageUrl: "" },
  { id: "q_diz_2", categoryId: "dizi", category: "Dizi ve Film", points: 200, question: "“Yeşilçam” neyin adıdır?", answer: "Türk sinemasının", imageUrl: "" },
  { id: "q_diz_3", categoryId: "dizi", category: "Dizi ve Film", points: 400, question: "“Muhteşem Yüzyıl” dizisi hangi padişahın dönemini anlatır?", answer: "Kanuni Sultan Süleyman", imageUrl: "" },
  { id: "q_diz_4", categoryId: "dizi", category: "Dizi ve Film", points: 400, question: "“Ezel” dizisinin başrol oyuncusu kimdir?", answer: "Kenan İmirzalıoğlu", imageUrl: "" },
  { id: "q_diz_5", categoryId: "dizi", category: "Dizi ve Film", points: 600, question: "“Kuruluş: Osman” dizisinde Osman Bey rolünü kim oynar?", answer: "Burak Özçivit", imageUrl: "" },
  { id: "q_diz_6", categoryId: "dizi", category: "Dizi ve Film", points: 600, question: "“Hababam Sınıfı” filmlerinde Mahmut Hoca’yı kim canlandırmıştır?", answer: "Münir Özkul", imageUrl: "" },

  // Şehirler
  { id: "q_seh_1", categoryId: "sehir", category: "Şehirler", points: 200, question: "Anıtkabir hangi şehirdedir?", answer: "Ankara", imageUrl: "" },
  { id: "q_seh_2", categoryId: "sehir", category: "Şehirler", points: 200, question: "Galata Kulesi hangi şehirdedir?", answer: "İstanbul", imageUrl: "" },
  { id: "q_seh_3", categoryId: "sehir", category: "Şehirler", points: 400, question: "Efes Antik Kenti hangi ildedir?", answer: "İzmir", imageUrl: "" },
  { id: "q_seh_4", categoryId: "sehir", category: "Şehirler", points: 400, question: "Nemrut Dağı’ndaki dev heykeller hangi ildedir?", answer: "Adıyaman", imageUrl: "" },
  { id: "q_seh_5", categoryId: "sehir", category: "Şehirler", points: 600, question: "Sümela Manastırı hangi ildedir?", answer: "Trabzon", imageUrl: "" },
  { id: "q_seh_6", categoryId: "sehir", category: "Şehirler", points: 600, question: "Ani Harabeleri hangi ildedir?", answer: "Kars", imageUrl: "" },

  // Atasözleri
  { id: "q_ata_1", categoryId: "atasozu", category: "Atasözleri", points: 200, question: "Atasözünü tamamla: Damlaya damlaya …", answer: "göl olur", imageUrl: "" },
  { id: "q_ata_2", categoryId: "atasozu", category: "Atasözleri", points: 200, question: "Atasözünü tamamla: Sabreden derviş …", answer: "muradına ermiş", imageUrl: "" },
  { id: "q_ata_3", categoryId: "atasozu", category: "Atasözleri", points: 400, question: "Atasözünü tamamla: Ateş düştüğü yeri …", answer: "yakar", imageUrl: "" },
  { id: "q_ata_4", categoryId: "atasozu", category: "Atasözleri", points: 400, question: "Atasözünü tamamla: Üzüm üzüme baka baka …", answer: "kararır", imageUrl: "" },
  { id: "q_ata_5", categoryId: "atasozu", category: "Atasözleri", points: 600, question: "Atasözünü tamamla: Bir elin nesi var, …", answer: "iki elin sesi var", imageUrl: "" },
  { id: "q_ata_6", categoryId: "atasozu", category: "Atasözleri", points: 600, question: "Atasözünü tamamla: Komşu komşunun …", answer: "külüne muhtaçtır", imageUrl: "" }
];

/**
 * localStorage'dan kategorileri kesin ve katı (strict) olarak oku.
 * SADECE anahtar ilk kez açıldığında (raw === null) varsayılanları başlatır.
 * Kullanıcı kategorileri sildiyse ve dizi boşsa ([]), kesinlikle [] döner ve varsayılanları asla geri getirmez!
 */
function getStoredCategories() {
  try {
    const raw = localStorage.getItem("sorBakalimCategories");
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed; // Boş dizi [] dahil doğrudan localStorage'dan döner!
      }
    }
  } catch (e) {
    console.warn("Kategoriler okunamadı:", e);
  }
  // Yalnızca localStorage'da anahtar hiç oluşturulmamışsa (null) varsayılanları kaydet
  try {
    localStorage.setItem("sorBakalimCategories", JSON.stringify(DEFAULT_CATEGORIES));
  } catch (e) {}
  return DEFAULT_CATEGORIES.slice();
}

/**
 * localStorage'dan soruları kesin ve katı (strict) olarak oku.
 * SADECE anahtar ilk kez açıldığında (raw === null) varsayılanları başlatır.
 * Kullanıcı soruları sildiyse ve dizi boşsa ([]), kesinlikle [] döner ve varsayılanları asla geri getirmez!
 */
function getStoredQuestions() {
  try {
    const raw = localStorage.getItem("sorBakalimQuestions");
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed; // Boş dizi [] dahil doğrudan localStorage'dan döner!
      }
    }
  } catch (e) {
    console.warn("Sorular okunamadı:", e);
  }
  // Yalnızca localStorage'da anahtar hiç oluşturulmamışsa (null) varsayılanları kaydet
  try {
    localStorage.setItem("sorBakalimQuestions", JSON.stringify(DEFAULT_QUESTIONS));
  } catch (e) {}
  return DEFAULT_QUESTIONS.slice();
}

/**
 * Kategoriler ve sorular listesinden game.js ve soru.js'in kullandığı
 * 'QUESTIONS' sözlük yapısını dinamik olarak inşa eder.
 */
function buildQuestionsMap(categories, questions) {
  const map = {};

  categories.forEach(cat => {
    // Kategoriye ait soruları bul (categoryId veya category adına göre)
    const catQuestions = questions.filter(q => 
      q.categoryId === cat.id || 
      (q.category && q.category.toLowerCase() === cat.name.toLowerCase())
    );

    // Puan sırasına göre diz (200, 400, 600)
    catQuestions.sort((a, b) => a.points - b.points);

    map[cat.id] = {
      name: cat.name,
      emoji: cat.emoji || "🎯",
      img: cat.img || "",
      info: cat.info || "",
      items: catQuestions.map(q => ({
        id: q.id,
        p: q.points,
        q: q.question,
        a: q.answer,
        img: q.imageUrl || ""
      }))
    };
  });

  return map;
}

// Global QUESTIONS nesnesi (Oyun motorunun kullandığı ana kaynak)
const QUESTIONS = buildQuestionsMap(getStoredCategories(), getStoredQuestions());

// Global erişim için window üzerine bağlama
if (typeof window !== "undefined") {
  window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
  window.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
  window.getStoredCategories = getStoredCategories;
  window.getStoredQuestions = getStoredQuestions;
  window.buildQuestionsMap = buildQuestionsMap;
  window.QUESTIONS = QUESTIONS;
}
