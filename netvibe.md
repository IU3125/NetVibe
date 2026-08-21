# Ticcer Sosial Media Tətbiqi - Tam Dokumentasiya

## 1. Ümumi Məlumat

**Ticcer** — React Native (Expo SDK 56) ilə qurulmuş, Supabase backend-li, tam funksional sosial media tətbiqidir. Azərbaycan dilində interfeysə malik olmaqla yanaşı, 13 dil dəstəyi mövcuddur.

- **Platforma:** iOS, Android
- **UI Framework:** React Native 0.85.3
- **Backend:** Supabase (PostgreSQL + Storage + Edge Functions + Realtime)
- **Auth:** Supabase Auth (email/password)
- **Media:** LiveKit (audio/video calls, live streaming)
- **Push Bildiriş:** Expo Push Notifications + OneSignal
- **Animasiya:** `react-native-reanimated`, `expo-linear-gradient`
- **İkonlar:** `@expo/vector-icons` (Ionicons)

---

## 2. İstifadə Olunan Paketlər

| Paket | Versiya | İstifadə Sahəsi |
|-------|---------|-----------------|
| `expo` | ~56.0.12 | Əsas framework |
| `react-native` | 0.85.3 | UI framework |
| `@supabase/supabase-js` | ^2.78.0 | Backend DB, Auth, Storage, Realtime |
| `@react-navigation/native` | ^7.3.3 | Navigation |
| `@react-navigation/stack` | ^7.10.5 | Stack navigator |
| `@react-navigation/bottom-tabs` | ^7.18.2 | Tab navigator |
| `@livekit/react-native` | ^2.11.1 | Live streaming, audio/video calls |
| `livekit-client` | ^2.20.0 | LiveKit client SDK |
| `@livekit/react-native-webrtc` | ^144.1.1 | WebRTC for LiveKit |
| `@livekit/react-native-expo-plugin` | ^1.0.2 | Expo plugin for LiveKit |
| `@config-plugins/react-native-webrtc` | ^15.0.1 | WebRTC config plugin |
| `expo-camera` | ~56.0.8 | Kamera (story, live) |
| `expo-image-picker` | ~56.0.18 | Galeri seçimi |
| `expo-image-manipulator` | ~56.0.19 | Şəkil redaktəsi |
| `expo-video` | ~56.1.4 | Video player (reels) |
| `expo-audio` | ~56.0.12 | Audio recording/playback (voice messages) |
| `expo-notifications` | ~56.0.18 | Push bildirişlər |
| `expo-localization` | ~56.0.6 | Cihaz dilini aşkarlama |
| `expo-file-system` | ~56.0.8 | Fayl sistem əməliyyatları |
| `expo-haptics` | ~56.0.3 | Haptic feedback |
| `expo-linear-gradient` | ~56.0.4 | Gradient fonlar |
| `expo-device` | ~56.0.4 | Cihaz məlumatı |
| `expo-status-bar` | ~56.0.4 | Status bar idarəsi |
| `expo-build-properties` | ~56.0.19 | Build konfiqurasiyası |
| `@react-native-async-storage/async-storage` | 2.2.0 | Lokal məlumat saxlama (token, tema, dil) |
| `react-native-gesture-handler` | ~2.31.1 | Gesture handling |
| `react-native-reanimated` | 4.3.1 | Animasiyalar |
| `react-native-safe-area-context` | ~5.7.0 | Safe area |
| `react-native-screens` | 4.25.2 | Ekran optimizasiyası |
| `react-native-masonry-list` | ^2.16.2 | Masonry grid (kəşf səhifəsi) |
| `react-native-webrtc` | (via config-plugins) | WebRTC |
| `@expo/vector-icons` | ^15.0.2 | İkonlar (Ionicons) |
| `@expo/ngrok` | ^4.1.3 | Development tunnel |

---

## 3. Sistem Arxitekturası

```
App.tsx
├── Providers (ThemeProvider, LanguageProvider, AuthProvider, ProfileThemeProvider)
│   └── AppNavigator
│       ├── AuthNavigator (Login, Register, ForgotPassword)
│       └── MainTabs (Bottom Tab Navigator)
│           ├── FeedTab (Stack) - Feed, CreatePost, CreateStory, GoLive, PostDetail, Chat, Notifications, Call
│           ├── SearchTab (Stack) - SearchMain
│           ├── ReelsTab (Stack) - ReelsMain, CreateReel
│           ├── CommunityTab (Stack) - CommunityList, CommunityDetail, ChannelChat, VoiceChannel, etc.
│           ├── AdminTab (Stack) - AdminPanel (yalnız adminlər üçün)
│           └── ProfileTab (Stack) - Profile, EditProfile, Settings, Followers, etc.
```

---

## 4. Sistemlər və Xüsusiyyətlər

### 4.1. Autentifikasiya Sistemi (`src/lib/auth.tsx`)

- **Provider:** `AuthProvider` - Supabase Auth ilə session idarəsi
- **Metodlar:** `signUp`, `signIn`, `signOut`, `resetPassword`, `refreshProfile`
- **Yaddaş:** Session AsyncStorage-da saxlanılır
- **Hook:** `useAuth()` — user, profile, loading məlumatları

### 4.2. Post Sistemi

#### FeedScreen (`src/screens/feed/FeedScreen.tsx`)
- Postları Supabase `posts` cədvəlindən çəkir
- Follow edilən userlərin postlarını göstərir, digərlərindən 5 ədəd əlavə edir
- `close_friends` visibility filtrasiyası
- StoryPreview, LiveViewer, PostCard komponentlərini birləşdirir
- 30 saniyədən bir avtomatik yenilənir
- Oxunmamış bildiriş sayını göstərir (15 san interval)

#### CreatePostScreen (`src/screens/feed/CreatePostScreen.tsx`)
- Mətn + şəkil postu yaratma
- Hashtag avtomatik aşkarlanır (`#söz`) və `post_hashtags` cədvəlinə yazılır
- Mention aşkarlanır (`@istifadeci`) və `mentions` cədvəlinə yazılır
- Görünürlük: `everyone` / `close_friends`
- Planlaşdırma: 1, 3, 6, 24 saat sonraya təyinetmə
- Şəkil upload: `post-images` bucket

#### PostCard (`src/components/PostCard.tsx`)
- **Əməliyyatlar:** Like, Comment, Repost, Save, Share, Report, Delete
- Hashtag və mention-lar kliklənə bilər
- VerifiedBadge göstərir
- Close friends postlarında xüsusi badge
- Share: mesaj olaraq (ConversationsList) və ya digər tətbiqlərə (Share API)

#### PostDetailScreen (`src/screens/feed/PostDetailScreen.tsx`)
- Postu tam göstərir
- **Comment sistemi:** parent_id ilə reply-lər, reaction emojilər (❤️🔥👍😂😢😮)
- **AI Comment Suggestions** komponenti ilə ağıllı şərh təklifləri
- Like, Save əməliyyatları

### 4.3. Story Sistemi

