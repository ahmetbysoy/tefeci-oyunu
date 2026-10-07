# TEFECİ OYUNU - TODO PROMPT

Bu dosya, kodlama yapan bir yapay zeka ajanına (Claude Code vb.) verilecek tam görev promptudur.
Kaynak: `tefeci-oyunu-planlama.md` içindeki 30 cevap. Çelişki olursa o dosyadaki kullanıcı cevapları geçerlidir.

---

## 1. ROL VE HEDEF

Sen kıdemli bir full-stack mühendissin. Hedef: **mobil tarayıcıda oynanan, tek oyunculu, İstanbul arka sokak jargonlu bir "tefeci" oyunu** yapmak ve çalıştığını kanıtlamak.

Oyuncu mıntıkanın tefecisidir. Mıntıkada 5 kurnaz trader vardır. Traderlar **gerçek Binance Futures canlı verisiyle** (simülasyon/paper trading) scalping yapar. Parası biten tefeciden faizli borç ister. Oyuncu miktar, faiz ve vadeyi belirler; trader pazarlık eder. Ödemeyene oyuncu aksiyon seçer.

Kod yazmak amaç değil, **doğrulanmış çalışan oyun** amaç. Çalıştırmadığın şeye "çalışıyor" deme.

## 2. DEĞİŞMEZ KURALLAR

1. **Mock veri yok.** Fiyat, emir defteri, mark price, funding, likidasyon akışı gerçek Binance Futures public verisidir. Sahte fiyat üreten kod yalnızca testlerde, açıkça etiketli fixture olarak olabilir; asla yayındaki yolda.
2. **Gerçek para yok.** Hiçbir gerçek hesaba/API anahtarına bağlanma. Sadece public (anahtarsız) endpoint ve stream kullan. Para sanaldır.
3. Trader kararları **tamamen algoritmik**. LLM çağrısı yok. Konuşma/gerekçe metinleri karakter başına replik havuzlarından, gerçek sinyal değerleri araya konarak üretilir.
4. Komut/kod/commit/log dilleri İngilizce; **oyun içi metinler Türkçe** (sokak jargonu).
5. Eksiksiz kod teslim et. `TODO`, boş fonksiyon, "sonra yapılır" bırakılmış bir şeyi bitmiş sayma.
6. Gizli bilgi (anahtar, token, service account) kaynak koda, loga, commit'e girmez. Ortam değişkeni kullan.
7. Mikro modüler mimari. Her modül tek iş yapar, tek başına test edilebilir.

## 3. VERİLMİŞ KARARLAR (tek kaynak)

| Konu | Karar |
|---|---|
| Platform | Mobil tarayıcı oyunu (PWA olarak kurulabilir) |
| Oyuncu sayısı | Tek oyuncu, tek mahalle, tek dünya, üyelik yok |
| Tema/ton | İstanbul arka sokak jargonu, eğlenceli |
| Jargon seviyesi | Orta: hafif hakaret/küfür ("şerefsiz", "piç", "hayırsız" tarzı). Ağır küfür, nefret söylemi, grup hedefleyen ifade YOK |
| Görsel | Açık renkler, pembe ve mor pastel. Kâr/zarar renkleri pastelde okunur kalmalı (kontrast) |
| Kontrol | Sadece butonlar/kaydırıcılar. Mikrofon yok |
| Ses | Tarayıcı Web Speech API (speechSynthesis), Türkçe ses. Karakter başına farklı pitch/rate |
| Trader sayısı | 5 (ayrıntı Bölüm 5) |
| Kaldıraç | Oyun tarafında yapay sınır yok; üst sınır = Binance'in o sembol için gerçek max kaldıracı |
| Pozisyon süresi | Dakikalar, nadiren saatler |
| Borç | Oyuncu her borca ayrı miktar, faiz, vade yazar. Borcun tamamı trader'ın işlem kasasına girer |
| Pazarlık | Trader karaktere göre karşı teklif verir (sınırlı tur) |
| Ödenmeyen borç | Oyuncu aksiyon seçer: **"Çırağı gönder, korkut"** ve **"Faizi katla / vadeyi uzat"**. (Teminata el koyma ve bilgi karşılığı borç silme YOK) |
| Başlangıç kasası | Ayarlardan oyuncu belirler |
| Coin seçimi | Ayarlarda input alanı; Binance Futures USDT perpetual listesinden otomatik tamamlama; ortak havuz |
| Oyun hedefi | Sonsuz sandbox, bitiş yok, amaç kasayı büyütmek |
| Kasa sıfırlanırsa | Her şey sıfırlanır, ayarlardan yeni kasayla baştan |
| Arka plan | Oyun kapalıyken de trader'lar işlem yapar: Render üzerinde 7/24 Python worker + UptimeRobot ping |
| Veri deposu | Firebase Realtime Database (europe-west1) |
| Bildirim | Önemli olaylarda telefona push: patlama, geciken borç, yeni borç talebi |
| Log | "Logları indir": zarar eden tüm pozisyonlar, neden açıldı, neden zarar etti. JSON + okunabilir Markdown özet |

