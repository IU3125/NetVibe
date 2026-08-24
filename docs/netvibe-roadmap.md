# NetVibe — Tətbiq Gələcək Planı (Roadmap)

> Yalnız tətbiq üzrə işlər. Prioritet sırası ilə.
> Yaradılıb: 23 Avqust 2026

## 1. Təcili (möhkəmləndirmə)
- [ ] **Push notification** — yeni mesaj, vakansiya uyğunluğu, bəyənmə bildirişləri. Engagement üçün ən kritik itki.
- [ ] **Crash/analytics** — Sentry əlavə et; hazırda xətalar yalnız console-da görünür.
- [ ] **RLS auditı** — Supabase cədvəlləri və `cvs` bucket-i üçün sətir səviyyəli təhlükəsizlik yoxlanışı (CV-lər public URL-dir!).
- [ ] **iOS testi** — hər şey Android-də test edilib; iOS layout/audio yoxlanmalıdır.

## 2. Qısa müddət (1-2 ay)
- [x] **Axtarış + filtrlər** — vakansiyalarda (şəhər, maaş, sahə) və insanlarda. ✅ *Hazırdır*
- [ ] **AI match təkmilləşdirilməsi** — `jobRecommendations.js` skorlama dərinləşdirilsin; uyğunsuz vakansiyalar gizlədilsin.
- [x] **İşəgötürən paneli** — müraciət siyahısı, motivasiya məktubu, CV baxışı (profil fallback), status (baxıldı/uyğundur/imtina), status filtri, namizəd qeydləri. ✅ *Hazırdır*
- [ ] **Chat gücləndirmə** — səs mesajı, şəkil/fayl, oxunma tickləri.
- [x] **Profil tamamlanması** — % göstəricisi + natamam hissələr üçün prompt. ✅ *Hazırdır*

## 3. Orta müddət (3-6 ay)
- [ ] **İşəgötürən–namizəd chatı** — müraciətlər bölməsindən birbaşa söhbət açmaq. ⬅️ *Növbəti*
- [ ] **Avtomatik status bildirişləri** — müraciət "baxıldı/qəbul/imtina" olanda namizədə push getməsi (push notification infrastrukturundan asılıdır).
- [ ] **Təsdiqlənmiş profil nişanı** — e-poçt + telefon OTP.
- [x] **Offline/cache** — 5 əsas ekran stale-while-revalidate keşi. ✅ *Hazırdır*
- [ ] **Web versiya** — expo-web konfiqurasiya edilmişdir.
- [ ] **Bildiriş mərkəzi** — qruplaşdırma, oxunmamış sayğacı.
- [ ] **EAS Build** — real APK/IPA (Play Market / App Store üçün ön şərt).

## 4. Uzun müddət
- [ ] Video call (voice var, video yoxdur).
- [ ] Premium funksiyalar (kim mənə baxdı, boost).
- [ ] Story-lərdə vakansiya tag-lama.
