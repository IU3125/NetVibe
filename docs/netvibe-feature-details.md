# NetVibe — Funksiya Detalları
> Hər roadmap maddəsinin nə olduğu və necə işləyəcəyi.
> Tarix: 24 Avqust 2026 · Roadmap: `docs/netvibe-roadmap.md`

---

## 1️⃣ TƏCİLİ (möhkəmləndirmə)

### 🔔 Push Notification
**Nədir:** Tətbiq bağlı olanda da telefonuna bildiriş düşür.

**Necə işləyəcək:**
1. Tətbiq ilk açılışda `expo-notifications` ilə cihaz tokeni alır → `profiles.push_token` sütununa yazır
2. Hadisə baş verir (mesaj gəldi, müraciət statusu dəyişdi, postu bəyəndilər)
3. Supabase **Database Webhook → Edge Function** tetiklenir → Expo Push API-yə sorğu gedir
4. Cihaza bildiriş düşür → toxunursan → birbaşa həmin söhbət/vakansiyaya açılır

**Tələb:** `expo-notifications` paketi + 2-3 Edge Function.
**Qeyd:** Digər 4 funksiya buna asılıdır (status bildirişləri, xatırladıcı, bildiriş mərkəzi, chat).

### 🐞 Sentry (Crash izləmə)
**Nədir:** Kiminsə tətbiqdə çökmə olarsa, xəta sənin Sentry dashboard-da görünür.

**Necə:** `sentry-expo` quraşdır → DSN açarı config-ə → avtomatik bütün xətaları göndərir.
Hər xətada: cihaz modeli, app versiyası, stack trace, istifadəçi ID.
**Tələb:** sentry.io hesabı (pulsuz: 5k xəta/ay) + App.js-də init.

### 🔒 RLS Auditı
**Nədir:** Supabase-dəki hər cədvəlin "kim nə görə bilir" qaydalarının yoxlanması.

**Necə:** Bütün cədvəllərin siyahısı çıxarılır → hər biri üçün test: anonim istifadəçi başqasının mesajını/CV-sini oxuya bilirmi?
**Mövcud risk:** `cvs` bucket public-dir — URL-i bilən hər kəs CV-ni endirə bilir.
**Fix:** Signed URL-lər (60 dəqiqəlik müvəqqəti link) — ProfileScreen onsuz da bu üsulu işlədir.

### 🍎 iOS Testi
**Necə:** Expo Go iPhone-da aç → bütün ekranlar gəzilir (safe-area, klaviatura davranışı, audio icazələri).
**Real store üçün:** Apple Developer hesabı ($99/il) + EAS Build lazımdır.

---

## 2️⃣ QISA MÜDDƏT (1-2 ay)

### 📱 QR ilə Bağlantı 🎯 (INMerge demosu #1)
**Nədir:** Hər profilin öz QR kodu var. Skan et → follow.

**Axın:**
```
Profilim → ⋮ menyuda "QR Kod"
   ↓ ekranda böyük QR (içində: netvibe://u/<user_id>)
Tərəfdaş: Kəşf et → skan ikonu → kamera açılır
   ↓ kod oxunur → profil kartı çıxır (avatar+ad)
   ↓ "Follow et" düyməsi → followers cədvəlinə yazılır
   ↓ toast: "Yeni bağlantı!"
```

**Tələb:** `react-native-qrcode-svg` + `expo-camera` (hər ikisi Expo Go-da işləyir). ~1 gün iş.
**Demo effekti:** INMerge-in özündə iştirakçılar bir-birini skan edir → canlı istifadəçi artımı.

### 🧠 AI Match Gücləndirmə
**Nədir:** Mövcud `jobRecommendations.js` CV bacarıqları ilə vakansiya uyğunluğunu skorlayır.

**Güclənmə planı:**
- Skor < 40% olan vakansiyalar feed-də gizlənir
- Yeni faktorlar: maaş arzusu (`cv_data.salary_expectation`), təcrübə ili ↔ vəzifə səviyyəsi
- Kartda "Niyə uyğundur?" badge-i: *"React ✓ TypeScript ✓ 3 il ✓"*