#### StoryPreview (`src/components/StoryPreview.tsx`)
- Feed-in yuxarısında üfüqi scroll
- Story-ləri `stories` cədvəlindən çəkir (expires_at filtr)
- İzlənən userlər + öz story-ləri
- **Live indicator:** Canlı yayımda olan userlər üçün "Canli" etiketi + qırmızı ring
- Baxılmış/baxılmamış vəziyyəti `story_views` ilə izlənir
- 30 saniyədən bir yenilənir
- Real-time lives kanalı

#### StoryViewer (`src/components/StoryViewer.tsx`)
- Tam ekran story izləyici
- 5 saniyəlik avtomatik keçid
- Sol/ort/sağ toxunma: geri/dur/irəli
- Progress bar (top)
- **Baxış sayı:** Owner üçün story-ə baxanların siyahısı
- **Silme:** Öz story-ni silmə imkanı

#### CreateStoryScreen (`src/screens/story/CreateStoryScreen.tsx`)
- Kamera (ön/arxa, flash)
- Qalereyadan media seçimi
- **Filterlər:** Warm, Cool, Vintage, Noir, Dramatic, Pastel, Neon
- **Stikerlər:** 😎🔥❤️💯😂🎉⭐👑🌈🦋🌙⚡
- **Mətn əlavəsi:** rəng seçimi (ağ, qırmızı, mavi, sarı, çəhrayı, yaşıl)
- Upload: `stories` bucket, 24 saat expiry

### 4.4. Reels Sistemi

#### ReelsScreen (`src/screens/reels/ReelsScreen.tsx`)
- Vertikal tam ekran video feed
- Aktiv video avtomatik oynayır, digərləri dayanır
- Viewport-based aktivlik izləmə

#### CreateReelScreen (`src/screens/reels/CreateReelScreen.tsx`)
- Kamera ilə video çəkiliş
- Filterlər, musiqi seçimi, sürət tənzimləməsi
- Upload: `reels` bucket

#### ReelItem (`src/components/ReelItem.tsx`)
- Like, Save, Follow, Share, Report əməliyyatları
- Video loop
- Hashtag rendering

### 4.5. Axtarış Sistemi (`src/screens/search/SearchScreen.tsx`)

- **Mode-lar:** Users / Hashtags / Communities
- **Users:** `username` və `full_name` ilə LIKE axtarışı
- **Hashtags:** `post_hashtags` join ilə post tapma
- **Communities:** `name` və `description` ilə LIKE axtarışı
- **Kəşf (Explore):** İzlənməyən userlərin postları, masonry grid
- **Follow əməliyyatı:** Birbaşa axtarış nəticəsindən follow/unfollow
- 300ms debounce ilə axtarış

### 4.6. Bildiriş Sistemi

#### NotificationsScreen (`src/screens/notifications/NotificationsScreen.tsx`)
- **Tip:** like, comment, follow, mention, message
- Supabase `notifications` cədvəlindən çəkir
- Oxunmuş/oxunmamış statusu
- Hamısını silmə

#### NotificationBanner (`src/components/NotificationBanner.tsx`)
- Real-time incoming notification toast
- Supabase Realtime kanalı (`notifications` INSERT)
- 3.5 saniyə görünür, sonra yuxarı çıxır
- Toxunanda Notifications səhifəsinə yönləndirir

#### Push Bildiriş Sistemi (`src/lib/notifications.ts`)
- **Qurulum:** `expo-notifications` + `expo-device`
- Expo push token `profiles` cədvəlinə yazılır
- **Kanallar:** `general` (ümumi), `calls` (zənglər)
- **Notification listener:** incoming call zamanı avtomatik IncomingCallScreen
- **Deep linking:** `ticcer://{type}/{postId}`

#### Supabase Edge Function: `send-notification`
- Expo Push API ilə bildiriş göndərir
- Call notification-da priority `high`, channel `calls`
- Notification preference control (likes, comments, follows, mentions, messages)

### 4.7. Profil Sistemi (`src/screens/profile/ProfileScreen.tsx`)

- Öz profili / başqa user profili
- **Statistika:** Post sayı, followers, following, profil baxış sayı
- **Media tab-lar:** Posts (şəkillər), Reels (videolar), Saved (yalnız öz)
- **Follow/Unfollow** əməliyyatı
- **Profil baxış tracking:** hər gün 1 dəfə sayılır
- **Profile Theme:** gradient fon, rəng sxemi
- **VerifiedBadge** göstərir (gray/gold/red/bronze/platinum)
- Paylaşma (ConversationsList)
- **Alt səhifələr:**
  - `EditProfileScreen` - Avatar, ad, bio, link redaktə
  - `CloseFriendsScreen` - Yaxın dostlar idarəsi
  - `ThemeSelectorScreen` - Profil temaları (10 tema)
  - `FollowersScreen` / `FollowingScreen` - Siyahılar
  - `ProfileViewsScreen` - Son baxışlar analitikası

### 4.8. Topluluq Sistemi (Community)

#### CommunityListScreen (`src/screens/community/CommunityListScreen.tsx`)
- Bütün topluluqlar + üzvlük statusu
- Axtarış
- İzlənən dostların üzv olduğu topluluqlar göstərilir
- **İnvite kodu** ilə qoşulma modalı
- Kateqoriyalar: gaming, music, art, tech, sports, education, social, other

#### CommunityDetailScreen (807 sətir)
- Cover şəkli, avatar, ad, təsvir, kateqoriya
- **Kanallar:** Text kanallar + Voice kanallar
- **Üzvlər:** member siyahısı, rol göstəriciləri
- **Join request** sistemi (private communities)
- **İnvite** sistemi (invite-only communities)
- **Settings:** cover/icon dəyişmə, ad/dəyişmə, privacy dəyişmə, silmə
- **Rol bağlantısı:** RoleManagementScreen

#### ChannelChatScreen (571 sətir)
- Text kanal chat
- Voice mesaj göndərmə
- Banlanmış sözlər filtrasiyası
- Slow mode (göndərmə limiti)
- Rol-based permissions (read/write)
- Mesaj redaktə/silmə

#### VoiceChannelScreen (814 sətir)
- LiveKit ilə səsli kanal
- Mute/Deafen/Screen share
- Participant list
- Active speaker göstəricisi
- Səs dalğa animasiyası

#### ChannelSettingsScreen (334 sətir)
- Slow mode tənzimləmə
- Banlanmış sözlər siyahısı
- Word limit exemption
- User ban

#### ChannelPermissionsScreen (123 sətir)
- Per-role channel permissions: Read, Write, Voice toggle

#### RoleManagementScreen (478 sətir)
- Rol CRUD (yarat, sil, redaktə)
- Rəng + ikon seçimi
- Basic permissions + Advanced permissions
- Role assignment modal

#### CreateCommunityScreen (522 sətir)
- Cover, icon, name, description, category, privacy
- Privacy: public, private (request), invite_only

#### BannedScreen (229 sətir)
- Ban səbəbi göstərir
- Help link

### 4.9. Chat / Messaging Sistemi

