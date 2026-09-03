# Changelog

All notable changes to **Qasid** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions map to the `version` field in `app.json` / `package.json`, bumped via
`npm run version`.

---

## [1.1.0] — Unreleased

Work in progress on branch `releas/1-1-0`.

### Added

- **In-app store review prompt.** New `services/review-service.ts` and
  `hooks/useReviewPrompt.ts` request the native review sheet only from engaged
  users: 5 qualified listens (30 s of actual playback each, Quran and Nasheeds
  combined) or 7 days installed with app opens on at least 3 distinct days.
  Capped at 3 prompts per user with a 120-day cooldown, never shown over the
  full-screen player, and always deferred to a calm moment (4 s after app open
  or foreground).
- **"Rate Qasid" row in Settings** as a manual fallback, since the native sheet
  can silently decline to appear once the OS quota is spent. Opens the store
  listing straight at the review composer, via `ios.appStoreUrl` and
  `android.playStoreUrl` in `app.json` — `expo-store-review` reads the link from
  there and derives nothing from the bundle identifier, so the row stays hidden
  on any platform whose URL is missing.
- **Admin playlist tools.** `AdminPlaylistButton` and `PlaylistPickerModal` let
  allow-listed admin accounts (`constants/admin.ts`, `hooks/useIsAdmin.ts`) add
  nasheeds to curated playlists straight from the artist screen, backed by new
  Firestore rules and a `run-daily-recommendations` script.
- **Google/Apple profile photo** is now shown in Settings instead of the initial
  letter avatar when the account has one.
- **Firebase Analytics for the playback funnel.** `services/analytics.ts`
  mirrors the `started` / `qualified` / `completed` playback events that already
  land in the `reciter_plays` / `artist_plays` collections into GA4 as
  `quran_playback` and `nasheed_playback`, and sets the user id plus a
  `subscription_plan` user property. Firestore stays the source of truth for
  recommendations and trending; Analytics only adds the funnel view. Every call
  swallows its own errors and is fired before the Firestore write, so the funnel
  survives a skipped or failing write and analytics can never delay playback.
  Installed without ad-identifier support
  (`$RNFirebaseAnalyticsWithoutAdIdSupport` in `ios/Podfile`), so the app
  collects no IDFA and needs no ATT prompt.
- **"Share usage data" toggle** in a new Privacy section in Settings. Opt-out by
  default, persisted in AsyncStorage and hydrated in `app/_layout.tsx` before
  any screen can log an event.

### Changed

- **Favorites state centralized in a Zustand store** (`stores/favoritesStore.ts`).
  Favorite toggles are now optimistic and instantly consistent across the artist
  screen, Weekly Mix, generated playlists, and the favorites tab — no more
  per-screen fetching and drifting UI state.
- Nasheed seed scripts (`seed-nasheed-artists`, `seed-nasheeds-abu-ali`)
  updated for the current schema.
- Settings and profile screens are fully in English — the delete-account,
  change-password and profile-picture flows still had German copy from an early
  draft.
- `seed-nasheed-artists` now seeds Musab Al Adani instead of Khalid al-Haqqan.
- Artist screen's play button reads "Play All" instead of "Play".

### Fixed

- **Premium paywall no longer renders empty and silent** when RevenueCat
  offerings fail to load. The failure is surfaced with an explanatory message
  and a retry instead of an inert screen.
- **The "Made for You" Weekly Mix tile never appeared for anyone.**
  `user_recommendations/{uid}.weekly_mix` was written only by the on-demand
  `generateWeeklyMix` endpoint, which was called only from the mix screen —
  a screen reachable only through the tile that required the document to
  already exist. `dailyRecommendationJob` writes `generated_playlists` and
  never touches `user_recommendations`, so the mix could never bootstrap
  itself. New `ensureWeeklyMix()` in `services/recommendations-service.ts`
  reads the mix, treats it as stale after 7 days, and generates one when
  needed — guarded by a 6 h retry throttle and in-flight de-duplication, and
  never throwing, since a stale mix beats an error state.
- **Weekly Mix and favorites rails stayed empty until a manual pull-to-refresh**
  on a cold start. The home screen loaded them before Firebase had restored the
  session, so the queries ran with a null uid; they now wait for auth to settle.
- `FirebaseSurah.transliteration` is optional, matching the documents that
  genuinely lack it, and a stray `import { title } from "process"` is gone from
  the settings layout.

---

## [1.0.0] — 2026-06-29

First App Store release.

### Added

- **Quran tab** — reciter browsing, reciter detail screens with full surah
  lists, featured reciters and collections, cursor-paginated "all reciters"
  grid, and Cloud Function-backed search over reciters and surahs.
- **Nasheeds tab** — artists, artist detail screens, curated playlists,
  favorites, and artist search.
- **Recommendations** — Weekly Mix and automatically generated playlists driven
  by Cloud Functions over listening history and nasheed moods.
- **Audio playback on `react-native-track-player` v4** — the full queue is
  loaded into the native player, so next/previous, lock-screen controls, and
  Bluetooth controls work everywhere. Sequential, shuffle, and repeat-one modes
  are synced to the native repeat mode.
- **Background playback** via a HeadlessJS `PlaybackService`, with
  `HeadlessJsMediaService` on Android and the `audio` background mode on iOS.
- **Mini player and full-screen player**, plus a "Continue listening" block;
  playback position is persisted every 2.5 s and cleared once a track is ~98%
  complete.
- **Offline mode** — downloads for offline listening.
- **Authentication** — Firebase email/password, Google, and Sign in with Apple,
  with a mandatory email-verification gate before any tab content is reachable.
- **Premium subscriptions via RevenueCat** (entitlement `qasid Premium`), a
  paywall screen, restore purchases, and a free-tier limit of 5 nasheeds per
  day for non-subscribers.
- **Settings** — profile editing, notification preferences, app version,
  contact & support, and terms & privacy.
- **Push notifications** for new content, delivered over FCM topics.
- **Playback analytics** — qualified plays recorded to the `reciter_plays` and
  `artist_plays` collections.

### Changed

- Quran content is served from the internal Firebase backend instead of the
  external `mp3quran.net` API.
- Nasheeds screen redesigned; Quran screen, filters, and mini player reworked
  across several passes.
- Track collection screens consolidated behind shared
  `TrackCollectionScreen` / `TrackCollectionRow` components with skeleton
  loading states and shimmer placeholders for images.

### Fixed

- **iOS watchdog crash (`0x8BADF00D`) on real devices** — caused by Fabric plus
  the JS-driven live equalizer. Fixed by disabling the New Architecture and
  pausing the equalizer in the background.
- **Xcode 26.4 build failure** — the `fmt` pod is now built as C++17, made
  durable across prebuilds by a config plugin.
- Sign-in failures, premium screen issues, free nasheed-limit counting, search,
  and header layout bugs.
- `ITSAppUsesNonExemptEncryption` declared in `app.json` so App Store uploads no
  longer stall on the encryption question.

### Performance

- Storage URLs resolved in parallel with per-track resilience, so one bad track
  no longer breaks a generated playlist.
- Persistent Storage URL cache hydrated at launch
  (`hydrateStorageUrlCache`) and progressive URL resolution for long lists
  (`useProgressiveStorageUrls`).
- Broad list-rendering and image-loading optimizations across the nasheed and
  reciter screens.
