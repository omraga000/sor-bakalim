// كل الأسئلة هنا. لإضافة فئة: أضف كتلة جديدة بنفس الشكل، واستعمل نفس id الموجود في index.html.
// كل فئة فيها 6 أسئلة بالترتيب: 200 و200 و400 و400 و600 و600.
const QUESTIONS = {
  tarih: { name: "Tarih", emoji: "🏛️", items: [
    { p: 200, q: "İstanbul hangi yıl fethedildi?", a: "1453" },
    { p: 200, q: "Türkiye Cumhuriyeti’nin kurucusu kimdir?", a: "Mustafa Kemal Atatürk" },
    { p: 400, q: "Türkiye Cumhuriyeti hangi tarihte ilan edildi?", a: "29 Ekim 1923" },
    { p: 400, q: "Çanakkale Deniz Savaşı hangi yıl yapıldı?", a: "1915" },
    { p: 600, q: "Malazgirt Savaşı hangi yıl yapıldı?", a: "1071" },
    { p: 600, q: "Kanuni Sultan Süleyman hangi yıl tahta çıktı?", a: "1520" } ] },

  cografya: { name: "Coğrafya", emoji: "🗺️", items: [
    { p: 200, q: "Türkiye’nin başkenti neresidir?", a: "Ankara" },
    { p: 200, q: "Türkiye’nin en kalabalık şehri neresidir?", a: "İstanbul" },
    { p: 400, q: "Türkiye’nin en yüksek dağı hangisidir?", a: "Ağrı Dağı" },
    { p: 400, q: "Türkiye’nin en büyük gölü hangisidir?", a: "Van Gölü" },
    { p: 600, q: "Karadeniz’e dökülen ve Türkiye’nin en uzun nehri olarak bilinen nehir hangisidir?", a: "Kızılırmak" },
    { p: 600, q: "Türkiye kaç coğrafi bölgeye ayrılır?", a: "7" } ] },

  yemek: { name: "Yemek", emoji: "🍢", items: [
    { p: 200, q: "İskender kebap hangi şehirle anılır?", a: "Bursa" },
    { p: 200, q: "Baklava hangi hamurdan yapılır?", a: "Yufka" },
    { p: 400, q: "Menemenin ana malzemeleri nelerdir?", a: "Yumurta, domates, biber" },
    { p: 400, q: "Gaziantep’in en ünlü tatlısı hangisidir?", a: "Baklava" },
    { p: 600, q: "Türk kahvesi hangi yıl UNESCO listesine girdi?", a: "2013" },
    { p: 600, q: "Hamsi hangi bölgemizin simgesel balığıdır?", a: "Karadeniz" } ] },

  spor: { name: "Spor", emoji: "⚽", items: [
    { p: 200, q: "Galatasaray’ın renkleri nelerdir?", a: "Sarı ve kırmızı" },
    { p: 200, q: "Futbolda bir takım sahaya kaç oyuncuyla çıkar?", a: "11" },
    { p: 400, q: "Türkiye 2002 Dünya Kupası’nda kaçıncı oldu?", a: "Üçüncü" },
    { p: 400, q: "Fenerbahçe’nin renkleri nelerdir?", a: "Sarı ve lacivert" },
    { p: 600, q: "“Cep Herkülü” lakaplı halterci kimdir?", a: "Naim Süleymanoğlu" },
    { p: 600, q: "Türkiye Milli Takımı hangi yıl Avrupa Şampiyonası’nda yarı finale çıktı?", a: "2008" } ] },

  kultur: { name: "Kültür ve Sanat", emoji: "🎭", items: [
    { p: 200, q: "Mevlana’nın türbesi hangi şehirdedir?", a: "Konya" },
    { p: 200, q: "İstiklal Marşı’nın yazarı kimdir?", a: "Mehmet Akif Ersoy" },
    { p: 400, q: "“İnce Memed” romanının yazarı kimdir?", a: "Yaşar Kemal" },
    { p: 400, q: "Orhan Pamuk hangi yıl Nobel Edebiyat Ödülü’nü aldı?", a: "2006" },
    { p: 600, q: "“Kürk Mantolu Madonna” romanının yazarı kimdir?", a: "Sabahattin Ali" },
    { p: 600, q: "Mimar Sinan’ın “ustalık eserim” dediği cami hangisidir?", a: "Selimiye Camii" } ] },

  genel: { name: "Genel Kültür", emoji: "💡", items: [
    { p: 200, q: "Türk bayrağında hangi semboller vardır?", a: "Ay ve yıldız" },
    { p: 200, q: "Türkiye hangi iki kıtada yer alır?", a: "Asya ve Avrupa" },
    { p: 400, q: "Kapadokya’daki peri bacaları hangi ilde yoğundur?", a: "Nevşehir" },
    { p: 400, q: "Türkiye’nin para birimi nedir?", a: "Türk lirası" },
    { p: 600, q: "Pamukkale travertenleri hangi mineralden oluşur?", a: "Kalsiyum karbonat" },
    { p: 600, q: "İstanbul’un plaka kodu kaçtır?", a: "34" } ] },

  hayvan: { name: "Hayvanlar Alemi", emoji: "🦁", items: [
    { p: 200, q: "“Hayvanların kralı” olarak bilinen hayvan hangisidir?", a: "Aslan" },
    { p: 200, q: "Yunuslar balık mıdır, memeli midir?", a: "Memeli" },
    { p: 400, q: "Dünyanın en hızlı kara hayvanı hangisidir?", a: "Çita" },
    { p: 400, q: "Dünyanın en büyük kara hayvanı hangisidir?", a: "Afrika fili" },
    { p: 600, q: "Dünyanın en uzun boylu hayvanı hangisidir?", a: "Zürafa" },
    { p: 600, q: "Uçamayan kuşların en büyüğü hangisidir?", a: "Deve kuşu" } ] },

  teknoloji: { name: "Teknoloji", emoji: "💻", items: [
    { p: 200, q: "Bilgisayarın “beyni” olarak adlandırılan parçası hangisidir?", a: "İşlemci (CPU)" },
    { p: 200, q: "Wi-Fi ne işe yarar?", a: "Kablosuz internet bağlantısı sağlar" },
    { p: 400, q: "“WWW” kısaltması neyin açılımıdır?", a: "World Wide Web" },
    { p: 400, q: "Google’ın geliştirdiği mobil işletim sistemi hangisidir?", a: "Android" },
    { p: 600, q: "“HTML” neyin kısaltmasıdır?", a: "HyperText Markup Language" },
    { p: 600, q: "İlk iPhone hangi yıl tanıtıldı?", a: "2007" } ] },

  muzik: { name: "Müzik", emoji: "🎵", items: [
    { p: 200, q: "Bağlama hangi tür müzik aletidir?", a: "Telli çalgı" },
    { p: 200, q: "Bir piyanoda kaç tuş vardır?", a: "88" },
    { p: 400, q: "Sezen Aksu hangi lakapla anılır?", a: "Minik Serçe" },
    { p: 400, q: "Ney hangi tür çalgıdır?", a: "Üflemeli çalgı" },
    { p: 600, q: "Zeki Müren hangi unvanla anılır?", a: "Sanat Güneşi" },
    { p: 600, q: "Neşet Ertaş hangi çalgının ustası olarak bilinir?", a: "Bağlama" } ] },

  dizi: { name: "Dizi ve Film", emoji: "🎬", items: [
    { p: 200, q: "“Kurtlar Vadisi” dizisinin baş karakteri kimdir?", a: "Polat Alemdar" },
    { p: 200, q: "“Yeşilçam” neyin adıdır?", a: "Türk sinemasının" },
    { p: 400, q: "“Muhteşem Yüzyıl” dizisi hangi padişahın dönemini anlatır?", a: "Kanuni Sultan Süleyman" },
    { p: 400, q: "“Ezel” dizisinin başrol oyuncusu kimdir?", a: "Kenan İmirzalıoğlu" },
    { p: 600, q: "“Kuruluş: Osman” dizisinde Osman Bey rolünü kim oynar?", a: "Burak Özçivit" },
    { p: 600, q: "“Hababam Sınıfı” filmlerinde Mahmut Hoca’yı kim canlandırmıştır?", a: "Münir Özkul" } ] },

  sehir: { name: "Şehirler", emoji: "🌆", items: [
    { p: 200, q: "Anıtkabir hangi şehirdedir?", a: "Ankara" },
    { p: 200, q: "Galata Kulesi hangi şehirdedir?", a: "İstanbul" },
    { p: 400, q: "Efes Antik Kenti hangi ildedir?", a: "İzmir" },
    { p: 400, q: "Nemrut Dağı’ndaki dev heykeller hangi ildedir?", a: "Adıyaman" },
    { p: 600, q: "Sümela Manastırı hangi ildedir?", a: "Trabzon" },
    { p: 600, q: "Ani Harabeleri hangi ildedir?", a: "Kars" } ] },

  atasozu: { name: "Atasözleri", emoji: "📜", items: [
    { p: 200, q: "Atasözünü tamamla: Damlaya damlaya …", a: "göl olur" },
    { p: 200, q: "Atasözünü tamamla: Sabreden derviş …", a: "muradına ermiş" },
    { p: 400, q: "Atasözünü tamamla: Ateş düştüğü yeri …", a: "yakar" },
    { p: 400, q: "Atasözünü tamamla: Üzüm üzüme baka baka …", a: "kararır" },
    { p: 600, q: "Atasözünü tamamla: Bir elin nesi var, …", a: "iki elin sesi var" },
    { p: 600, q: "Atasözünü tamamla: Komşu komşunun …", a: "külüne muhtaçtır" } ] }
};