#### ChatScreen (`src/screens/chat/ChatScreen.tsx`, 738 sətir)
- **Real-time messaging:** Supabase Realtime `messages` cədvəli
- **Məzmun tipləri:** Text, şəkil, voice mesaj
- **Voice recording:** `expo-audio` ilə səs yazma, `voice-messages` bucket
- **Voice dalğa animasiyası**
- **Edit/Delete:** mesaj redaktə və silmə
- **Select mode:** çoxlu mesaj seçimi
- **Report:** mesaj şikayəti
- **Delivery/Read status:** `presence` sistemi ilə
- **Online indicator:** `formatLastSeen` funksiyası

#### ConversationsListScreen (`src/screens/chat/ConversationsListScreen.tsx`)
- Bütün söhbətlər siyahısı
- Son mesaj preview
- Share post/profile destination

#### NewConversationScreen (`src/screens/chat/NewConversationScreen.tsx`)
- User axtarışı
- Yeni söhbət başlatma

### 4.10. Audio/Video Zəng Sistemi

#### CallScreen (`src/screens/call/CallScreen.tsx`, ~300 sətir)
- LiveKit ilə audio/video zəng
- Kamera toggle, mic toggle, speaker toggle, flash toggle
- Zəng müddəti hesablanması
- End call

#### IncomingCallScreen (`src/screens/call/IncomingCallScreen.tsx`, ~150 sətir)
- Gələn zəng bildirimi
- Accept/Decline
- Real-time calls cədvəli monitoring

#### Calls Cədvəli (`supabase-calls.sql`)
- `calls` table: caller_id, callee_id, status, call_type, room_name
- RLS policies

### 4.11. Live Streaming Sistemi

#### GoLiveScreen (`src/screens/live/GoLiveScreen.tsx`, 371 sətir)
- Kamera preview → LiveKit broadcast
- Başlıq daxiletmə
- Canlı izləyici sayı
- İzləyici siyahısı
- Mute/kamera toggle
- Stream duration
- Live view count tracking (`live_viewers` cədvəli)

#### LiveViewerScreen (`src/screens/live/LiveViewerScreen.tsx`, 216 sətir)
- LiveKit viewer
- İzləyici sayı (real-time Supabase channel)
- Stream bitdikdə avtomatik bildiriş
- LiveKit Room event listener (Disconnected)

### 4.12. Doğrulama (Verification) Sistemi

