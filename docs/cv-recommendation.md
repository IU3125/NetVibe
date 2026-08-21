# OpenAI ile CV Analizi ve Vakansiya Önerisi — Tasarım & Maliyet

## OpenAI ne için kullanılacak (tek amaç)

**CV analizi — kullanıcı CV yüklediğinde 1 kez:**
1. Supabase Edge Function, `cvs` bucket'tan PDF'i indirir
2. `pdf-parse` ile metne çevirir
3. OpenAI'ye gönderir → çıkarır: beceri listesi, hedef roller, deneyim yılı, konum, maaş beklentisi (**İngilizce'ye çevirir**)
4. Sonucu `cv_data` tablosuna kaydeder

**Vakansiya önerisi OpenAI kullanmaz** — uygulama içinde yerel skorlama (beceri ↔ ilan eşleşmesi). Ayrı API çağrısı yok, maliyeti $0.

## Maliyet

**Model:** `gpt-4o-mini` — giriş **$0.15/1M** token, çıkış **$0.60/1M** token (Ağustos 2026 fiyatı)

**Tek CV analizi:**
- Giriş: ~3.500 token (CV metni ~2.500 + prompt/schema ~1.000) × $0.15/1M ≈ **$0.0005**
- Çıkış: ~500 token (JSON) × $0.60/1M ≈ **$0.0003**
- **Toplam ≈ $0.0008 / CV**

**Oranlama:**

| CV sayısı | Maliyet |
|---|---|
| 1 | ~ $0.001 |
| 100 | ~ $0.08 |
| 1.000 | ~ $0.80 |
| 10.000 | ~ $8 |

**Formül (doğrulamak için):** `maliyet = (giriş_token × 0.15 + çıkış_token × 0.60) / 1.000.000`

## Maliyeti kontrollü tutan kurallar

- Sadece CV değiştiğinde analiz yap (her profil kaydında değil)
- Model `gpt-4o-mini`'de sabit tut (yeni modeller 6 kata kadar pahalı: gpt-5-mini $0.45/$3.60, gpt-5.4-mini $0.75/$4.50)
- `Structured Outputs` (JSON şeması) ile çıkış küçük tutulur
- CV metni ilk ~8.000 karaktere sınırlanır
- OpenAI Dashboard'da aylık harcama limiti (örn. $5) — **tek başına yeterli değil**, aşağıdaki sağlamlık kurallarıyla birlikte kullanılmalı

## Sağlamlık (robustness) kuralları

- **Rate-limit (Edge Function seviyesi) — BİRİNCİL:** OpenAI Dashboard limiti gecikmeli devreye girebilir. Bu yüzden aynı kullanıcı için **24 saatte maksimum 1 analiz** limiti eklenir. Bu sayede yarış durumunda ve kötü niyetli/döngüsel tetiklemede maliyet sabit kalır (3 analiz yerine 1 = $0.0008/gün'e kilitlenir). Aynı zamanda ikinci paralel çağrı daha OpenAI'ye gitmeden reddedildiği için eski analizin üstüne yazma riskini de büyük ölçüde ortadan kaldırır.
- **Idempotency / yarış durumu (ikincil, opsiyonel):** rate-limit yanında, kullanıcı 24 saat aralıkla iki kez CV değiştirirse yine iki paralel çağrı olabilir. `cv_data` tablosuna `analysis_version` (veya `updated_at`) sütunu eklenir; yazarken **en son kazanan** mantığı uygulanır (daha yüksek version/eski `updated_at` üzerine yazmaz). Maliyeti etkilemez, sadece doğruluğu garanti eder.
- **Structured Outputs garantisi:** `response_format: { type: "json_schema", json_schema: { strict: true, ... } }` kullanılır → model şemaya birebir uyar, JSON parse hatası neredeyse sıfırlanır. Yine de **fallback** mantığı şart: retry veya geçersiz çıkışta `cv_data` boş bırakılır, kullanıcıya hata gösterilir.
- **Taranmış PDF tespiti (önemli):** `pdf-parse` görselli/taranmış PDF'lerden metin çıkaramaz, **boş/anlamsız string döner** — OpenAI'ye boş prompt göndermek para kaybıdır. Çıkarılan metin eşik altıysa (örn. < 50 karakter) analiz başlatılmaz ve kullanıcıya *"CV'niz taranmış görünüyor, lütfen metin tabanlı PDF yükleyin"* hatası döndürülür.

## Öneri algoritması (OpenAI'sız, yerel)

| Faktör | Nasıl eşleşir | Ağırlık |
|---|---|---|
| Beceriler | CV `skills` ↔ ilan `qualifications` + `responsibilities` + `title` | yüksek |
| Rol | CV `desired_roles` ↔ ilan `title` | orta |
| Kategori | CV alanı ↔ ilan `category` | orta |
| Şehir | CV `location` ↔ ilan `city`/`location` | düşük |
| Maaş | CV beklentisi ↔ ilan `salary_min/max` | düşük |
| Kıdem | `years_experience` ↔ ilan `type` | düşük |

- Puan normalize edilip **% uyum** olarak gösterilir, yüksekten düşüğe sıralanır
- Kartta "%78 uyum" + eşleşen beceri etiketleri
- Kullanıcıda CV verisi yoksa → mevcut davranış

## Dil desteği (çok dilli)

- **CV:** analiz prompt'u çıkarılan veriyi **İngilizce'ye çevirir** — Türkçe/Azerice/Rusça CV'ler tek formatta saklanır
- **İlanlar:** opsiyonel günlük cron Edge Function aktif ilanların `title`/`qualifications`/`responsibilities`'ını İngilizce'ye çevirip `*_en` sütunlarına yazar → eşleşme hep İngilizce ↔ İngilizce
- Kategori anahtarı dil-nötr (`services`, `education`, `it`...)

## Güvenlik

- OpenAI API anahtarı **sadece Edge Function secret**'ında — asla uygulamada
- **Gönderilir:** sadece kullanıcının kendi CV metni (çıkarma için) ve gerektiğinde ilan başlık/kalifikasyonları
- **Gönderilmez:** şifre, mesaj/sohbet, diğer kullanıcı verileri, sosyal bağlantılar
- Taranmış/görselli PDF'lerde vision/OCR gerekir → ayrı ve daha pahalı bir yol; temel akışta desteklenmez, kullanıcıya metin tabanlı PDF yüklemesi söylenir
