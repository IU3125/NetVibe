# INMerge Innovation Summit 2026 — NetVibe Müraciət Planı

> **QƏRAR:** NetVibe ilə INMerge 2026-ya müraciət edəcəyik.
> **Link:** https://www.inmerge.az/startups/apply
> **Son tarix:** 15 Sentyabr 2026
> **Yer:** Bakı, Port Baku Towers (153 Neftchilar avenue)
> **Əlaqə:** [email protected] | +994 51 252 38 83

---

## 1. Forma tələbləri (NetVibe cavabları ilə)

| Sahə | Nə tələb olunur | NetVibe üçün hazırlıq |
|---|---|---|
| Primary contact | Ad, soyad, e-poçt, WhatsApp nömrəsi | ✅ Asan — qurucu məlumatları |
| Startup name | Rəsmi ad | **NetVibe** |
| Website | Sayt linki | ⚠️ Landing page lazımdır (hazırda yoxdur) |
| Headquarters | Ölkə | Azerbaijan |
| Industry | Siyahıdan seçim | **Marketplace Platforms** (alternativ: HRTech) |
| Təsvir | Max 500 simvol | Aşağıda draft var |
| Logo | PNG/SVG, max 1MB | ✅ assets/logo1.png var — PNG formatına uyğunlaşdır |
| Pitch deck | PDF, max 20MB | ❌ HAZIRLANMALI (struktur aşağıda) |
| Team | Founder-lar + rollar + LinkedIn | LinkedIn profilləri tam olmalıdır |
| Stage | Idea / MVP / Early revenue / Scaling | **MVP** (işlək demo var, gəlir yoxdur) |
| Launch date | Ay + il (opsional) | MVP hazır → müraciət ayını yaz |
| Total revenue | USD | 0 |
| VC portfolio | Var/yox | Yox |
| External funding | Aralıq seçimi | None |
| English proficiency | Bəli/Xeyr | **Bəli** (tətbiq artıq EN/AZ/TR/RU/DE/FR dil dəstəyi verir) |
| Expectations | Çoxseçimli | Raising Investments + Networking + Regional Expansion |
| Reference | Opsional | Mentor/tanımış investor varsa əlavə et |
| Terms | Qəbul | ✅ |

---

## 2. Pitch Deck strukturu (PDF, max 20MB)

Forma açıq şəkildə bunları istəyir:

1. **Product** — NetVibe nədir? Ekran görüntüləri: profil + CV yükləmə, vakansiya
   uyğunlaşdırması (`jobRecommendations.js` skorlama), mesajlaşma, community,
   voice call, stories.
2. **Problem & Solution** — İş axtaranlarla işəgötürənlər arasında CV əsaslı
   peşəkar networking çatışmır; LinkedIn Azərbaycan bazarında zəifdir.
3. **Market Size** — Azərbaycan internet istifadəçiləri, aktiv iş qüvvəsi (~4.9M),
   gənclərin işsizlik rəqəmləri, CIS genişlənmə potensialı.
4. **Business Model** — Gələcək plan: premium profillər, işəgötürən abunəliyi
   (vacansiya elan + CV database girişi), reklamlar, in-app ödənişlər.
5. **Revenue & Investments** — Hazırda 0 gəlir, bootstrap; investisiya axtarılır.
6. **Team** — Qurucu(lar), rollar, LinkedIn.
7. **Demo/QR** — Expo Go ilə canlı demo linki/QR kodu (son slayd).

### 500 simvolluq təsvir (DRAFT — redaktə et)

```
NetVibe is a professional networking and job marketplace app built for
Azerbaijan and the region. Users create rich profiles with verified CVs
(auto-analyzed via AI), discover jobs ranked by an intelligent matching
engine, and connect through chats, voice calls, communities and stories.
Employers post vacancies and reach talent directly. Unlike global platforms
that ignore local dynamics, NetVibe is mobile-first and localized in 6
languages. MVP is live on Android/iOS via Expo; next steps are employer
subscriptions and regional expansion across CIS markets.
```

(~740 simvol → qısaldılmalı! Hədəf: ≤500. Qısa versiya:)

```
NetVibe is a mobile-first professional network & job marketplace for
Azerbaijan and CIS. Rich profiles with AI-analyzed CVs, smart job matching,
chats, voice calls and communities — all localized in 6 languages. MVP live
on Android/iOS. We help employers reach local talent directly, where global
platforms fall short. Next: employer subscriptions & regional growth.
```

---

## 3. Müraciətdən ÖNCƏ todo (prioritet sırası ilə)

- [ ] **Landing page** (netvibe.az və ya netvibe.app) — ad, 3 ekran görüntüsü,
      App Store/Play "coming soon", əlaqə. (1-2 gün)
- [ ] **Pitch deck** hazırla (10-12 slayd, yuxarıdaki struktur). (2-3 gün)
- [ ] **Logo** — assets/logo1.png-dən 1MB-altı PNG/SVG düzəlt.
- [ ] **Demo hesabı** — sammit komandası test edə biləcək demo user + dolu profil.
- [ ] **Stabil build** — Expo Go-da qüsursuz işləyən versiya (islos bug həllindi;
      tam regression test: login → profil/CV → vakansiya → chat).
- [ ] **LinkedIn profilləri** — founder + komanda üçün professional.
- [ ] **Metrik toplama** — indidən trackLogin var; test user sayı, retention
      rəqəmləri deck üçün lazım olacaq.
- [ ] Formu doldur + göndər (son tarixdən əvvəl, ideal: sentyabrın 1-i kimi).

## 4. Texniki borclar (deck-dən əvvəl aradan qaldır)

- [ ] Supabase RLS siyasətlərinin auditı (profiles, cvs bucket public URL-ləri).
- [ ] cv-analyze edge function error handling-in gücləndirilməsi.
- [ ] iOS build yoxlanışı (hazırda yalnız Android test edilib).
- [ ] Crash-free səviyyəsi — Sentry və ya oxşarı əlavə etmək faydalıdır.

---

## 5. Yol xəritəsi

### Qısa müddət (Sentyabr — müraciətə qədər)
1. Landing page + pitch deck + logo (yuxarıdaki todo).
2. 20-50 real beta istifadəçi (tanışlar, universitet qrupları) → ilk rəqəmlər.
3. Müraciəti göndər.

### Orta müddət (Oktyabr-Dekabr — sammitə qədər)
1. **Employer side gücləndir:** vakansiya post etmə UX-i, admin paneldə moderasiya.
2. **AI match quality:** cv-analyze + jobRecommendations skoru təkmilləşdir
   (skill extraction keyfiyyəti).
3. Push notification sistemi (yeni vakansiya/mesaj) — engagement üçün kritik.
4. Beta feedback dövrü → retention rəqəmi toplamaq (sammitdə sükan arxası sübut).

### Uzun müddət (2027)
1. Monetizasiya: işəgötürən abunəlik paketləri + premium user profilləri.
2. Regional expansion: Gürcüstan/Qazaxıstan (CIS) — deck-də vəd edilirsə, yerinə yetir.
3. Web version (expo-web hazırda config-de var).
4. Seed round: INMerge kontaktlarından investor görüşləri.

---

*Not yaradılıb: 23 Avqust 2026*