#### VerifiedBadge (`src/components/VerifiedBadge.tsx`)
- **Tiplər:** Gray, Gold, Red, Bronze, Platinum
- Rəng: gray (#8E8E93), gold (#FFD700), red (#FF3B30), bronze (#CD7F32), platinum (#00BFA5)

#### GoldRequestScreen (`src/screens/settings/GoldRequestScreen.tsx`)
- Gold verification üçün müraciət
- Passport şəkli upload (`gold-requests` bucket)

#### AdminPanelScreen (`src/screens/admin/AdminPanelScreen.tsx`, 607 sətir)
- **Bölmələr:** Users, Gold Requests, Reports
- **Gold request idarəsi:** Approve/Reject, user-i gold verify etmə
- **Report idarəsi:** content preview, ignore/delete content/ban user
- **User list:** bütün userlər, verified status

### 4.13. Lokalizasiya (i18n) Sistemi

#### Dəstəklənən dillər (13 dil):
| Kod | Dil |
|-----|-----|
| az | Azərbaycan |
| en | English |
| ru | Русский |
| zh | 中文 |
| es | Español |
| hi | हिन्दी |
| ar | العربية |
| pt | Português |
| fr | Français |
| de | Deutsch |
| ja | 日本語 |
| ko | 한국어 |
| tr | Türkçe |

#### LanguageContext (`src/i18n/LanguageContext.tsx`)
- Cihaz dilini avtomatik aşkarlama (`expo-localization`)
- AsyncStorage-da seçilmiş dil saxlanılır
- `isAuto` mode: cihaz dilinə uyğun
- `setAuto()` funksiyası

#### i18n/index.ts
- `setLocale`, `getLocale`, `t()` — çeviri funksiyaları
- Parameter dəstəyi (`Record<string, string | number>`)
- Fallback: İngilis dili

### 4.14. Tema Sistemi

#### ThemeProvider (`src/lib/theme.tsx`)
- Dark / Light mode
- AsyncStorage-da saxlanılır
- **Dark Colors:** background #0F0F23, primary #6C63FF, card #252550
- **Light Colors:** background #F5F5FA, primary #6C63FF, card #EEEEF5
- `useTheme()` hook — colors, mode, toggleTheme

#### ProfileThemeProvider (`src/lib/profileTheme.tsx`)
- 10 profil teması: Default, Ocean, Forest, Sunset, Lavender, Rose, Arctic, Fire, Neon, Midnight
- Hər tema: primary_color, secondary_color, background_gradient, card_color
- AsyncStorage-da saxlanılır

### 4.15. Presence / Online Status Sistemi (`src/lib/presence.ts`)

- `AppState` dəyişikliyinə əsasən online/offline
- `profiles` cədvəlində `is_online` və `last_seen` sütunları
- `formatLastSeen()` — nisbi vaxt formatı

### 4.16. Storage Sistemi (`src/lib/storage.ts`)

- **Bucket:** avatars, post-images, reels, stories, lives, voice-messages, community-covers, community-icons, community-audio, gold-requests
- `uploadAvatar()` — 400x400, 60% compress
- `uploadCommunityIcon()`, `uploadCommunityCover()`
- `uriToArrayBuffer()` — URI → ArrayBuffer çevirici

### 4.17. LiveKit Sistemi (`src/lib/livekit.ts`)

- LiveKit URL: `wss://ticcer-tk77dg81.livekit.cloud`
- Token caching (5 dəqiqə)
- `generateRoomName()` — unikal otaq adı
- Supabase Edge Function `generate-livekit-token` ilə token generasiyası

### 4.18. AI Comment Suggestions (`supabase/functions/ai-comment-suggestions`)

- Post məzmununu analiz edir
- Kateqoriyalar: positive, question, supportive, funny, aesthetic
- Hər kateqoriyaya uyğun şərh şablonları
- Söz əsaslı analiz (Azərbaycan dili)
- Random seçim, max 5 təklif

### 4.19. Hesabat / Report Sistemi

#### ReportModal (`src/components/ReportModal.tsx`)
- **Səbəblər:** Spam, Təhqir, Nifrət nitqi, Yetkin məzmun, Zorakılıq, Müəllif hüququ, Digər
- **Content tipləri:** post, reel, message
- `reports` cədvəlinə yazılır
- Admin tərəfindən dəyərləndirilir

### 4.20. Ayarlar / Settings (`src/screens/settings/SettingsScreen.tsx`)

- **Görünüş:** Tema dəyişmə (dark/light)
- **Dil seçimi:** LanguageSelectorScreen
- **Profil temaları:** ThemeSelectorScreen
- **Bildiriş preference:** likes, comments, follows, mentions, messages toggle
- **Gold request:** Gold doğrulama müraciəti
- **Admin panel** (yalnız adminlər)
- **Çıxış:** signOut

---

## 5. Supabase Database Cədvəlləri

### 5.1. Əsas Cədvəllər

| Cədvəl | Təsvir |
|--------|--------|
| `profiles` | User profilləri (username, full_name, avatar_url, bio, verified_type, role, language, theme_id, expo_push_token, is_online, last_seen) |
| `posts` | Postlar (content, image_url, visibility, scheduled_at, status) |
| `post_likes` | Like münasibətləri |
| `post_comments` | Commentlər (parent_id ilə reply) |
| `comment_reactions` | Comment reaksiyaları (emoji) |
| `reposts` | Repost münasibətləri |
| `hashtags` | Hashtag siyahısı |
| `post_hashtags` | Post-Hashtag bağlantısı |
| `mentions` | Mention münasibətləri |

### 5.2. Story Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `stories` | Story-lər (media_url, expires_at) |
| `story_views` | Story baxışları |

### 5.3. Reels Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `reels` | Reel videolar (video_url, thumbnail_url, description) |
| `reel_likes` | Reel like-lar |
| `reel_views` | Reel baxışları |
| `saved_reels` | Saxlanılmış reels |

### 5.4. Profil Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `follows` | Follow münasibətləri |
| `close_friends` | Yaxın dost siyahısı |
| `profile_views` | Profil baxışları |
| `saved_posts` | Saxlanılmış postlar |

### 5.5. Bildiriş Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `notifications` | Bildirişlər (type, title, body, data, read) |
| `notification_preferences` | Bildiriş preference-ləri |

### 5.6. Chat Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `conversations` | Söhbət kanalları |
| `conversation_participants` | Söhbət üzvləri |
| `messages` | Mesajlar (content, image_url, voice_url, edited_at, deleted_at) |

### 5.7. Topluluq Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `communities` | Topluluqlar (name, description, icon_url, cover_url, category, privacy, verified_type) |
| `community_members` | Üzvlük münasibətləri |
| `community_channels` | Kanallar (type: text/voice, name) |
| `channel_messages` | Kanal mesajları |
| `community_join_requests` | Qoşulma sorğuları |
| `community_invites` | Dəvət kodları |
| `community_roles` | Rollar (name, color, icon, permissions, priority) |
| `role_assignments` | Rol təyinatları |
| `channel_permissions` | Kanal-rol permissionları |
| `channel_read_status` | Kanal oxunma statusu |
| `channel_bans` | Kanal banları |
| `voice_participants` | Səs kanalı iştirakçıları |
| `community_bans` | Topluluq banları |
| `banned_word_violations` | Qadağan söz pozuntuları |

### 5.8. Canlı Yayım Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `lives` | Canlı yayımlar (room_name, title, status, started_at) |
| `live_viewers` | İzləyici münasibətləri |

### 5.9. Zəng Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `calls` | Zənglər (caller_id, callee_id, status, call_type, room_name) |

### 5.10. Admin Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `reports` | Hesabatlar (content_type, content_id, reason, description) |
| `gold_requests` | Gold verification müraciətləri (passport_url, status) |

### 5.11. AI Cədvəlləri

| Cədvəl | Təsvir |
|--------|--------|
| `ai_suggestions` | AI şərh təklifləri (suggestions array) |

---

## 6. Storage Buckets

| Bucket | İstifadə |
|--------|----------|
| `avatars` | Profil şəkilləri |
| `post-images` | Post şəkilləri |
| `reels` | Reel videoları |
| `stories` | Story media |
| `lives` | Live stream kayıtları |
| `voice-messages` | Səs mesajları |
| `community-covers` | Topluluq cover şəkilləri |
| `community-icons` | Topluluq ikonları |
| `community-audio` | Topluluq səs faylları |
| `gold-requests` | Gold verification passportları |

---

## 7. Supabase Edge Functions

| Function | URL | Təsvir |
|----------|-----|--------|
| `send-notification` | `/functions/v1/send-notification` | Expo Push bildiriş göndərmə |
| `generate-livekit-token` | `/functions/v1/generate-livekit-token` | LiveKit JWT token |
| `ai-comment-suggestions` | `/functions/v1/ai-comment-suggestions` | AI şərh təklifləri |

---

## 8. Konfiqurasiya Faylları

| Fayl | Təsvir |
|------|--------|
| `app.json` | Expo konfiq (name "Ticcer", dark mode, permissions, plugins) |
| `package.json` | Dependency-lər, scripts |
| `tsconfig.json` | TypeScript config (`@/*` alias) |
| `babel.config.js` | Babel + module-resolver |
| `eas.json` | EAS Build profiles |
| `.env.example` | Environment dəyişənləri template |
| `google-services.json` | Firebase konfiq (push notifications) |

---

## 9. Ekranların Tam Siyahısı

### Auth
- LoginScreen
- RegisterScreen
- ForgotPasswordScreen

### Feed
- FeedScreen
- CreatePostScreen
- PostDetailScreen

### Story
- CreateStoryScreen (Camera + Gallery + Filters + Text + Stickers)

### Search
- SearchScreen (Users/Hashtags/Communities/Explore)

### Reels
- ReelsScreen
- CreateReelScreen

### Profile
- ProfileScreen
- EditProfileScreen
- CloseFriendsScreen
- ThemeSelectorScreen
- ProfileViewsScreen
- FollowersScreen
- FollowingScreen

### Community
- CommunityListScreen
- CommunityDetailScreen
- ChannelChatScreen
- ChannelSettingsScreen
- ChannelPermissionsScreen
- VoiceChannelScreen
- CreateCommunityScreen
- RoleManagementScreen
- BannedScreen

### Chat
- ChatScreen
- ConversationsListScreen
- NewConversationScreen

### Call
- CallScreen
- IncomingCallScreen

### Live
- GoLiveScreen
- LiveViewerScreen

### Notifications
- NotificationsScreen

### Settings
- SettingsScreen
- LanguageSelectorScreen
- GoldRequestScreen

### Admin
- AdminPanelScreen

---

## 10. SQL Migration Faylları

| Fayl | Sətir | Təsvir |
|------|-------|--------|
| `supabase-migration.sql` | 633 | Əsas migration - bütün cədvəllər + RLS + triggerlər |
| `supabase-storage-setup.sql` | 53 | Storage bucket-lar |
| `supabase-follows.sql` | 18 | Follows cədvəli |
| `supabase-community-features.sql` | 147 | Community xüsusiyyətləri (cover, category, privacy, invites) |
| `supabase-calls.sql` | 32 | Calls cədvəli |
| `supabase-rls-fix.sql` | 153 | RLS hardening |
| `supabase-voice-messages.sql` | 50 | Voice message support |
| `supabase-live-viewers.sql` | 41 | Live viewer count |
| `supabase-read-status.sql` | 22 | Channel read status |
| `supabase-channels.sql` | 65 | Channel settings + bans |
| `supabase-roles.sql` | 114 | Custom roles sistemi |
| `supabase-new-features.sql` | 235 | Close friends, scheduled posts, comment reactions, profile views, AI |
| `supabase-presence.sql` | 48 | Online/offline presence |
| `supabase-complete-fix.sql` | 354 | RLS fixes, auto role assignment, bans, violations |

---

## 11. SQL Kodları

### 11.1. supabase-migration.sql (Əsas Migration)

```sql
-- Ticcer - Supabase SQL Migration (idempotent)
-- Run this in Supabase Dashboard -> SQL Editor. Safe to run multiple times.

-- 0. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('gold-requests', 'gold-requests', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view post-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view reels" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload reels" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload stories" ON storage.objects;

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.role() = 'authenticated'
);
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Anyone can view post-images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Users can upload post-images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'post-images' AND auth.role() = 'authenticated'
);
CREATE POLICY "Anyone can view reels" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Users can upload reels" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'reels' AND auth.role() = 'authenticated'
);
CREATE POLICY "Anyone can view stories" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Users can upload stories" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'stories' AND auth.role() = 'authenticated'
);
DROP POLICY IF EXISTS "Anyone can view lives" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload lives" ON storage.objects;
CREATE POLICY "Anyone can view lives" ON storage.objects FOR SELECT USING (bucket_id = 'lives');
CREATE POLICY "Users can upload lives" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'lives' AND auth.role() = 'authenticated'
);

-- 1. TABLES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expo_push_token TEXT
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_type TEXT DEFAULT 'gray';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_verified_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_verified_type_check CHECK (verified_type IN ('none', 'gray', 'gold', 'red'));

UPDATE profiles SET verified_type = 'gray' WHERE verified = true AND verified_type = 'none';
UPDATE profiles SET verified_type = 'red' WHERE role = 'admin' AND verified_type = 'none';

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);

CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

CREATE TABLE IF NOT EXISTS lives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended'))
);

ALTER PUBLICATION supabase_realtime ADD TABLE lives;

INSERT INTO storage.buckets (id, name, public) VALUES ('lives', 'lives', true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'mod', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'voice')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS saved_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reel', 'message')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'nudity', 'violence', 'copyright', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gold_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  passport_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  likes BOOLEAN DEFAULT true,
  comments BOOLEAN DEFAULT true,
  follows BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  messages BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'message')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Enablement
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Likes are viewable by everyone" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON post_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unlike" ON post_likes FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Comments are viewable by everyone" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment" ON post_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON post_comments FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Hashtags viewable by everyone" ON hashtags FOR SELECT USING (true);
CREATE POLICY "Anyone can create hashtags" ON hashtags FOR INSERT WITH CHECK (true);
CREATE POLICY "Post hashtags viewable by everyone" ON post_hashtags FOR SELECT USING (true);
CREATE POLICY "Users can add hashtags to posts" ON post_hashtags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "Mentions viewable by everyone" ON mentions FOR SELECT USING (true);
CREATE POLICY "Users can create mentions" ON mentions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "Reels are viewable by everyone" ON reels FOR SELECT USING (true);
CREATE POLICY "Users can create reels" ON reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own reels" ON reels FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Stories viewable by everyone" ON stories FOR SELECT USING (true);
CREATE POLICY "Users can create stories" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Lives viewable by everyone" ON lives FOR SELECT USING (true);
CREATE POLICY "Users can start live" ON lives FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own live" ON lives FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = id AND user_id = auth.uid()));

CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Users can view their conversation participants" ON conversation_participants FOR SELECT
  USING (user_id = auth.uid() OR is_conversation_member(conversation_id));

CREATE POLICY "Users can send messages" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in their conversations" ON messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own participation" ON conversation_participants FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete conversations they are in" ON conversations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Communities are viewable by everyone" ON communities FOR SELECT USING (true);
CREATE POLICY "Users can create communities" ON communities FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view channels" ON community_channels FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_channels.community_id AND user_id = auth.uid())
);

CREATE POLICY "Members can view channel messages" ON channel_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.id = channel_messages.channel_id
    WHERE cm.community_id = cc.community_id AND cm.user_id = auth.uid())
);

CREATE POLICY "Members can send channel messages" ON channel_messages FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.id = channel_messages.channel_id
    WHERE cm.community_id = cc.community_id AND cm.user_id = auth.uid())
);

CREATE POLICY "Users can view own saved posts" ON saved_posts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can save posts" ON saved_posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unsave posts" ON saved_posts FOR DELETE USING (user_id = auth.uid());

ALTER TABLE saved_reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved reels" ON saved_reels FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can save reels" ON saved_reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unsave reels" ON saved_reels FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can insert reports" ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);
CREATE POLICY "Admins can update reports" ON reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);
CREATE POLICY "Admins can delete reports" ON reports FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);

CREATE POLICY "Users can view own gold_requests" ON gold_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own gold_requests" ON gold_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all gold_requests" ON gold_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);
CREATE POLICY "Admins can update gold_requests" ON gold_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);
CREATE POLICY "Admins can delete gold_requests" ON gold_requests FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR verified_type = 'red'))
);

CREATE POLICY "Users can view own notification preferences" ON notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notification preferences" ON notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notification preferences" ON notification_preferences FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Trigger: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Notification Triggers
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'like', 'Yeni bəyənmə', (SELECT full_name FROM profiles WHERE id = NEW.user_id) || ' postunuzu bəyəndi',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', NEW.user_id, 'route', 'ticcer://post/' || NEW.post_id)
  FROM posts p WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_insert ON post_likes;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_like();

CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'comment', 'Yeni şərh', (SELECT full_name FROM profiles WHERE id = NEW.user_id) || ' postunuza şərh yazdı',
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'actor_id', NEW.user_id, 'route', 'ticcer://post/' || NEW.post_id)
  FROM posts p WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_insert ON post_comments;
CREATE TRIGGER on_comment_insert
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment();

CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (NEW.following_id, 'follow', 'Yeni izləyici', (SELECT full_name FROM profiles WHERE id = NEW.follower_id) || ' sizi izləməyə başladı',
    jsonb_build_object('actor_id', NEW.follower_id, 'route', 'ticcer://profile/' || NEW.follower_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_insert ON follows;
CREATE TRIGGER on_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_follow();

CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (NEW.user_id, 'mention', 'Sizdən bəhs edildi', (SELECT full_name FROM profiles WHERE id IN (SELECT user_id FROM posts WHERE id = NEW.post_id)) || ' sizi qeyd etdi',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', (SELECT user_id FROM posts WHERE id = NEW.post_id), 'route', 'ticcer://post/' || NEW.post_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mention_insert ON mentions;
CREATE TRIGGER on_mention_insert
  AFTER INSERT ON mentions
  FOR EACH ROW EXECUTE FUNCTION notify_mention();

CREATE OR REPLACE FUNCTION notify_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT cp.user_id, 'message', (SELECT full_name FROM profiles WHERE id = NEW.sender_id),
    LEFT(NEW.content, 50),
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id, 'route', 'ticcer://message/' || NEW.conversation_id)
  FROM conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id != NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_message();
```

### 11.2. supabase-follows.sql

```sql
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (follower_id = auth.uid());
```

### 11.3. supabase-community-features.sql

```sql
ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'invite_only'));

INSERT INTO storage.buckets (id, name, public) VALUES ('community-covers', 'community-covers', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view community-covers" ON storage.objects FOR SELECT USING (bucket_id = 'community-covers');
CREATE POLICY "Users can upload community-covers" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'community-covers' AND auth.role() = 'authenticated'
);

CREATE TABLE IF NOT EXISTS community_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

ALTER TABLE community_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON community_join_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create requests" ON community_join_requests FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM communities WHERE id = community_id AND privacy = 'private')
);
CREATE POLICY "Admins can view requests" ON community_join_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM communities WHERE id = community_join_requests.community_id AND owner_id = auth.uid())
);
CREATE POLICY "Admins can update requests" ON community_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM communities WHERE id = community_join_requests.community_id AND owner_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS community_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_uses INT DEFAULT NULL,
  use_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites" ON community_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM communities WHERE id = community_invites.community_id AND owner_id = auth.uid())
);
CREATE POLICY "Anyone can verify invite" ON community_invites FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION join_community_by_invite(invite_code TEXT, user_id UUID)
RETURNS UUID AS $$
DECLARE
  inv community_invites;
  com communities;
  member_id UUID;
BEGIN
  SELECT * INTO inv FROM community_invites WHERE code = invite_code;
  IF inv IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  SELECT * INTO com FROM communities WHERE id = inv.community_id;
  IF com.privacy != 'invite_only' THEN RAISE EXCEPTION 'Community is not invite-only'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < NOW() THEN RAISE EXCEPTION 'Invite code has expired'; END IF;
  IF inv.max_uses IS NOT NULL AND inv.use_count >= inv.max_uses THEN RAISE EXCEPTION 'Invite code has reached max uses'; END IF;
  INSERT INTO community_members (community_id, user_id, role) VALUES (inv.community_id, user_id, 'member') RETURNING id INTO member_id;
  UPDATE community_invites SET use_count = use_count + 1 WHERE id = inv.id;
  RETURN member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS verified_type TEXT DEFAULT null CHECK (verified_type IS NULL OR verified_type IN ('bronze', 'platinum'));

CREATE OR REPLACE FUNCTION auto_verify_community()
RETURNS TRIGGER AS $$
DECLARE member_count INT;
BEGIN
  SELECT COUNT(*) INTO member_count FROM community_members WHERE community_id = NEW.community_id;
  IF member_count >= 2 THEN UPDATE communities SET verified_type = 'platinum' WHERE id = NEW.community_id;
  ELSIF member_count >= 1 THEN UPDATE communities SET verified_type = 'bronze' WHERE id = NEW.community_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_insert
  AFTER INSERT ON community_members
  FOR EACH ROW EXECUTE FUNCTION auto_verify_community();
```

### 11.4. supabase-calls.sql

```sql
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'rejected')),
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  room_name TEXT UNIQUE NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call participants can view" ON calls FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "caller can insert" ON calls FOR INSERT
  WITH CHECK (caller_id = auth.uid());
CREATE POLICY "participants can update" ON calls FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE calls;
```

### 11.5. supabase-voice-messages.sql

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration REAL;
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS voice_duration REAL;

INSERT INTO storage.buckets (id, name, public) VALUES ('voice-messages', 'voice-messages', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view voice messages" ON storage.objects FOR SELECT USING (bucket_id = 'voice-messages');
CREATE POLICY "Users can upload voice messages" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'voice-messages' AND auth.role() = 'authenticated'
);
CREATE POLICY "Users can delete own voice messages" ON storage.objects FOR DELETE USING (
  bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Updated notify_message trigger
CREATE OR REPLACE FUNCTION notify_message()
RETURNS TRIGGER AS $$
DECLARE msg_body TEXT;
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content != '' THEN msg_body := LEFT(NEW.content, 50);
  ELSIF NEW.audio_url IS NOT NULL THEN msg_body := '🎤 Sesli mesaj';
  ELSE msg_body := 'Mesaj';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT cp.user_id, 'message', (SELECT full_name FROM profiles WHERE id = NEW.sender_id),
    msg_body,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id, 'route', 'ticcer://message/' || NEW.conversation_id)
  FROM conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id != NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 11.6. supabase-live-viewers.sql

```sql
ALTER TABLE lives ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS live_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(live_id, user_id)
);

ALTER TABLE live_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live viewers" ON live_viewers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join live" ON live_viewers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can leave live" ON live_viewers FOR DELETE USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE live_viewers;

CREATE OR REPLACE FUNCTION increment_live_viewers(live_id UUID)
RETURNS VOID AS $$ BEGIN
  UPDATE lives SET viewer_count = viewer_count + 1 WHERE id = live_id AND status = 'live';
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_live_viewers(live_id UUID)
RETURNS VOID AS $$ BEGIN
  UPDATE lives SET viewer_count = GREATEST(viewer_count - 1, 0) WHERE id = live_id AND status = 'live';
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 11.7. supabase-channels.sql

```sql
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS banned_words TEXT[] DEFAULT '{}';
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS slow_mode BOOLEAN DEFAULT false;
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS slow_mode_interval INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS channel_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  banned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE channel_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view bans" ON channel_bans FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_bans.channel_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Admins can ban users" ON channel_bans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_bans.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can unban" ON channel_bans FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_bans.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

CREATE TABLE IF NOT EXISTS voice_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE voice_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view voice participants" ON voice_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = voice_participants.channel_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Members can join voice" ON voice_participants FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = voice_participants.channel_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Members can leave voice" ON voice_participants FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Members can update own mute" ON voice_participants FOR UPDATE USING (user_id = auth.uid());
```

### 11.8. supabase-roles.sql

```sql
ALTER TABLE voice_participants ADD COLUMN IF NOT EXISTS screen_sharing BOOLEAN DEFAULT false;
ALTER TABLE community_roles ALTER COLUMN permissions SET DEFAULT '{"can_read": true, "can_write": true, "can_voice": false, "manage_channels": false, "manage_roles": false, "manage_members": false, "manage_messages": false, "manage_community": false}';

CREATE TABLE IF NOT EXISTS community_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6C63FF',
  permissions JSONB DEFAULT '{"can_read": true, "can_write": true, "can_voice": false, "manage_channels": false, "manage_roles": false, "manage_members": false, "manage_messages": false, "manage_community": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, name)
);
ALTER TABLE community_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view roles" ON community_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_roles.community_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage roles" ON community_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_roles.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can update roles" ON community_roles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_roles.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can delete roles" ON community_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_roles.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);

CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES community_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view role assignments" ON role_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = role_assignments.community_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can assign roles" ON role_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = role_assignments.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can remove role assignments" ON role_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = role_assignments.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);

CREATE TABLE IF NOT EXISTS channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES community_roles(id) ON DELETE CASCADE,
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT true,
  can_voice BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, role_id)
);
ALTER TABLE channel_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view channel permissions" ON channel_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_permissions.channel_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Admins can manage channel permissions" ON channel_permissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_permissions.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can update channel permissions" ON channel_permissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_permissions.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can delete channel permissions" ON channel_permissions FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_permissions.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

INSERT INTO storage.buckets (id, name, public) VALUES ('community-audio', 'community-audio', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Anyone can view community audio" ON storage.objects FOR SELECT USING (bucket_id = 'community-audio');
CREATE POLICY "Admins can upload community audio" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'community-audio' AND auth.role() = 'authenticated'
);
```

### 11.9. supabase-new-features.sql

```sql
-- Close Friends
CREATE TABLE IF NOT EXISTS close_friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, friend_id), CHECK (user_id != friend_id)
);
CREATE INDEX IF NOT EXISTS idx_close_friends_user ON close_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_close_friends_friend ON close_friends(friend_id);
ALTER TABLE close_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own close friends" ON close_friends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add close friends" ON close_friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove close friends" ON close_friends FOR DELETE USING (auth.uid() = user_id);

