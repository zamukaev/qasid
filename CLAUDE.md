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

# Start Metro only
npx expo start --web
```

There are no test or lint scripts configured.

## Architecture

### Navigation — Expo Router (file-based)

```
app/index.tsx           ← auth gate: redirects to (tabs) or shows welcome
app/(auth)/             ← signin / signup screens
app/(tabs)/quran/       ← Quran recitations tab
app/(tabs)/nasheeds/    ← Nasheeds tab
app/(tabs)/settings/    ← Settings tab
```

The root `_layout.tsx` wraps everything in `AudioPlayerProvider`.

### State Management — Hybrid

| Layer | Tool | What it holds |
|---|---|---|
| Global user auth | **Zustand** (`stores/userStore.ts`) | Firebase user, isAuthenticated, isLoading |
| Audio playback | **React Context** (`context/AudioPlayerContext.tsx`) | Queue, currentTrack, position, progress map, repeat mode, view mode |

### Audio Architecture (critical — read before touching)

Audio uses **`react-native-track-player` v4.1.2**, not `expo-audio`. `expo-audio` is still in package.json but only used in the reciter screen to probe track durations.

**How it works:**
- `playTrack(track, queue)` resolves all Firebase Storage URLs in parallel, then calls `TrackPlayer.reset()` + `TrackPlayer.add(allTracks)` + `TrackPlayer.skip(idx)` — the **full queue is always loaded into RNTP**.
- `setQueue()` updates `queueRef` synchronously (not via `useEffect`) so `playTrack` reads the latest queue immediately.
- `PlaybackActiveTrackChanged` event syncs React `currentTrack` state when RNTP auto-advances or a remote skip fires.
- `RepeatMode` is synced to RNTP's native `RepeatMode` enum (Track / Queue / Off).
- Playback position is persisted to AsyncStorage every 2.5 s (key: `@qasid-reciter-progress`); skipped when position > 98% (track considered complete).

**Background playback:**
- `services/PlaybackService.ts` is a HeadlessJS task registered at app launch (`index.js`). It handles remote play/pause/next/prev by calling RNTP methods directly — **no `DeviceEventEmitter`** (doesn't work across HeadlessJS contexts on Android).
- Android: `HeadlessJsMediaService` is declared in `AndroidManifest.xml`.
- iOS: `UIBackgroundModes: [audio]` is in `Info.plist`.

**Rule:** Any future audio work must use RNTP queue management. Never rely on React-state-only queue for skip/next/prev to work on lock screen or Bluetooth controls.

### Firebase Services (`services/`)

- `quran-service.ts` — Firestore queries for reciters and surahs, pagination, search via Cloud Function, playback analytics events
- `nasheeds-service.ts` — Firestore queries for songs with mood filtering and pagination
- `featured-service.ts` — Featured collections and reciters
- Search Cloud Functions: `https://us-central1-qasid-fd80d.cloudfunctions.net/searchReciters` and `/searchSurahs`

### Styling

NativeWind (Tailwind CSS for React Native). Custom theme colors: `qasid-gold` (`#E7C11C`) and `qasid-black` (`#0B0B0B`). No separate stylesheets — all inline Tailwind classes.

### Key Config Files

- `app.json` — Expo config, Firebase plugin registration, `newArchEnabled: true`, `edgeToEdgeEnabled: true` (Android)
- `babel.config.js` — includes `nativewind/babel` and `react-native-reanimated/plugin`
- `metro.config.js` — NativeWind integration with `global.css`
- `tailwind.config.js` — custom color palette and border radius
- `google-services.json` / `GoogleService-Info.plist` — Firebase credentials (root level)
- `.env` — `EXPO_PUBLIC_BASE_URL` for external Quran API (`mp3quran.net`)
