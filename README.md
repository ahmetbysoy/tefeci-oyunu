# Tefeci: Kripto Mıntıkası

Canlı Binance USDⓈ-M Futures **public piyasa verisini** kullanan, tarayıcıda çalışan bir paper-trading/borç yönetimi oyunudur. Gerçek emir göndermez; yatırım hizmeti değildir.

## Kurulum

Gereksinim: Node.js `^20.19.0` veya `>=22.12.0`.

```bash
npm ci
npm run dev
```

Kalite kapısı:

```bash
npm run check
```

Bu komut sırasıyla TypeScript kontrolünü, otomatik testleri ve production build'i çalıştırır. Aynı kapı `.github/workflows/ci.yml` içinde temiz `npm ci` kurulumu sonrası çalıştırılır.

## Veri bütünlüğü

- Uydurma fiyat, bid/ask, funding veya mark-price üretilmez.
- Geçerli pozitif gerçek fiyat alınmadan ticker yayımlanmaz.
- Binance'in Nisan 2026 sonrası mimarisine uygun iki WebSocket kullanılır:
  - `/public/stream`: `bookTicker`, `depth20@500ms`
  - `/market/stream`: `ticker`, `markPrice`, `kline`, `aggTrade`, `forceOrder`
- Open Interest, public REST endpoint'inden 8 saniyede bir örneklenir.
- Fiyat, mark, kline, book, işlem akışı ve OI için bağımsız zaman damgası tutulur. EMA50 dâhil mum indikatörleri için en az 50 gerçek 1 dakikalık örnek gerekir; her strateji yalnızca ihtiyaç duyduğu kaynaklar güncelse sinyal üretebilir.
- REST/WS erişimi engellenirse sağlık durumu `BLOCKED`, `OFFLINE`, `CONNECTING` veya `DEGRADED` olarak dürüstçe gösterilir. `CONNECTED` yalnızca iki WebSocket ile OI REST güncelken verilir; çekirdek ve OI hazır sembol sayıları ayrı gösterilir. Eksik zorunlu kaynakla işlem açılmaz.
- `aggTrade` verileri saniyelik çalışan toplam kovalarında tutulur. Beş dakikalık pencere yaklaşık 300 kova ile sınırlıdır; indikatör hesapları sembol başına 500 ms throttledır.
- Emir defteri sinyali, tek best bid/ask yerine gerçek 20 kademenin notional dengesini, 30 saniyelik EWMA'yı ve yönlü kalıcılığı kullanır.
- OI değişimi ancak gerçek beş dakikalık örnek penceresi oluştuğunda kullanılabilir.
- Likidasyon kayıtları okuma/hesaplama sırasında da beş dakikalık pencereye göre temizlenir ve yalnızca seçili semboller saklanır.

Resmî geçiş bildirimi: <https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Important-WebSocket-Change-Notice>

## Risk ve muhasebe kuralları

- Aynı anda global olarak en fazla **2** açık pozisyon bulunabilir; bir trader tek slot kullanır.
- Normal piyasa çıkış önceliği deterministiktir: **likidasyon → stop → take-profit → time-stop**. Borcu kapatmaya yetecek açık kâr ayrıca erken kilitlenebilir; vade dolduğunda taze gerçek fiyatla zorunlu borç tasfiyesi uygulanır.
- Stop gap ile geçilirse iyimser stop fiyatı değil gözlenen piyasa fiyatı kullanılır.
- Pozisyon boyutu sabit marjin yüzdesinden değil, trader bakiyesinin strateji/risk-moduna göre temel `%0,7–%1,4` para riski bütçesinden hesaplanır. Kumarbaz borç baskısı bu bütçeyi artırabilir ancak motor seviyesi üst sınır `%4` olarak kalır; marjin ayrıca kısıtlanır.
- Ayarlardaki kalıcı minimum kaldıraç `1x–50x` aralığındadır ve yalnızca yeni işlemlere uygulanır. Oyuncunun seçtiği taban karakterin kişisel tavanını geçebilir fakat motorun mutlak sınırı `50x`tir. Yüksek kaldıraçta stop, modellenen likidasyonun güvenli tarafında tutulur.
- Paper execution hesabında giriş ve çıkış için `%0,05` taker ücreti ve toplam `%0,02` ters yönlü kayma varsayılır.
- Net başa baş seviyesi long ve short için iki ücret ile iki taraflı kaymayı matematiksel olarak karşılar.
- Canlı ve gerçekleşen PnL ücret/kayma sonrası net değerdir.
- Her stratejinin ayrı maksimum tutma süresi vardır; time-stop sadece süre dolduğunda ve işlem ilerleme göstermediğinde çalışır.

Bu varsayımlar gerçek borsa hesabındaki maintenance margin, fee tier, ADL, latency ve emir kuyruğu davranışının tamamını modellemez.

## Sicil ve kredi geçmişi

- Kayıt şeması `tefeci_ledger_v2` anahtarıyla `localStorage` içinde saklanır.
- Eski `tefeci_decision_logs` kayıtları açılışta şema v2'ye migrate edilir.
- İşlem logları sezon kimliği taşır. Sicil ekranında **Bu sezon** ve localStorage sınırı için tutulan **Ömür boyu (son 500 kayıt)** görünümü ayrıdır.
- Sayfa yenilendiğinde mevcut sezonun win/loss/PnL/risk serisi loglardan yeniden oluşturulur.
- Yeni sezon işlem istatistiklerini sıfırlar; tutulan ömür boyu işlem loglarını ve borç ödeme sicilini korur. Reset anındaki kapanmamış aktif/gecikmiş borçlar, reset ile silinmek yerine temerrüt olarak kayda geçer.
- Kredi notu trading win-rate'ten değil; vaktinde ödeme, gecikme, temerrüt ve toplam geri ödeme geçmişinden hesaplanır.
- Serbest bakiye borcu karşılar karşılamaz otomatik tahsilat yapılır. Vadenin son yarısında ve özellikle son beşte birinde borçlu traderın güven eşiği düşer, kaldıraç/risk iştahı kontrollü şekilde artar; aynı zamanda giderek daha küçük net kârlar kilitlenir. Vade sonunda açık pozisyonlar taze gerçek fiyatla kapatılır; bakiye yetmezse mümkün olan tutar tahsil edilip kalan borç temerrüde yazılır.
- Faiz artırma eylemi vadeyi artık kendiliğinden uzatmaz.

## Otomatik test edilen değişmezler

- Long/short net break-even hesabı.
- Ücret ve kayma dahil risk bütçesi.
- Likidasyon/stop/TP/time-stop önceliği.
- Global iki pozisyon limiti.
- Veri yokken veya zorunlu kaynak bayatken sinyal üretilmemesi.
- Gerçek beş dakikalık OI penceresi.
- Yönlü order-book kalıcılığı.
- Geri ödeme davranışına dayalı kredi skoru.
- Legacy Sicil migration, şema v2 persistence ve sezon istatistiği hydration.
- Minimum kaldıraç normalizasyonu, karakter tavanını aşan oyuncu tabanı ve `50x` mutlak sınır.
- Borç baskısının vade dilimlerine göre artması, yüksek kaldıraçta stop/likidasyon sırası, kâr kilidi ve bakiye kadar son tahsilat.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (`0.0.0.0:3000`) |
| `npm run lint` | TypeScript `--noEmit` kontrolü |
| `npm test` | Node test runner + `tsx` |
| `npm run build` | Production build |
| `npm run check` | Lint + test + build |