-- Scheduled Posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'close_friends'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'cancelled'));

CREATE OR REPLACE FUNCTION publish_scheduled_posts()
RETURNS void AS $$
BEGIN
  UPDATE posts SET status = 'published'
  WHERE status = 'pending' AND scheduled_at IS NOT NULL AND scheduled_at <= now();
END;
$$ LANGUAGE plpgsql;

-- Comment Reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (length(emoji) <= 8),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comment reactions" ON comment_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react to comments" ON comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- Profile Views
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (viewer_id != profile_id)
);
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile views" ON profile_views FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Authenticated users can record profile views" ON profile_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Message Edit/Delete
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Theme Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_id TEXT DEFAULT 'default';

-- Multi-Language
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('az', 'en', 'ru', 'zh', 'es', 'hi', 'ar', 'pt', 'fr', 'de', 'ja', 'ko', 'tr'));

-- Updated handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, language, theme_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'İstifadəçi'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en'),
    'default'
  ) ON CONFLICT (id) DO UPDATE SET
    language = COALESCE(EXCLUDED.language, profiles.language),
    theme_id = COALESCE(EXCLUDED.theme_id, profiles.theme_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Posts visibility RLS
CREATE POLICY "Users can view everyone posts" ON posts FOR SELECT USING (
  visibility = 'everyone' OR user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM close_friends cf WHERE cf.user_id = posts.user_id AND cf.friend_id = auth.uid()
  )
);

