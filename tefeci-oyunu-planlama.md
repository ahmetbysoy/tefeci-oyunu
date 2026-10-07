# Tefeci Oyunu - Planlama Notları

Amaç: Soru-cevap ile oyunu şekillendirmek, sonunda todo promptunu çıkarmak.
Her cevap alındıkça bu dosya güncellenir.

## 1. Ana Fikir (kullanıcı anlatımı)

- Platform: mobil tarayıcı oyunu
- Ton: İstanbul arka sokak jargonu, eğlenceli
- Oyuncu: Tefeci (ana karakter). İstediği kişiye istediği kadar borç verebilir.
- Mıntıkada trader karakterler var. Her birinin kendi karakteri, tekniği, düşünce ve stratejisi var.
- Traderlar futures coinleri seçip kendi stratejilerine göre scalping yapar.
- Parası biten trader tefeciden faizli borç alır.
- Veri: HİÇBİR şey mock değil. Gerçek zamanlı, gerçek piyasa fiyatları. Binance Futures public WSS + diğer ücretsiz veri kaynakları.
- İstenen ekranlar/özellikler: leaderboard, açık pozisyonlar, canlı PnL, canlı kasa kâr/zarar.
- Genel beklenti: canlı, interaktif, eğlenceli; her detay düşünülerek yapılacak.

## Cevaplar (sırayla eklenecek)

### Cevap 1 - Para ve hesap modeli
- Tamamen oyun. Gerçek para yok, hiçbir gerçek hesaba bağlı değil.
- Fiyatlar gerçek, kasa ve işlemler sanal (paper trading).

### Cevap 2 - Başlangıç akışı ve etkileşim
- Başlangıçta traderlar sırayla gelip tefeciden ilk borç parasını ister.
- Tefeci, trader'ın istatistiklerine ve karakterine bakarak istediği faizi teklif eder.
- Traderlar tefeciyle TTS metinlerle konuşur (eğlenceli diyaloglar).
- Her trader'ın bir lakabı var.

### Cevap 3 - Ses
- TTS sesli olacak. Karakterler hoparlörden konuşacak.
- Hoparlör üzerinden oyuncuyla etkileşim olabilir.
- Eğlenceli, esprili şeyler istiyor.

### Cevap 4 - Oyuncu kontrolü
- Butonlarla kontrol. Mikrofon/ses tanıma yok.

### Cevap 5 - Trader sayısı
- 5 trader karakter.

### Cevap 6 - Karakter tonu
- Karakterleri Claude tasarlıyor.
- Amatör trader yok. Hepsi kurnaz, piyasanın tüm kahpeliğini bilen, akıllı, şerefsiz tipler.

#### Karakter taslağı (onay bekliyor)
1. **Fitilci Mehmet** - Stop avcısı / likidasyon fitili avcısı. Fitil atılınca ters yönde girer. Sinsi, sabırlı.
2. **Tahta Kemal** - Emir defteri (order book) okuyucu. Duvar ve spoof kokusunu alır. Az konuşur, tehditkâr.
3. **Fonlama Nuri** - Funding rate ve açık pozisyon (OI) kalabalığına ters oynar. Tefeciyi bile oyuna getirmeye çalışır.
4. **Selo Roket** - Hacim patlamasına biner, momentum scalper. Yüksek kaldıraç, hızlı, gözü kara.
5. **Madam Sevil** - Range / ortalamaya dönüş. Tatlı dilli, flörtle faiz indirtmeye çalışır.

### Cevap 7 - Kadro onayı ve mimari tercihi
- 5 karakter kadrosu onaylandı (Fitilci Mehmet, Tahta Kemal, Fonlama Nuri, Selo Roket, Madam Sevil).
- Mimari: Vite / React / Python / HTML / JavaScript arasından Claude seçecek.
- İstek: mimari mikro modüler olsun.

#### Mimari taslağı (onay bekliyor)
- Vite + React (UI) + düz TypeScript/JS modülleri (oyun motoru). v1'de Python yok.
- Mikro modüller: `feed` (Binance WSS), `market` (fiyat/emir defteri durumu), `traders/*` (her karakter ayrı strateji eklentisi), `ledger` (kasa, borç, faiz), `dialogue` (konuşma + TTS), `ui/*` (ekranlar).
- Motor Web Worker içinde çalışır, UI sadece gösterir.
- Kayıt: IndexedDB / localStorage.