### 💬 Chat Gücləndirmə
- 📎 **Fayl:** storage bucket + mövcud image_url sxeminin genişlənməsi
- 🎤 **Səs:** uzun bas → qeyd → `.m4a` upload → mesajda player
- ✓✓ **Ticklər:** `last_read_at` artıq DB-də var → oxunma ondan hesablanır

---

## 3️⃣ ORTA MÜDDƏT (3-6 ay)

### 👔 İşəgötürən–Namizəd Chatı ⬅️ (növbəti kod hədəfi)
**Necə:** Müraciətçi kartında "Mesaj yaz" ikonu → `create_or_get_conversation(employer_id, candidate_id)` RPC → mövcud ConversationScreen açılır.
**Qeyd:** DM sistemi hazırdır — sadəcə körpü (~2 saat).

### 📨 Avtomatik Status Bildirişləri
```
İşəgötürən "Uyğundur"/"İmtina" basır
   ↓ job_applications UPDATE → Postgres TRIGGER
   ↓ notifications cədvəlinə insert ("Müraciətin qəbul edildi!")
   ↓ webhook → Edge Function → namizədin cihazına push
   ↓ toxunur → vakansiya detail-inə açılır
```
**Asılılıq:** Push notification infrastrukturu.

### ✅ Təsdiqlənmiş Profil Nişanı
Settings → "Hesabını təsdiqlə" → email OTP (6 rəqəm, 5 dəq limit) → uğurlu olanda `profiles.verified=true` → mavi nişan hər yerdə (postlar, chat, müraciətlər).

### 🌐 Web Versiya
`npx expo export --platform web` → statik fayllar → Vercel/Netlify.
**Problem:** react-native-maps web-də Google Maps JS key tələb edir; layout responsive olmalıdır.

### 🔔 Bildiriş Mərkəzi
Mövcud NotificationsScreen (indi statikdir) real data ilə: `notifications` cədvəli, tip üzrə qruplaşdırma ("Vusal +3 insan səni izlədi"), oxunmamış sayğacı.

### 📦 EAS Build
`eas build -p android` → buludda real APK → Play Market üçün hazır (Expo Go olmadan öz ikonla quraşdırılan tətbiq).

---

## 4️⃣ UZUN MÜDDƏT

| Funksiya | Necə |
|---|---|
| **Video call** | Mövcud voice call (WebRTC) infra-sına kamera stream-i əlavəsi |
| 💰 **Premium** | RevenueCat/IAP: kim baxdı + limitsiz müraciət + featured profil. Free: ayda 10 müraciət |
| **Story tag-lama** | Story yaradarkən vakansiya seç → baxan "Müraciət et" düyməsi görür |

> 💰 Monetizasiya strategiyası: əvvəlcə istifadəçi bazası, pul sonrakı mərhələ.

---

## 5️⃣ BACKLOG (prioritizasiya gözləyir)

| Funksiya | Mexanizm |
|---|---|
| **Kanban pipeline** | Müraciətlər ekranında 4 sütun, drag & drop → `status` update |
| **AI cover letter** | Edge Function: CV mətni + vakansiya → LLM prompt → draft |
| **CV Builder** | Form → HTML template → PDF generasiya (Edge Function) → cvs bucket |
| **Polls** | posts-a `poll_options JSONB` + ayrıca votes cədvəli |
| **Hashtag izləmə** | `followed_hashtags` cədvəli → feed query UNION |
| **Maaş statistikası** | jobs aggregate: AVG(salary) GROUP BY category+city (AZN+USD) |
| **Vacansiya xatırladıcısı** | Gündəlik cron: deadline 2 günlük yaxın → push |
| **Mentorluq match** | profiles mentor flag + match (sahə + təcrübə fərqi) |
| **Mock interview bot** | LLM chat: vəzifə → 5 sual → cavablara feedback |
| **Freelance/gig** | jobs-da `type='Gig'` filtri + büdcə sahəsi |

---

## Strategiya Qərarları (24 Avqust 2026)
- **Auditoriya:** həm Azərbaycan lokalı, həm qlobal — 6 dil ✅, 5 valyuta ✅
- **Demo fokus:** QR bağlantı (canlı wow) + kanban pipeline (dərinlik)
- **Pul sonra:** monetizasiya istifadəçi bazasından sonra
- **Tövsiyə sırası:** Push notification → QR bağlantı → Kanban → Chat