-- View: recent_profile_views
CREATE OR REPLACE VIEW recent_profile_views AS
SELECT pv.profile_id, COUNT(*) as view_count, COUNT(DISTINCT pv.viewer_id) as unique_viewers
FROM profile_views pv WHERE pv.created_at >= now() - INTERVAL '7 days' GROUP BY pv.profile_id;
```

### 11.10. supabase-presence.sql

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE POLICY "Participants can update messages" ON messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);

CREATE POLICY "Channel members can update messages" ON channel_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_messages.channel_id AND cm.user_id = auth.uid())
);

CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;
CREATE POLICY "Users can delete own comments" ON post_comments FOR DELETE USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM posts WHERE id = post_comments.post_id AND user_id = auth.uid())
);
```

### 11.11. supabase-rls-fix.sql

```sql
-- Community RLS hardening - only community admin/mod can manage
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
CREATE POLICY "Admins can update communities" ON communities FOR UPDATE USING (
  owner_id = auth.uid() OR
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

DROP POLICY IF EXISTS "Users can join communities" ON community_members;
CREATE POLICY "Users can join communities" ON community_members FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can add members" ON community_members;
CREATE POLICY "Admins can add members" ON community_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

CREATE POLICY "Users can leave communities" ON community_members FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can remove members" ON community_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can update member roles" ON community_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

DROP POLICY IF EXISTS "Admins can create channels" ON community_channels;
CREATE POLICY "Admins can create channels" ON community_channels FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can update channels" ON community_channels FOR UPDATE USING (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can delete channels" ON community_channels FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

DROP POLICY IF EXISTS "Admins can delete channel messages" ON channel_messages;
CREATE POLICY "Admins can delete channel messages" ON channel_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM community_members cm JOIN community_channels cc ON cc.community_id = cm.community_id
    WHERE cc.id = channel_messages.channel_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'mod'))
);

ALTER TABLE community_roles ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'shield-outline';
```

### 11.12. supabase-complete-fix.sql

```sql
-- Complete fix with auto role assignment, bans, violations system

-- Channel settings additions
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS banned_word_limit INTEGER DEFAULT 3;
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS slow_mode_exempt_roles UUID[] DEFAULT '{}';
ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Community bans table
CREATE TABLE IF NOT EXISTS community_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT, banned_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);
ALTER TABLE community_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view community bans" ON community_bans FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_bans.community_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage community bans" ON community_bans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM communities WHERE id = community_bans.community_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM community_members WHERE community_id = community_bans.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);
CREATE POLICY "Admins can delete community bans" ON community_bans FOR DELETE USING (
  EXISTS (SELECT 1 FROM communities WHERE id = community_bans.community_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM community_members WHERE community_id = community_bans.community_id AND user_id = auth.uid() AND role IN ('admin', 'mod'))
);

-- Auto role: New Member → Senior Member (5 days)
CREATE OR REPLACE FUNCTION auto_assign_new_member_role()
RETURNS TRIGGER AS $$
DECLARE yeni_role_id UUID; is_owner BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM communities WHERE id = NEW.community_id AND owner_id = NEW.user_id) INTO is_owner;
  IF NEW.role IN ('admin', 'mod') OR is_owner THEN RETURN NEW; END IF;
  INSERT INTO community_roles (community_id, name, color, icon, permissions)
  VALUES (NEW.community_id, 'Yeni Üzv', '#4ECDC4', 'star-outline', '{"manage_channels": false, "manage_roles": false, "manage_members": false, "manage_messages": false}')
  ON CONFLICT (community_id, name) DO NOTHING;
  SELECT id INTO yeni_role_id FROM community_roles WHERE community_id = NEW.community_id AND name = 'Yeni Üzv';
  INSERT INTO role_assignments (community_id, user_id, role_id) VALUES (NEW.community_id, NEW.user_id, yeni_role_id) ON CONFLICT (user_id, role_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_assign_new_member_role AFTER INSERT ON community_members FOR EACH ROW EXECUTE FUNCTION auto_assign_new_member_role();

CREATE OR REPLACE FUNCTION upgrade_expired_roles(p_community_id UUID DEFAULT NULL)
RETURNS TABLE(affected_user_id UUID, old_role TEXT, new_role TEXT) AS $$
DECLARE kidemli_role_id UUID; rec RECORD;
BEGIN
  FOR rec IN (
    SELECT ra.id AS assignment_id, ra.user_id, ra.community_id, cm.created_at AS joined_at
    FROM role_assignments ra JOIN community_roles cr ON cr.id = ra.role_id
    JOIN community_members cm ON cm.community_id = ra.community_id AND cm.user_id = ra.user_id
    WHERE cr.name = 'Yeni Üzv' AND (p_community_id IS NULL OR ra.community_id = p_community_id)
    AND cm.created_at < NOW() - INTERVAL '5 days'
  ) LOOP
    INSERT INTO community_roles (community_id, name, color, icon, permissions)
    VALUES (rec.community_id, 'Kidemli Üzv', '#FFD93D', 'sparkles-outline', '{"manage_channels": false, "manage_roles": false, "manage_members": false, "manage_messages": false}')
    ON CONFLICT (community_id, name) DO NOTHING;
    SELECT id INTO kidemli_role_id FROM community_roles WHERE community_id = rec.community_id AND name = 'Kidemli Üzv';
    DELETE FROM role_assignments WHERE id = rec.assignment_id;
    INSERT INTO role_assignments (community_id, user_id, role_id) VALUES (rec.community_id, rec.user_id, kidemli_role_id) ON CONFLICT (user_id, role_id) DO NOTHING;
    affected_user_id := rec.user_id; old_role := 'Yeni Üzv'; new_role := 'Kidemli Üzv'; RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ban check trigger
CREATE OR REPLACE FUNCTION check_community_ban()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM community_bans WHERE community_id = NEW.community_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Bu istifadeci topluluqdan banlanmisdir';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_check_community_ban BEFORE INSERT ON community_members FOR EACH ROW EXECUTE FUNCTION check_community_ban();

-- Banned word violations
CREATE TABLE IF NOT EXISTS banned_word_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);
ALTER TABLE banned_word_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage violations" ON banned_word_violations FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_violation(p_community_id UUID, p_user_id UUID, p_limit INTEGER)
RETURNS JSONB AS $$
DECLARE current_count INTEGER; result JSONB;
BEGIN
  INSERT INTO banned_word_violations (community_id, user_id, count) VALUES (p_community_id, p_user_id, 1)
  ON CONFLICT (community_id, user_id) DO UPDATE SET count = banned_word_violations.count + 1, updated_at = NOW()
  RETURNING count INTO current_count;
  IF current_count >= p_limit THEN
    INSERT INTO community_bans (community_id, user_id, reason, banned_by) VALUES (p_community_id, p_user_id, 'Qadağan sözlərdən təkrar istifadə', p_user_id) ON CONFLICT (community_id, user_id) DO NOTHING;
    DELETE FROM community_members WHERE community_id = p_community_id AND user_id = p_user_id;
    result := jsonb_build_object('banned', true, 'count', current_count);
  ELSE result := jsonb_build_object('banned', false, 'count', current_count);
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Community icons bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('community-icons', 'community-icons', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Anyone can view community icons" ON storage.objects FOR SELECT USING (bucket_id = 'community-icons');
CREATE POLICY "Authenticated can upload community icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'community-icons' AND auth.role() = 'authenticated');
```