## 4. MİMARİ

```
Binance Futures public WSS ──► [Render: Python worker] ──► Firebase RTDB ◄── [Telefon: Vite+React]
                                   │                            ▲
                                   └── FCM push ────────────────┘ (service worker)
```

**Worker (Python, asyncio + websockets, küçük FastAPI/aiohttp `/health`):**
- `feed`: birleşik stream bağlantısı, otomatik yeniden bağlanma (backoff + jitter), sessizlik tespiti (X sn mesaj yoksa yeniden bağla).
- `market`: sembol başına en güncel durum (bookTicker, derinlik, mark price, funding, OI, son işlemler, likidasyon akışı).
- `traders/*`: her karakter ayrı eklenti (ortak arayüz: `evaluate(market_state) -> decision`).
- `exchange_sim`: dolum (fill) simülasyonu, marjin, likidasyon, funding, komisyon.
- `ledger`: kasa, borçlar, faiz tahakkuku, olaylar.
- `events`: haber akışı olayları + FCM bildirimleri.
- `store`: Firebase okuma/yazma; açılışta durumu oradan geri yükler (Render restart'a dayanıklı).
- `dialogue`: replik havuzları + şablon doldurma.
- `logexport`: karar kayıtlarını JSON/MD üretir.

**Frontend (Vite + React + TypeScript):**
- `firebase client`: durumu canlı dinler.
- `priceFeed`: canlı PnL'in akıcı olması için seçili coinlerin fiyatını doğrudan Binance public WSS'den alır (worker'ın yazdığı pozisyon durumu + yerel fiyatla PnL hesaplar). Binance'e erişilemezse worker'ın yazdığı son fiyata düşer (fallback).
- `tts`: Web Speech sarmalayıcı, karakter profili (pitch/rate), kullanıcı dokunuşu şartı.
- `ui/*`: ekranlar (Bölüm 7).
- `push`: service worker + FCM kayıt.

**Veri akışı kuralı:** Firebase'e her tick YAZMA. Sadece durum değişimlerini (pozisyon aç/kapat, borç, olay) ve düşük frekanslı özetleri yaz. RTDB yazma limitlerini aşma.

**Bilinmesi gerekenler (doğrula, tahmin etme):**
- Binance Futures WSS adresleri ve stream isimleri (`bookTicker`, `aggTrade`, `markPrice`, `forceOrder`, `depth`) güncel dokümandan doğrulanacak.
- Binance bazı bölgelerde (ör. ABD IP'leri) engelli. Render bölgesi Frankfurt veya Singapore seç; bağlantıyı canlı test et.
- Render ücretsiz plan davranışı (uyku, saat limiti, yeniden başlama) güncel dokümandan kontrol edilecek.

## 5. KARAKTERLER

Hepsi kurnaz, piyasayı bilen, sana oyun oynamaya çalışan tipler. Her biri: lakap, strateji, giriş/çıkış kuralları, kaldıraç eğilimi, tipik tutma süresi, borç davranışı, pazarlık tarzı, ses profili, replik havuzu.

| Lakap | Strateji (gerçek veriden) | Borç/pazarlık huyu |
|---|---|---|
| **Fitilci Mehmet** | Stop avı / likidasyon fitili sonrası ters yöne giriş (forceOrder + ani fitil) | Sinsi, "seni çok severim abi" der, yalan söyler; korkutulursa kinlenir |
| **Tahta Kemal** | Emir defteri dengesizliği, duvar/spoof tespiti | Az konuşur, tek cümleyle karşı teklif; tehditkâr |
| **Fonlama Nuri** | Funding + açık pozisyon (OI) kalabalığına ters oynar | Seni de oyuna getirmeye çalışır, hesabı iyi bilir |
| **Selo Roket** | Hacim patlaması momentum scalp, yüksek kaldıraç | Aceleci, hemen kabul eder; kaybedince hemen tekrar borç ister; korkutulunca öder |
| **Madam Sevil** | Range / ortalamaya dönüş | Tatlı dilli, flörtle faiz indirtmeye çalışır; en soğuk hesaplı |

Kurallar:
- Strateji parametreleri karakter dosyasında tutulur; sabit kodlanmaz.
- Her karar bir **karar kaydı** üretir (Bölüm 9).
- Korkutma etkisi karaktere göre değişir (risk azalır veya çaresizlikten artar).

## 6. OYUN MEKANİKLERİ

**Borç:** kayıt = trader, anapara, faiz oranı, faiz periyodu, vade, durum (`teklif`, `aktif`, `gecikti`, `ödendi`, `kaçtı`), uygulanan aksiyonlar. Trader bakiyesi = kendi bakiyesi + borç; ödeme bakiyeden düşer.

**Teklif akışı:** trader kapıya gelir (sesli) → oyuncu trader'ın istatistiğini görür (kâr/zarar geçmişi, ödeme geçmişi, açık pozisyonlar) → miktar + faiz + vade girer → trader kabul/red/karşı teklif (en fazla 2-3 tur).

**Başlangıç:** traderlar sırayla gelip ilk borçlarını ister.

**Ödemeyen trader:** oyuncu seçer: `Çırağı gönder, korkut` veya `Faizi katla / vadeyi uzat`. Her aksiyonun ölçülebilir etkisi olmalı ve loga yazılmalı.

**İşlem simülasyonu (`exchange_sim`):**
- Dolum: market emirde alışta ask, satışta bid; derinlik varsa kaymayı (slippage) hesaba kat.
- Komisyon, funding (8 saatlik periyotta), izole marjin, mark price üzerinden likidasyon fiyatı.
- Binance'in kademeli idame marjini (maintenance margin brackets) kullanılacaksa doğrula; basitleştirdiysen bunu dokümante et ve raporla.
- Kasası sıfırlanan trader batar; borcu varsa borç aksiyonları devreye girer.

**Kasa sıfırlanması (oyuncu):** her şey silinir, ayarlardan yeni kasayla baştan.

## 7. EKRANLAR (mobil öncelikli)

- **Giriş:** "Mahalleye gir" dokunuşu (ses ve bildirim izni için gerekli). Çırak karşılar.
- **Ana ekran:** üstte sabit kasa şeridi (canlı kâr/zarar, dağıtılan borç). Altında kaydırılabilir kartlar/sekmeler: **Leaderboard**, **Açık pozisyonlar + canlı PnL**, **Mahalle haber akışı** (patlayanlar, kavgalar, tehditler).
- **Borç teklif ekranı:** trader kartı + istatistik + miktar/faiz/vade girişi + pazarlık.
- **Borç listesi / aksiyon ekranı:** geciken borçlar, aksiyon butonları.
- **Ayarlar:** başlangıç kasası, coin seçimi (otomatik tamamlamalı input), ses/bildirim, "Logları indir", sıfırla.
- Stil: açık, pembe-mor pastel; büyük dokunma alanları; 360-430 px genişlikte test et.

## 8. SES VE ÇIRAK

- `speechSynthesis` ile Türkçe ses; yoksa metin ekranda gösterilir (yedek).
- Her karakterin pitch/rate profili farklı olsun (ör. Selo tiz-hızlı, Kemal kalın-yavaş).
- Çırak: adı ve sesi olan karakter; haberleri okur, bildirim metinlerini yazar, korkutma aksiyonunu yürütür. **Adı ve kişiliğini sen öner**, oyuncu onaylasın.
- Replikler etiketli (`temiz` / `orta`) tutulsun; jargon seviyesi tek ayardan değiştirilebilsin.

## 9. LOG İNDİRME

Her işlem için karar kaydı: zaman, sembol, yön, kaldıraç, giriş anındaki sinyal özeti (fiyat, emir defteri durumu, funding, OI, hacim, fitil vb.), stop/hedef, çıkış nedeni, PnL, ücretler, trader'ın o anki durumu.

"Logları indir": **zarar eden tüm pozisyonlar** için JSON (yapay zekaya vermek üzere) + okunabilir Markdown özet. Özet, "neden açıldı / neden zarar etti" bölümlerini içerir. Amaç: geçmiş hataları görüp trader mantığını geliştirmek.

## 10. BİLDİRİMLER

- Web Push (FCM) + service worker. Olaylar: trader patladı (likidasyon), borç gecikti, yeni borç talebi.
- Android'de normal tarayıcıda çalışır; iPhone'da yalnızca "Ana Ekrana Ekle" ile PWA kurulursa (iOS 16.4+) çalışır; bunu kullanıcıya ekranda anlat.
- Bildirim metinlerini çırak yazar.

## 11. GÜVENLİK

- Firebase rules: herkese açık yazma YOK. Yazma yalnızca worker (service account, ortam değişkeni) ve oyuncunun kendi cihazı. Kuralları test et (yetkisiz yazma reddediliyor mu).
- Worker `/health` dışında dışarıya iş yapan endpoint açmaz.
- Bağımlılıklar bilinen, bakımlı paketler; sürümleri sabitle.

## 12. KABUL KRİTERLERİ (her biri kanıtla doğrulanacak)

- A1: Worker Binance'e bağlanır, seçili coinler için canlı veri alır; 60 sn'de beklenen sayıda mesaj gelir. Gerçek payload örneği kayda alınır.
- A2: Bağlantı koparılınca worker kendiliğinden toparlanır; durum Firebase'den geri yüklenir (worker'ı öldürüp yeniden başlatarak test).
- A3: 5 trader'ın her biri gerçek veriyle, kendi kurallarına göre pozisyon açıp kapatır; her biri karar kaydı üretir.
- A4: Dolum/marjin/likidasyon hesabı bağımsız referansa (elle hesaplanmış örnekler) karşı doğrulanır; uç durumlar (sıfır, aşırı kaldıraç, funding) test edilir.
- A5: Borç akışı uçtan uca çalışır: teklif, pazarlık, kabul, faiz tahakkuku, vade, gecikme, iki aksiyon, ödeme/batma.
- A6: Ana ekran dört bölümü gösterir; canlı PnL gerçek fiyatla hareket eder; telefon genişliğinde taşma/kayma yok.
- A7: Coin input'u Binance sembol listesinden otomatik tamamlar, seçim worker'a yansır.
- A8: TTS çalışır (en az bir gerçek mobil tarayıcıda; çalışmıyorsa `UNVERIFIED` yaz), yedek metin görünür.
- A9: Push bildirimi gelir (Android'de doğrula; iOS PWA doğrulanamıyorsa `UNVERIFIED`).
- A10: "Logları indir" gerçek zarar eden pozisyonlardan JSON + MD üretir; içerik karar kayıtlarıyla tutarlı.
- A11: Firebase kuralları yetkisiz yazmayı reddeder (kanıtla).
- A12: Temiz klonlamadan, belgelenmiş adımlarla kurulup çalışır; testler/lint/build çıktıları okunur.

Öznel kriterler (görsel beğeni, replik esprisi) ve harici bağımlı olanlar (gerçek cihazda ses/bildirim, hesap gerektirenler) doğrulanamazsa `UNVERIFIED` + nedeni yazılır; PASS sayılmaz.

## 13. GÖREV GRAFI (riskli olan önce, ince dilim önce)

**Faz 0 - Sözleşme ve keşif**
- T0.1 Bu promptu hedef sözleşmesine çevir (hedef, kısıt, kapsam dışı, varsayımlar); `.agent/` durum dosyalarını kur.
- T0.2 Ortamı incele (Python/Node sürümleri, ağ, Binance erişimi, Firebase erişimi). Binance erişimi yoksa DUR ve raporla.
- T0.3 Binance Futures public stream/endpoint ve Render/Firebase güncel dokümanlarını doğrula; bulguları `findings.md`'ye kaynakla yaz.

**Faz 1 - En riskli kısım: canlı veri**
- T1.1 `feed`: tek sembol, gerçek payload'ı yakala, parse et, yeniden bağlanma ekle.
- T1.2 Çoklu sembol birleşik stream + dinamik abone olma.
- T1.3 `market` durum modeli (bookTicker, derinlik, mark/funding, likidasyon akışı).

**Faz 2 - Simülasyon çekirdeği**
- T2.1 `exchange_sim` (dolum, komisyon, marjin, likidasyon, funding) + referans testleri.
- T2.2 `ledger` (kasa, borç, faiz tahakkuku) + testler.

**Faz 3 - İlk uçtan uca dilim**
- T3.1 Tek trader (Selo Roket) + karar kaydı + Firebase'e yazma.
- T3.2 Minimal frontend: canlı PnL + kasa şeridi.
- T3.3 Hizalama kontrolü: oyuncunun anladığı oyun bu mu? (özet göster)

**Faz 4 - Kadro**
- T4.1-T4.4 Diğer 4 trader (Mehmet, Kemal, Nuri, Sevil), her biri ayrı modül + test.
- T4.5 Replik havuzları (etiketli, orta seviye) + `dialogue` şablonları.

**Faz 5 - Borç oyunu**
- T5.1 Teklif/pazarlık motoru (karaktere göre).
- T5.2 Gecikme + iki aksiyon + etkileri.
- T5.3 Borç ekranları (teklif, liste, aksiyon).

**Faz 6 - Arayüz ve ses**
- T6.1 Ana ekran (leaderboard, pozisyonlar, haber akışı).
- T6.2 Ayarlar (kasa, coin input, sıfırla).
- T6.3 TTS + giriş dokunuşu + çırak karakteri (isim önerisi onaya sunulur).
- T6.4 Pastel tema + kontrast kontrolü + mobil test.

**Faz 7 - Arka plan ve bildirim**
- T7.1 Render deploy (Frankfurt/Singapore), `/health`, ortam değişkenleri, UptimeRobot kurulumu için adımlar.
- T7.2 Restart dayanıklılığı testi.
- T7.3 FCM + service worker + bildirim olayları.

**Faz 8 - Log ve güvenlik**
- T8.1 "Logları indir" (JSON + MD).
- T8.2 Firebase rules + yetkisiz yazma testi.

**Faz 9 - Kapanış**
- T9.1 Kendi işine karşı kontrol: testler gerçekten bozuk kodda başarısız oluyor mu? Karar kayıtları gerçek mi?
- T9.2 Temiz klon ile çalıştırma, tüm kabul kriterleri için kanıt tablosu.
- T9.3 Final rapor.

## 14. ÇALIŞMA KURALLARI

- Önce ince, uçtan uca bir dilim çalıştır; sonra genişlet.
- Her adımda çalıştır, çıktıyı oku, kanıt defterine yaz (kriter, komut, gözlem, sonuç).
- Aynı hata sınıfı 3 kez tekrarlarsa yaklaşımı değiştir; aynı komutu körlemesine tekrarlama.
- Kapsam dışına çıkma: bu dosyada olmayan özellik ekleme, çalışan şeyi gereksiz yeniden yazma.
- Geri dönüşü olmayan/harici işlem (deploy, silme, ücretli hizmet, üçüncü taraf) için önce kullanıcıdan onay al.
- Kullanıcı bir sır (token/anahtar) yapıştırırsa yalnızca ortam değişkeni olarak kullan, kaynak/log/rapora koyma, işi bitince iptal etmesini hatırlat.
- Durum seviyeleri: IMPLEMENTED < WORKING < VERIFIED < PRODUCTION-READY. Kanıtın izin verdiğinden yüksek seviye söyleme.

## 15. AÇIK NOKTALAR VE VARSAYIMLAR

- Çırağın adı/kişiliği: ajan önerir, oyuncu onaylar.
- Coin havuzu ortak; her trader havuzdan kendi stratejisine uyan coini seçer (varsayım, onay bekliyor).
- Pazarlık tur sayısı: önerilen 2-3.
- Binance idame marjin kademeleri: tam mı basit mi uygulanacak (kullanıcıya raporla).
- Render ücretsiz plan limitleri ve Binance bölge erişimi canlı doğrulanmadı.

## 16. TESLİM FORMATI

Final rapor (Türkçe, ledger'dan üretilmiş): Sonuç (DONE / PARTIALLY COMPLETE / BLOCKED + durum seviyesi), ne değişti, doğrulama tablosu (kriter -> PASS/FAIL + gözlem), teslim edilenler (yollar/URL), kararlar ve varsayımlar, `UNVERIFIED` kriterler (neyin doğrulayacağıyla), doğrulanmayanlar/sınırlar, kullanıcıdan gerekenler, güvenlik notları (iptal edilecek sırlar).
