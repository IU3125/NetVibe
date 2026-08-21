# NetVibe — Inbox / Chat / Kəşf / Jobs səhifələri üçün funksiya və backend planı

> Bu sənəd kod yazmır — hər UI elementinin hansı funksiyaya çevriləcəyini və onu **neçə cür** qurmaq olacağını təsvir edir.
> `netvibe.md`-dakı istinadlar bölmə nömrəsi ilə göstərilib.

---

## 1. INBOX (Söhbətlər siyahısı)

### Hazırkı UI elementləri
Axtarış çubuğu · Filter chips (All/Unread/Pinned) · Thread kartı (avatar, ad, son mesaj, vaxt, online dot, unread badge) · FAB (+ yeni söhbət modalı) · Pull-to-refresh

### Təklif olunan funksiyalar

| # | Funksiya | Necə etmək olar | netvibe.md |
|---|----------|-----------------|------------|
| 1 | **Pin/Unpin** | (A) Thread-a uzun basma → menyu (Pin/Unpin). (B) Swipe aksiyası (Swipeable). Cədvəl: `conversation_participants.pinned` (hazırdır) | §5.6 |
| 2 | **Unread sayı (rəqəm badge)** | Son oxunan vaxtdan (`last_read_at`) sonra gələn mesajları `count` etmək: `SELECT count(*) WHERE conversation_id=? AND created_at > last_read_at AND sender_id != me` | §5.6 |
| 3 | **Söhbəti silmə** | (A) Uzun basma → Delete — sadəcə öz participant sətrini sil (söhbət digərinə qalır). (B) Hər iki tərəf silsə conversation silinir. Diqqət: RLS-də DELETE artıq var | §11.1 |
| 4 | **Mute (səssizə al)** | `conversation_participants.muted_until` sütunu — mute olunanda bildiriş göndərilmir. Sadəcə bir sütun əlavəsi | §4.6 (preferences) |
| 5 | **Online status** | `profiles.is_online + last_seen` — app açıq/bağlı olanda (AppState) yenilənməlidir. "online = last_seen son 2 dəq" tərifi ilə etibarlıdır | §4.15 |
| 6 | **Typing göstəricisi** | Realtime presence kanalı: `presence {convId, typing: true/false}` + debounce (3 san) | §4.9 (presence sistemi) |
| 7 | **Draft (yarımçıq mesaj)** | Hər söhbət üçün mətn AsyncStorage-da saxlanır, girəndə geri yüklənir. Backend lazım deyil | — |
| 8 | **Header unread badge** | Dashboard mesaj ikonasında ümumi oxunmamış sayı. 30san poll və ya realtime `messages INSERT` ilə yenilənir | §4.2 (feed unread) |
| 9 | **Post/profil paylaşma → söhbət** | `messages.metadata JSONB`-ə `{post_id}` yazılır; chat-da xüsusi paylaşım bubbli render olunur. Post-dan "Share → ConversationsList" (netvibe.md-də var) | §4.2 PostCard |
| 10 | **Voice mesaj** | `expo-audio` ilə yazma, `voice-messages` bucket-a upload, `messages.voice_url` sütunu. Chat-da dalğa animasiyası | §4.9 |
| 11 | **Bloklanmış userlər** | `blocked_users` cədvəli var — yeni söhbət axtarışında bloklananlar göstərilmir, mesaj yazmaq olmur. RLS-də `NOT EXISTS` şərti | supabase-setup.sql |
| 12 | **Axtarış** | (A) Hazırkı lokal filter (kiçik siyahı üçün kifayətdir). (B) DB-də `ILIKE` (name + mesaj mətni). (C) PostgreSQL full-text (tsvector) — böyük data üçün | §4.5 |
| 13 | **Push bildiriş (yeni mesaj)** | `notify_message` trigger + bildiriş göndərmə. (A) **Expo Push**: `expo-notifications` + Expo push token (`profiles.expo_push_token`) + Edge Function `send-notification` — ən sadə, Expo ilə hazır pattern (netvibe.md §4.6). (B) **OneSignal**: SDK + dashboard — seqmentlər, analitika, in-app messaging, A/B test, planlaşdırılmış bildirişlər üçün daha güclü; Supabase Edge Function-dan OneSignal REST API ilə də göndərmək olar. Hər ikisi hələ quraşdırılmayıb | §4.6, §11.1 |
| 14 | **Unread separator** | Chat açılanda son oxunan yerdə "Yeni mesajlar" xətti | §4.9 oxşar |

---

## 2. CHAT (Söhbət ekranı)

