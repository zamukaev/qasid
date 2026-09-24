# Share links (Universal Links / App Links)

Sharing a track from the `⋯` menu sends an `https://qasid-sound.com/t/…` URL.
Tapping it opens the app straight at that track; without the app it opens a web
page offering the store.

## Link format

| Kind    | URL                                              |
| ------- | ------------------------------------------------ |
| Nasheed | `https://qasid-sound.com/t/?n=<nasheedId>`        |
| Surah   | `https://qasid-sound.com/t/?r=<reciterId>&s=<surahNumber>` |

Built by `constants/links.ts`, resolved by the route at `app/t/index.tsx`.

`SHARE_PATH` (`/t`) appears in four places that must agree: `constants/links.ts`,
`apple-app-site-association`, the Android `intentFilters` `pathPrefix` in
`app.json`, and the route directory name.

## What ships where

**In this repo (done):**

- `app/t/index.tsx` — resolves the link, starts the track, replaces itself with
  the artist or reciter screen.
- `hooks/useAuthBootstrap.ts` — the Firebase auth subscription, mounted by the
  root layout. It used to live in `app/index.tsx`, which a cold start into a
  deep link never mounts: `isLoading` then stayed true and the share route
  waited forever on auth that nothing was resolving.
- `app/index.tsx` — the auth gate skips the share route, and replays a link that
  arrived while signed out (stashed in `utils/pendingShare.ts`).
- `app.json` — `ios.associatedDomains` and `android.intentFilters`.
- `ios/QASID/QASID.entitlements`, `android/app/src/main/AndroidManifest.xml` —
  the same config mirrored into the committed native projects, because there is
  no `.easignore` and EAS builds them as they are.

**On qasid-sound.com (you):** the files added to the `qasid-landing` project —
`t/index.html`, `.well-known/apple-app-site-association`,
`.well-known/assetlinks.json` and `.htaccess`. They live there rather than in
this repo so the site has a single source of truth.

## Deploying the website files

Upload so that these URLs resolve over HTTPS, with no redirect:

| File in `qasid-landing/`                 | Must be served at                                                |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `.well-known/apple-app-site-association`  | `https://qasid-sound.com/.well-known/apple-app-site-association`  |
| `.well-known/assetlinks.json`             | `https://qasid-sound.com/.well-known/assetlinks.json`             |
| `t/index.html`                            | `https://qasid-sound.com/t/`                                      |
| `.htaccess`                               | the site root (Apache only — see below)                           |

Both dot-files are easy to miss: many FTP clients and Finder hide them. Make
sure `.well-known/` and `.htaccess` actually made it onto the server.

The `.htaccess` forces `application/json` on the Apple file, which has no
extension and would otherwise go out as `text/plain` — a silent failure. If the
site root already has an `.htaccess`, **merge** the block rather than replacing
the file. On nginx the equivalent is a `location` block with
`default_type application/json;`.

Requirements Apple and Google both enforce:

- **`Content-Type: application/json`** on both `.well-known` files. The Apple
  file has no `.json` extension, so most servers need an explicit rule.
- **No redirect.** A 301 from apex to `www` (or to `https`) breaks verification.
- **No authentication**, and a valid certificate.

### Before uploading: fill in the Android fingerprint

`assetlinks.json` still says `REPLACE_WITH_SHA256_FROM_EAS_CREDENTIALS`. Get the
real SHA-256 of the **app-signing** key (not the upload key) with:

```bash
eas credentials -p android
```

Or in the Play Console under **Release → Setup → App signing**. Paste the
colon-separated fingerprint in place of the placeholder.

## Turning it on

The iOS entitlement and the Android intent filter are native, so this needs a
**new build** — an OTA update will not carry it.

```bash
eas build -p ios --profile production
eas build -p android --profile production
```

## Testing before the website is live

The custom scheme already works — it needs no AASA file, no App Links
verification and no new build beyond the one you are running. Expo Router maps
`qasid://t?…` onto the same `/t` route:

On a **simulator**:

```bash
npx uri-scheme open "qasid://t?n=<nasheedId>" --ios
npx uri-scheme open "qasid://t?r=<reciterId>&s=114" --android
```

On a **physical iPhone** `uri-scheme` cannot help — it drives the simulator
only. Launch the app with the URL directly instead, which is also a true cold
start:

```bash
xcrun devicectl list devices          # find the device name
xcrun devicectl device process launch \
  --device "<device name>" \
  --payload-url "qasid://t?n=<nasheedId>" \
  com.abusafiia.qasid.dev
```

Typing `qasid://…` into Safari's address bar does *not* work on recent iOS —
Safari treats an unknown scheme as a search query.

That exercises the whole in-app path: resolve, play, land on the artist or
reciter screen. Only the `https://` half depends on the website.

Kill the app first to test the cold-start path — it behaves differently from a
warm one, and cold start is what a friend tapping your link actually does.

## Verifying

```bash
# Both must return 200 with application/json and no redirect.
curl -sSI https://qasid-sound.com/.well-known/apple-app-site-association
curl -sSI https://qasid-sound.com/.well-known/assetlinks.json

# Google's own checker for the Android side.
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?\
source.web.site=https://qasid-sound.com&\
relation=delegate_permission/common.handle_all_urls"
```

On a device, with the new build installed:

1. Share a nasheed to yourself, tap the link — the app opens and the track plays.
2. Repeat for a Quran surah.
3. Sign out, tap a share link — you land on the welcome screen, and after
   signing in and verifying, the app continues to the shared track.
4. Uninstall, tap the link — the web page appears with a working store button.

Apple caches the AASA file through its CDN, so allow a little time after the
first upload, and reinstall the app to force a fresh fetch during testing.

## Known gap

Surahs shared from a **collection** screen (`content_type=collection`) fall back
to the plain store link: a collection mixes several reciters, so there is no
single `reciters/{id}/surahs` path for the link to resolve against. Regular and
featured reciters both share correctly.
