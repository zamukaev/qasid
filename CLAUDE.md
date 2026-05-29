# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

**Qasid** is an Islamic audio streaming app for Quran recitations and Nasheeds (Islamic songs), built with Expo + React Native, Firebase backend, and `react-native-track-player` (RNTP) for audio.

## Commands

```bash
# Start dev server
npx expo start

# Run on device/simulator
npx expo run:ios
npx expo run:android

# Seed Firestore data (requires scripts/serviceAccountKey.json)
npm run seed:artists
npm run seed:nasheeds-abu-ali

# Bump version (updates app.json, commits, tags, and pushes)
npm run version
```

There are no test or lint scripts configured.

## Architecture

### Navigation — Expo Router (file-based)

```
app/index.tsx                    ← auth gate + welcome screen
app/(auth)/signin/               ← sign-in screens (index = provider picker, email = form)
app/(auth)/signup/               ← sign-up screens (index = provider picker, email = form)
app/(auth)/verify-email.tsx      ← email verification wall
app/(tabs)/quran/                ← Quran recitations tab
app/(tabs)/nasheeds/             ← Nasheeds tab
app/(tabs)/settings/             ← Settings tab
```

Auth routing is enforced in two places: `app/index.tsx` listens to `onAuthStateChanged` and redirects based on `user` + `emailVerified`; `app/(tabs)/_layout.tsx` also listens and kicks unauthenticated users back to the welcome screen.

### Auth Flow

Three-state gate in `app/index.tsx`:
1. No user → welcome screen (sign up / sign in)
2. User exists but `emailVerified === false` → redirect to `/verify-email`
3. User exists and verified → redirect to `(tabs)/quran`

Email verification is required before accessing any tab content. `useAuth()` (`hooks/useAuth.ts`) is a thin wrapper over `useUserStore` that surfaces `{ user, emailVerified, loading }`.

### State Management — Hybrid

| Layer | Tool | What it holds |
|---|---|---|
| Global user auth + subscription | **Zustand** (`stores/userStore.ts`) | Firebase user, isAuthenticated, isLoading, currentPlan |
| Audio playback | **React Context** (`context/AudioPlayerContext.tsx`) | Queue, currentTrack, position, progress map, repeat mode, view mode |

### Premium / Monetization

RevenueCat (`react-native-purchases`) manages subscriptions. The entitlement ID is `"qasid Premium"`. Product identifiers: `com.abusafiia.qasid.premium.yearly` (yearly) and anything else maps to `"monthly"`. `currentPlan` on `useUserStore` is one of `"free" | "monthly" | "yearly" | "family"`.

RevenueCat is initialized on auth state change (`app/index.tsx`) via `RevenueCatService.initialize(uid)`. Use `useRevenueCat()` hook for UI-level purchase and restore flows; use `services/revenuecat.ts` functions for lower-level access.

**Free-tier nasheed limit:** Free users can play 5 nasheeds per day. This is tracked by `hooks/useNasheedLimit.ts`, which uses module-level singleton state (not React state) so all instances and the layout guard share one counter. Key pattern: before calling `playTrack()` for a manual tap, call `markManualPlay()` so the layout's `useEffect` watcher skips double-counting auto-advances. The layout (`app/(tabs)/nasheeds/_layout.tsx`) detects track changes that are auto-advances and calls `incrementNasheedCount()` for those.

### Audio Architecture (critical — read before touching)

Audio uses **`react-native-track-player` v4.1.2**, not `expo-audio`. `expo-audio` is still in package.json but only used in the reciter screen to probe track durations.

**How it works:**
- `playTrack(track, queue)` resolves all Firebase Storage URLs in parallel, then calls `TrackPlayer.reset()` + `TrackPlayer.add(allTracks)` + rotates the queue so the tapped track is index 0 — the **full queue is always loaded into RNTP**.
- `setQueue()` updates `queueRef` synchronously (not via `useEffect`) so `playTrack` reads the latest queue immediately.
- `PlaybackActiveTrackChanged` event syncs React `currentTrack` state when RNTP auto-advances or a remote skip fires.
- `RepeatMode` is synced to RNTP's native `RepeatMode` enum (Track / Queue / Off).
- Playback position is persisted to AsyncStorage every 2.5 s (key: `@qasid-reciter-progress`); cleared when position > 98% (track considered complete).
- `isPlaying` is debounced 150 ms to suppress rapid state oscillations during `reset → add → skip → play`.

**Background playback:**
- `services/PlaybackService.ts` is a HeadlessJS task registered at app launch (`index.js`). It handles remote play/pause/next/prev by calling RNTP methods directly — **no `DeviceEventEmitter`** (doesn't work across HeadlessJS contexts on Android).
- Android: `HeadlessJsMediaService` is declared in `AndroidManifest.xml`.
- iOS: `UIBackgroundModes: [audio]` is in `Info.plist`.

**Rule:** Any future audio work must use RNTP queue management. Never rely on React-state-only queue for skip/next/prev to work on lock screen or Bluetooth controls.

### Firebase Services (`services/`)

Firebase project ID: `qasid-fd80d`. All Firestore/Storage access uses `@react-native-firebase/*` (not the web SDK).

- `quran-service.ts` — Firestore queries for reciters and surahs, cursor-based pagination, search via Cloud Function, playback analytics events (`reciter_plays` collection)
- `nasheeds-service.ts` — Firestore queries for nasheed artists and songs, search via Cloud Function, playback analytics events (`artist_plays` collection)
- `featured-service.ts` — Featured collections and reciters
- `playlists-service.ts` — Nasheed playlist queries
- `recents-service.ts` — Recently played tracking
- `profile-service.ts` — User profile reads/writes

Search Cloud Functions (with Firestore fallback built in):
- `https://us-central1-qasid-fd80d.cloudfunctions.net/searchReciters`
- `https://us-central1-qasid-fd80d.cloudfunctions.net/searchSurahs`
- `https://us-central1-qasid-fd80d.cloudfunctions.net/searchArtists`

Firebase Storage paths (not full URLs) are stored in Firestore; `resolveTrackUrl()` in `AudioPlayerContext` converts them to signed download URLs on demand via `getDownloadURL`.

### Styling

NativeWind (Tailwind CSS for React Native). Custom theme colors: `qasid-gold` (`#E7C11C`) and `qasid-black` (`#0B0B0B`). No separate stylesheets — all inline Tailwind classes.

### Key Config Files

- `app.json` — Expo config, Firebase plugin registration, `newArchEnabled: true`, `edgeToEdgeEnabled: true` (Android)
- `babel.config.js` — includes `nativewind/babel` and `react-native-reanimated/plugin`
- `metro.config.js` — NativeWind integration with `global.css`
- `tailwind.config.js` — custom color palette and border radius
- `google-services.json` / `GoogleService-Info.plist` — Firebase credentials (root level)
- `.env` — `EXPO_PUBLIC_BASE_URL` for external Quran API (`mp3quran.net`)
- `scripts/serviceAccountKey.json` — Firebase Admin SDK key (not committed, required for seed scripts)