### Cevap 8 - Oyun kapalıyken devam
- Oyun kapalıyken de trader'lar işlem yapmaya devam etsin (şimdilik).
- Firebase düşünülüyor. Realtime Database: https://liqidasyon-default-rtdb.europe-west1.firebasedatabase.app/

#### Teknik not (Claude)
- Firebase RTDB sadece veri saklar, kod çalıştırmaz. Trader'ları çalıştıracak bir şey lazım.
- Seçenek A: Oyun açılınca "kaçırılan süreyi" Binance'in gerçek geçmiş mum verisiyle (klines) hızlı oynatma (catch-up replay). Sunucu yok, gerçek veri.
- Seçenek B: 7/24 çalışan worker (ör. Python) trader'ları yürütür, sonuçları Firebase'e yazar.
- Güvenlik: RTDB kuralları (rules) ayarlanmazsa herkes okuyup yazabilir.

### Cevap 9 - 7/24 çalışma yöntemi
- Render + UptimeRobot ile 7/24 worker (seçenek B). Veri deposu Firebase RTDB.

#### Mimari güncellemesi (Claude)
- Trader motoru artık sunucuda: Python worker (asyncio + websockets) Binance Futures WSS'i dinler, trader'ları yürütür, sonucu Firebase'e yazar.
- Worker'a küçük bir `/health` endpoint'i eklenir; UptimeRobot buraya ping atar.
- Frontend (Vite + React) Firebase'i canlı dinler. Önceki "motor Web Worker'da" kararı OBSOLETE.
- Render durumu kaybedebilir (restart): tüm durum Firebase'de tutulur, worker açılışta oradan devam eder.
- Binance bölge engeli: sunucu bölgesi Frankfurt veya Singapore seçilmeli, ABD bölgeleri risklidir.
- Kontrol edilecek (todo): Render ücretsiz plan limitleri ve uyku davranışı güncel mi?

### Cevap 10 - Log indirme (borç ödeyemezse sorusuna gelen cevap)
- "Logları indir" butonu olacak.
- İçerik: tüm zarar eden pozisyonlar, neden açıldı, neden zarar etti.
- Amaç: yapay zekaya verip geçmiş hataları düzeltmek, kodlamayı/trader mantığını geliştirmek için fikir almak.