### Hazırkı UI elementləri
Header (back, avatar, ad, online status, call, videocam, more) · Mesaj bubble-ləri (mətn + şəkil, saat, ✓✓) · Tarix ayırıcıları · Input bar (add, mətn, emoji, send)

### Təklif olunan funksiyalar

| # | Funksiya | Necə etmək olar | netvibe.md |
|---|----------|-----------------|------------|
| 1 | **Audio/video zəng** | (A) **LiveKit** — tam zəng: `calls` cədvəli (caller, callee, status, room_name) + IncomingCallScreen + push. Paketlər: `@livekit/react-native` + WebRTC config plugin (ağırdır). (B) Sadə "zəng sorğusu" — DB-də call qeydi + qarşı tərəfə push, LiveKit sonra | §4.10 |
| 2 | **Mesaj menyusu (uzun basma)** | Sheet: Copy, Reply, Edit, Delete, Forward, Report. Realtime ilə hamıya yayılır | §4.9 |
| 3 | **Edit/Delete** | `messages.edited_at / deleted_at` sütunları cədvəldə var — sadəcə UI: edit edilmiş "redaktə olundu" işarəsi, deleted "mesaj silindi" | §4.9 |
| 4 | **Reply (cavab/quote)** | `messages.reply_to_id` sütunu; bubble-da kiçik sitat göstərilir. Unikal id-lərlə asan | §4.9 |
| 5 | **Reaksiyalar (❤️😂👍...)** | `message_reactions` cədvəli (message_id, user_id, emoji) — bubble altında emoji siyahısı, toxunanda toggle. Realtime ilə canlı | §4.2 (comment_reactions oxşar) |
| 6 | **Typing indicator** | Realtime presence (yuxarıda #6 kimi). Header-da "yazır..." mətni | §4.9 |
| 7 | **Emoji seçici** | (A) Sadə grid — 20-30 populyar emoji, sheet modalda (kitabxanasız). (B) `@lodev09/react-native-true-emoji` klaviatura (ağır) | — |
| 8 | **Şəkilə toxun → tam ekran viewer** | PostDetailScreen-dəki PanResponder pinch-zoom pattern-i — eyni komponenti yeni bir Modal-a salmaq | — |
| 9 | **Yaşlı mesajları yüklə (pagination)** | FlatList `onEndReached`-ə keçmək lazımdır — hazırda `scrollToEnd` ilə sona qədər. Limit 50-lik səhifələr, yuxarı çəkəndə köhnə mesajlar | §4.9 |
| 10 | **Voice mesaj göndərmə** | Input-dakı add düyməsinə voice yazma rejimi (microphone ikonu) — yuxarıda Inbox #10 ilə eyni | §4.9 |
| 11 | **Forward (başqa söhbətə göndər)** | Share modal → ConversationsList → yeni mesaj insert | §4.2 Share |
| 12 | **Mesaj report** | `reports` cədvəli `content_type='message'` — uzun basma → Report | §4.19 |
| 13 | **Read receipt detalı** | ✓ (göndərilib) / ✓✓ (oxunub) — `last_read_at` müqayisəsi hazırdır. 1:1 üçün kifayətdir; qrup lazım olsa ayrı `message_reads` cədvəli | §4.9 |
| 14 | **Əlavə media tipləri (video, sənəd, çoxlu şəkil)** | CreatePostScreen-dəki media pattern: picker → upload → `messages.image_url`-a əlavə `video_url / document_url / metadata` | §4.9 (şəkil + voice var) |
| 15 | **Mute/Info (more menyusu)** | Header more: Contact info, Media gallery (bütün şəkillər qrid), Mute, Clear chat, Block | §4.9 oxşar |
| 16 | **Chat axtarışı** | Söhbət daxilində mesaj axtarışı — DB ILIKE + nəticəyə scroll | — |

---

## 3. KƏŞF (Discover)

### Hazırkı UI elementləri
Axtarış (people/groups/interests) · Filter chips · Featured community kartı (statik) · İnsan tövsiyə kartları (Follow) · Explore Interests siyahısı (statik)

### Təklif olunan funksiyalar

| # | Funksiya | Necə etmək olar | netvibe.md |
|---|----------|-----------------|------------|
| 1 | **Topluluqlar (Communities)** | Featured kart + Interests = topluluqlardır. (A) **Minimal**: `communities` + `community_members` + join/leave + üzv sayı + kateqoriya. (B) **Orta**: netvibe.md-dəki kimi invite kodu, join request (private). (C) **Tam**: kanallar, rollar, permissions (ağırdır, sonraya) | §4.8 |
| 2 | **Hashtag sistemi** | (A) Hazırkı: mətndə ILIKE `%#tag%` — sadə amma səhvə yol verir (#Tag vs #tag). (B) Düzgün: `hashtags` + `post_hashtags` cədvəlləri, post yaradılarkən trigger `#`-ları parse edib yazır — axtarışda real tag istifadə olunur. Kliklə → tag feed-i | §4.2, §4.5 |
| 3 | **İnsan tövsiyəsi (suggestions)** | (A) İzlənməyənlər — random (hazırkı). (B) Ən çox izlənənlər (followers sayına görə). (C) Qarşılıqlı dostlar (izlədiyinləri izləyənlər) — ən yaxşı tövsiyə. (D) Engagement əsaslı (bəyəndiyin postların müəllifləri) | — |
| 4 | **Search groups/interests** | Axtarış indi ancaq userləri tapır — topluluqlar olan kimi communities.name + hashtags üzrə də axtarır (3 sorğu, birləşdirilmiş nəticə) | §4.5 |
| 5 | **Trending bölməsi** | Son 24 saatda ən çox istifadə olunan hashtaglar (post_hashtags count) + trending topluluqlar | — |
| 6 | **Follow/Unfollow** | Hazırdır (`followers` cədvəli). Əlavə: profil kartına toxun → ProfileScreen açılır | §4.7 |
| 7 | **Topluluq detalları** | Topluluq kartına toxun → üzvlər, təsvir, join düyməsi, postlar (B variantında) | §4.8 |
| 8 | **Explore feed** | #tag seçimində ancaq şəkilli postlar — mətni olan postlar da göstərilə bilər, kateqoriyalar üzrə | §4.5 (Explore) |

---

## 4. JOBS (İşlər siyahısı)

### Hazırkı UI elementləri
Başlıq + axtarış (jobs/skills/companies) + my-location · Lokasiya sətri · 8 kateqoriya grid · "Recommended for you" + View all · İş kartları (ikon, başlıq, şirkət, maaş, type, lokasiya)

### Təklif olunan funksiyalar

| # | Funksiya | Necə etmək olar | netvibe.md |
|---|----------|-----------------|------------|
| 1 | **`jobs` cədvəli** | `title, company, category, type (full/part/contract/internship), salary_min/max, currency, period, location, city, description, responsibilities (jsonb), qualifications (jsonb), perks (jsonb), work_days/hours, apply_before, banner_url, logo_url, employer_id, status (active/closed), created_at` | — |
| 2 | **İş axtarışı** | (A) ILIKE title/company/location. (B) PostgreSQL full-text (tsvector) — "skill" axtarışı üçün daha dəqiq. Kateqoriyalar + axtarış birlikdə filterlənir | §4.5 (oxşar) |
| 3 | **Apply (müraciət)** | `job_applications` cədvəli: `(job_id, user_id, status, cover_letter, cv_url)` + `UNIQUE(job_id, user_id)` — iki dəfə müraciət olmur. CV: `profiles.cv_url`-dan avtomatik | §4.7 (CV var) |
| 4 | **Applied state** | Kartda "Applied ✓" — səhifə açılanda `job_applications`-dan userin işləri çəkilir, qarşılaşdırılır | — |
| 5 | **Save/Bookmark iş** | `saved_jobs` cədvəli — `saved_posts` pattern-inin eynisi (UNIQUE + toggle) | §5.4 (saved_posts) |
| 6 | **Kateqoriya filteri** | (A) Bir kateqoriya (hazırkı). (B) Çoxlu seçim (chips-lər toggle). DB: `WHERE category IN (...)` | — |
| 7 | **"Mənim müraciətlərim" səhifəsi** | `job_applications WHERE user_id = me` + status (Applied/Reviewed/Accepted/Rejected) — ayrı sub-screen | §4.7 (alt səhifələr) |
| 8 | **Lokasiya** | (A) Mətn (city) — sadə. (B) `expo-location` + `jobs.lat/lng` — "yaxındakı işlər", məsafə sıralaması. my-location düyməsi real işlər | — |
| 9 | **Tövsiyə mexanizmi** | (A) Sadə: `profiles.job_title/open_to_work` ilə keyword match. (B) Kateqoriya əsaslı: userin izlədiyi/baxdığı kateqoriyalar. (C) Kompleks: ML — hələlik lazım deyil | — |
| 10 | **İş elanı yaratma** | `CreateJobScreen` (yalnız employer/role) — `profiles.role` ilə məhdudlaşdırıla bilər. Status: pending/active | §4.12 (admin) |
| 11 | **İş bildirişləri** | Yeni uyğun iş çıxanda bildiriş — `notifications` type `job`, push sonra | §4.6 |
| 12 | **Şirkət səhifəsi** | `companies` cədvəli və ya employer profil — şirkətin bütün işləri | §4.7 (profil pattern) |

---

## 5. JOB DETAILS

### Hazırkı UI elementləri
Banner (şirkət) · Info chips · Description/Responsibilities/Qualifications · Position, Work Hours, Perks, Apply before · Bottom bar (bookmark + Apply)

### Təklif olunan funksiyalar

| # | Funksiya | Necə etmək olar | netvibe.md |
|---|----------|-----------------|------------|
| 1 | **Apply axını** | (A) 1 toxunuş: insert `job_applications` + employer-ə bildiriş (trigger). (B) 2 addım: modal — cover letter + CV seçimi (`profiles.cv_url` və ya yenidən yüklə). Düymə: Apply → Applied ✓ → View status | — |
| 2 | **Bookmark** | `saved_jobs` toggle — bottom bardakı bookmark düyməsi (rəng dəyişir: dolu/boş) | §5.4 |
| 3 | **Oxşar işlər** | Eyni kateqoriyalı digər işlər səhifənin sonunda siyahı (limit 3-5) | — |
| 4 | **Share** | RN `Share` API — sadə, backend lazım deyil | §4.2 (Share API) |
| 5 | **Baxış sayı** | `job_views` cədvəli — gündə 1 dəfə sayılır (profil baxış pattern-i). Employer üçün analitika | §4.7 (profile_views) |
| 6 | **Employer əlaqə** | Şirkət telefonu/email — `jobs.contact_*` sütunları, yalnız active işlər üçün görünür | — |
| 7 | **Müraciət statusu** | Artıq müraciət edilibsə düymə status göstərir: Applied / Reviewed / Accepted / Rejected — realtime və ya refresh | — |

---

## 6. ÜMUMİ (bütün səhifələrə aid)

| Mövzu | Vəziyyət | Qeyd |
|-------|----------|------|
| **Realtime** | Chat üçün hazır (messages + participants) | Sonra: `notifications` realtime — Inbox badge canlı olsun |
| **Push bildiriş** | Yoxdur | İki yol: (A) **Expo Push** — sadə, token `profiles.expo_push_token`-da, Edge Function göndərir (netvibe.md §4.6). (B) **OneSignal** — daha güclü (seqment, analitika, in-app, A/B test), amma əlavə hesab/SDK. **Qarışıq da olar**: əsas chat bildirişləri Expo Push, marketinq/analitika OneSignal. Qərar: chat, iş və bildirişlərin hamısı bir kanaldan getsin |
| **Storage** | `chat-images` var | Lazım olacaq: `voice-messages`, iş banner/logosu, CV-lər (`cvs` var) |
| **Presence** | `is_online/last_seen` kolonları var | AppState + heartbeat — bütün səhifələrdə online status dəqiqləşir |
| **Offline** | Yoxdur | AsyncStorage cache (inbox siyahısı) — sonra |
| **Qrup chat** | Yoxdur | Lazım olsa: conversation_participants çoxaldılır + `message_reads` cədvəli |

---

## 7. TƏKLİF OLUNAN İCRA SIRASI (prioritet)

1. **Inbox + Chat əlavələri**: uzun basma menyusu (pin, delete, reply, edit, report), unread sayı, typing, emoji, şəkil viewer, pagination — mövcud cədvəllərə az dəyişiklik
2. **Jobs backend**: `jobs` + `job_applications` + `saved_jobs` cədvəlləri, apply/bookmark/saved state — orta iş həcmi
3. **Kəşf**: hashtag cədvəlləri + tövsiyə alqoritmi, sonra minimal communities (join/leave)
4. **Zəng (LiveKit)** və **voice mesaj** — ağır, özünə ayrıca vaxt
5. **Push bildiriş — ƏN SONDA** (Expo Push və ya OneSignal): bildirişlər yalnız **APK build** qurulub telefona yüklənəndə tam test oluna bilər (Expo Go-da push işləmir). İstifadəçi app-i build edib apk ilə quraşdırdıqdan sonra bu hissə test ediləcək — buna görə planın ən sonuna qoyulur. Token saxlama (`profiles.expo_push_token`), Edge Function və trigger-lər bu mərhələdə yazılacaq

---

> **Qeyd:** Bu plan yalnız istiqamətdir — hansı funksiyaların götürüləcəyi, hansı variantın seçiləcəyi sizin qərarınızdır. Rəyinizi verdikdən sonra seçilmiş funksiyaların backend hissəsini (SQL + UI əlaqələndirməsi) yazacağıq.