### 11.13. supabase-read-status.sql

```sql
CREATE TABLE IF NOT EXISTS channel_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE channel_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own read status" ON channel_read_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own read status" ON channel_read_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own read status" ON channel_read_status FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete communities" ON communities FOR DELETE USING (owner_id = auth.uid());
```

### 11.14. supabase-storage-setup.sql

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE communities ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view post-images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Users can upload post-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view reels" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Users can upload reels" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view stories" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Users can upload stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

---

## 12. Komponentlər

| Komponent | Fayl | Təsvir |
|-----------|------|--------|
| PostCard | `src/components/PostCard.tsx` | Post göstərici (like, comment, share, repost, save) |
| ReelItem | `src/components/ReelItem.tsx` | Reel video player |
| StoryPreview | `src/components/StoryPreview.tsx` | Feed header story ring |
| StoryViewer | `src/components/StoryViewer.tsx` | Tam ekran story viewer |
| VerifiedBadge | `src/components/VerifiedBadge.tsx` | Doğrulama nişanı (gray/gold/red/bronze/platinum) |
| FormInput | `src/components/FormInput.tsx` | Animated text input |
| ReportModal | `src/components/ReportModal.tsx` | Şikayət modalı (7 səbəb) |
| NotificationBanner | `src/components/NotificationBanner.tsx` | Real-time toast bildiriş |
| AICommentSuggestions | `src/components/AICommentSuggestions.tsx` | AI şərh təklifləri (5 kateqoriya) |

---

## 13. Təhlükəsizlik / RLS Sistemi

- **Row Level Security (RLS)** bütün cədvəllərdə aktiv
- Rollar: admin, moderator, user
- Community səviyyəsində: owner, admin, moderator, custom roles
- Kanal permissionları: read, write, voice
- Auto role assignment: New Member → Senior Member (5 gün)
- Community bans + banned word violations
- **Notification preference** control
- Admin panelə yalnız role=admin və ya verified_type=red olanlar girə bilər

---

## 14. Xarici Xidmətlər

| Xidmət | URL / Konfiq | İstifadə |
|--------|--------------|----------|
| Supabase | `https://wibtcbushwojjzegyppl.supabase.co` | Backend (DB, Auth, Storage, Realtime, Functions) |
| LiveKit | `wss://ticcer-tk77dg81.livekit.cloud` | Audio/Video calls, Live streaming |
| Expo Push | `https://exp.host/--/api/v2/push/send` | Push bildirişlər |
| Expo EAS | projectId: `01fe10e8-6183-4ecc-a01b-0340d33db7b4` | Build & Deploy |
| Firebase | `google-services.json` | Android Push Notifications |
| OneSignal | (script ilə setup) | Alternative push notifications |

---

## 15. Logoların İstifadə Yerləri

### Logo 1 (Tətbiq İkonası - Sadə İkon)

| İstifadə yeri | Tətbiqi |
|---------------|---------|
| **Tətbiq İkonası (App Icon)** | Google Play Store, Apple App Store və istifadəçinin telefonunun ekranında (Home Screen). İkonu dördbucaqlı (köşələri yuvarlaqlaşdırılmış) mavi qradiyent və ya ağ fonda yerləşdirərək ana tətbiq ikonası kimi istifadə edin. |
| **Top-Header (Tətbiqdaxili Üst Panel)** | Ana Səhifə (Home), Mesajlar (Inbox), Profil və İş İlanları səhifələrinin yuxarı sol köşəsində. Başlıq hissəsində böyük mətn yerinə bu kiçik ikonu qoymaq interfeysi daha təmiz və müasir göstərir. |
| **Splash Screen (Açılış Ekranı)** | Tətbiq ilk açılarkən 1-2 saniyəlik yüklənmə ekranında. Ekranın mərkəzində sadəcə bu ikonu (bəlkə yüngül bir animasiya ilə) göstərə bilərsiniz. |
| **Favicon & Bildirişlər (Notifications)** | Web saytınızın brauzer sekmesindəki kiçik simvol kimi və ya istifadəçilərə gedən push bildirişlərin sol tərəfindəki ikon kimi. |

### Logo 2 (Tam Loqo - Mətnli Loqo)

| İstifadə yeri | Tətbiqi |
|---------------|---------|
| **Giriş və Qeydiyyat Ekranları (Auth Screens)** | Sign In, Sign Up və Onboarding (ilk tanışlıq) ekranlarının yuxarı hissəsində. İstifadəçi hesabına daxil olarkən brendin adını tam şəkildə görməlidir. |

---

## 16. Rəng Paletləri və Text Kodları

### Rəng Kodları

| Rol | Kod |
|-----|-----|
| **Primary** | `#4D96FF` |
| **Secondary** | `#2ECC71` |
| **Tertiary** | `#DC8000` |
| **Neutral** | `#121212` |

### Text Fontları

| Tip | Font |
|-----|------|
| **Headline** | `Be Vietnam Pro` |
| **Body** | `Be Vietnam Pro` |
| **Label** | `Be Vietnam Pro` |