#### Teknik not (Claude)
- Her işlem için "karar kaydı" tutulur: giriş anındaki sinyal özeti (fiyat, emir defteri durumu, funding/OI), stop/hedef, çıkış nedeni, PnL, kaldıraç, trader'ın o anki ruh hali.
- Export formatı: JSON (AI'ya vermek için) + okunabilir özet (Markdown).
- "Borç ödeyemezse oyun içi sonuç ne olur?" sorusu hâlâ açık.

### Cevap 11 - Borç ödenmezse
- Tehdit/haciz mekaniği. Oyuncu (tefeci) hangi aksiyonu alacağını kendisi seçer.

### Cevap 12 - Aksiyonlar
- Seçilenler: "Çırağı gönder, korkut" (trader riski/davranışı değişir) ve "Faizi katla / vadeyi uzat".
- Seçilmeyenler: teminata el koy, bilgi karşılığı borç sil.

#### Teknik not (Claude)
- Her aksiyonun trader üzerinde ölçülebilir etkisi olmalı (örn. korku: risk azalır ya da çaresizlikten artar, karaktere göre değişir; faiz katlama: borç büyür, batma riski artar).

### Cevap 13 - Coin seçimi
- Coinleri kullanıcı kendisi seçecek ("ben seçerim").

### Cevap 14 - Coin seçimi arayüzü
- Oyun içinde bir input alanı olacak. Kullanıcı futures coinleri kendisi seçebilmeli.

#### Teknik not (Claude)
- Input, Binance Futures'taki USDT perpetual sembol listesinden otomatik tamamlama yapar (listeyi Binance exchangeInfo verir, hardcode edilmez).
- Seçilen liste Firebase'e yazılır; sunucudaki worker o coinlere dinamik abone olur.
- Varsayım: seçilen coinler ortak havuz; her trader bu havuzdan kendi stratejisine göre coin seçer. (Onay bekliyor.)

### Cevap 15 - Başlangıç kasası
- Tefecinin başlangıç kasası ayarlardan kullanıcı tarafından belirlenir (sabit değer yok).

### Cevap 16 - Faiz ve vade
- Oyuncu her borca ayrı vade ve ayrı faiz yazar. Sabit faiz modeli yok.

#### Teknik not (Claude)
- Borç kaydı: trader, anapara, faiz oranı, faiz periyodu, vade, durum (aktif / gecikti / ödendi / kaçtı), uygulanan aksiyonlar.
- Teklif ekranı: miktar + faiz + vade girişi, trader'ın istatistiği yanında gösterilir; trader kabul/red/pazarlık eder.

### Cevap 17 - Pazarlık
- Trader teklife pazarlık yapabilir. Karakterine göre karşı teklif verir.

#### Teknik not (Claude)
- Karşı teklif kuralları karaktere bağlı (örn. Madam Sevil faizi tatlı dille indirtmeye çalışır, Selo Roket acelesi yüzünden hemen kabul eder). Kurallar trader modülünde parametre olarak tutulur.
- Pazarlık turu sınırlı olmalı (örn. en fazla 2-3 tur), yoksa akış uzar.

### Cevap 18 - Borcun akıbeti
- Verilen borcun tamamı trader'ın işlem kasasına girer. Kendi cebine ayırma mekaniği yok.

#### Teknik not (Claude)
- Böylece kasa hesabı temiz kalır: trader bakiyesi = kendi bakiyesi + borç. Borç ödemesi trader bakiyesinden düşer.

### Cevap 19 - Kaldıraç
- Kaldıraç serbest. Patlarlarsa (likidasyon) patlasınlar.

#### Teknik not (Claude)
- "Serbest" = oyun tarafında yapay sınır yok. Üst sınır olarak Binance'in her sembol için gerçek max kaldıraç değeri kullanılır (gerçekçilik için).
- Likidasyon fiyatı gerçek mark price üzerinden hesaplanır (izole marjin mantığı). Kasa sıfırlanınca trader batar, borcu varsa borç aksiyonları devreye girer.

### Cevap 20 - Ana ekran
- Hep görünecekler: leaderboard, açık pozisyonlar + canlı PnL, kasanın canlı durumu (kâr/zarar, dağıtılan borç), mahalle haber akışı (patlayanlar, kavgalar, tehditler).

#### Teknik not (Claude)
- Mobilde dört bölüm aynı anda sığmaz. Öneri: üstte sabit kasa şeridi, altında kaydırılabilir sekmeler/kartlar (Leaderboard, Pozisyonlar, Haber akışı). "Hep görünür" = kasa şeridi sabit, diğerleri tek dokunuşla.
- Haber akışı olayları worker'dan gelir (likidasyon, borç gecikmesi, pazarlık, tehdit) ve her olay TTS ile okunabilir.

### Cevap 21 - Görsel stil
- Açık renkler, pembe ve mor pastel tonlar.

#### Teknik not (Claude)
- Sert arka sokak jargonu ile yumuşak pastel görsel bilinçli bir tezat; oyuna kendine has bir mizah katar.
- Kâr/zarar renkleri (yeşil/kırmızı) pastel zeminde okunur kalmalı: yeterli kontrast, gerekirse koyu metin + renkli rozet.

### Cevap 22 - Ses kaynağı
- Tarayıcının kendi Türkçe TTS sesi (ücretsiz).

#### Teknik not (Claude)
- Web Speech API (speechSynthesis) kullanılır. Ses telefona göre değişir, o yüzden her karakter için perde (pitch) ve hız (rate) farklı ayarlanarak ses ayrımı yapılır.
- iOS/Android tarayıcılar sesi ancak kullanıcı bir butona dokunduktan sonra çalmaya izin verir; oyun girişinde "Mahalleye gir" gibi bir dokunuş ekranı gerekir.
- Türkçe ses yoksa metin ekranda gösterilir (yedek).

### Cevap 23 - Pozisyon süresi
- Kısa: dakikalar, nadiren saatler.

#### Teknik not (Claude)
- Bu hız, canlı PnL ve haber akışının sürekli hareketli olmasını sağlar. Her trader'ın tipik süre aralığı (örn. Selo Roket dakikalar, Madam Sevil saatlere yakın) karakter parametresi olarak tutulur, ama hepsi bu üst sınır içinde kalır.

### Cevap 24 - Karar mekanizması
- Algoritmik: her karakter kendi kurallarıyla, sadece gerçek piyasa verisine bakarak karar verir. LLM karar vermez.

#### Teknik not (Claude)
- Her karar gerçek sinyal değerlerinden çıkar (emir defteri dengesi, funding, OI, hacim, fitil vb.), bu yüzden "Logları indir" kayıtları gerçekten teşhis edilebilir olur.
- Konuşma ve gerekçe metinleri karakter başına hazır replik havuzlarından, sinyal değerleri araya konarak üretilir (LLM çağrısı yok, maliyet sıfır, 7/24 worker'da hafif).

### Cevap 25 - Kazanma/kaybetme
- Sonsuz sandbox. Hedef ve bitiş yok, amaç kasayı büyütmek.

#### Teknik not (Claude)
- Bitiş olmadığı için ilerleme hissi istatistiklerden gelir: toplam kâr, en çok batıran trader, en uzun süre ödeyen, rekor faiz geliri. Bunlar kasa şeridi ve leaderboard'da gösterilir.

### Cevap 26 - Kasa sıfırlanırsa
- Her şey sıfırlanır. Oyuncu ayarlardan yeni kasayla baştan başlar.

### Cevap 27 - Oyuncu sayısı
- Tek oyunculu: sadece kullanıcı oynayacak, tek mahalle, tek dünya.

#### Teknik not (Claude)
- Giriş/üyelik sistemi gerekmez; Firebase'de tek bir oyun kaydı tutulur.
- Güvenlik yine de gerekli: Firebase kuralları herkese açık bırakılmamalı (en azından yazma sadece worker ve oyuncunun kendi cihazıyla sınırlı olmalı).

### Cevap 28 - Jargon seviyesi
- Orta: hafif hakaret/küfür (şerefsiz, piç, hayırsız tarzı). Ağır küfür yok.

#### Teknik not (Claude)
- Replik havuzları bu seviyeye göre yazılır. Hakaretler karakterlik espri düzeyinde kalır; nefret söylemi veya grup hedefleyen ifade yok.
- Seviye tek bir ayar olarak tutulabilir (replik etiketleri: temiz / orta), ileride kolayca düşürülebilir.

### Cevap 29 - Çırak karakteri
- Çırak kendi karakteri olacak: adı ve sesi olan karşılama karakteri. Haberleri o getirir, trader'ları o korkutur.

#### Teknik not (Claude)
- Haber akışındaki olayları (likidasyon, gecikme, pazarlık, tehdit) çırak sesli okur; oyun girişinde "Mahalleye gir" dokunuşundan sonra o karşılar.
- Çırağın adı ve kişiliği henüz belirlenmedi (Claude önerecek).

### Cevap 30 - Bildirimler
- Oyun kapalıyken önemli olaylarda telefona bildirim gelsin: patlama (likidasyon), geciken borç, yeni borç talebi.

#### Teknik not (Claude)
- Web Push + service worker + Firebase Cloud Messaging (ücretsiz). Worker olay olunca FCM'e gönderir.
- iPhone'da bildirim ancak oyun "Ana Ekrana Ekle" ile PWA olarak kurulursa çalışır (iOS 16.4+). Android'de tarayıcıdan da çalışır.
- Bildirim metinleri çırak/trader repliklerinden gelir (aynı jargon seviyesi).
- Gereken: PWA manifest, service worker, bildirim izni isteme ekranı.

### Cevap 30 - Bildirimler
- Oyun kapalıyken önemli olaylarda telefona bildirim gelsin: patlama, geciken borç, yeni borç talebi.

#### Teknik not (Claude)
- Web Push, Firebase Cloud Messaging (FCM) ile; Render'daki worker olay olunca FCM'e mesaj gönderir (ücretsiz).
- Service worker gerekir. iPhone'da bildirim ancak oyun "Ana Ekrana Ekle" ile PWA olarak kurulursa çalışır (iOS 16.4+); Android'de normal tarayıcıda da çalışır.
- Bildirim izni ilk dokunuşta kullanıcıdan istenir. Bildirim metinlerini çırak karakteri yazar (replik havuzu).

_(sıradaki cevaplar buraya eklenecek)_
