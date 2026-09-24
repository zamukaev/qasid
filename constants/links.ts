/**
 * Share links.
 *
 * These are Universal Links (iOS) / App Links (Android): the host serves
 * `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
 * claiming SHARE_PATH, so a tap opens the app straight at the track. Without
 * the app installed the same URL is an ordinary web page with a store button,
 * which is why the share link is an `https://` URL and not a `qasid://` one.
 *
 * SHARE_PATH must stay in sync with three places outside this file:
 * the `paths` in apple-app-site-association, the Android intent filter's
 * `pathPrefix` in app.json, and the route at `app/t/index.tsx`.
 */
export const SHARE_ORIGIN = "https://qasid-sound.com";
export const SHARE_PATH = "/t";

/** Query keys the share route reads — see `app/t/index.tsx`. */
export const SHARE_PARAM_NASHEED = "n";
export const SHARE_PARAM_RECITER = "r";
export const SHARE_PARAM_SURAH = "s";

export function buildNasheedShareUrl(nasheedId: string): string {
  return `${SHARE_ORIGIN}${SHARE_PATH}/?${SHARE_PARAM_NASHEED}=${encodeURIComponent(nasheedId)}`;
}

export function buildSurahShareUrl(
  reciterId: string,
  surahNumber: number,
): string {
  return (
    `${SHARE_ORIGIN}${SHARE_PATH}/` +
    `?${SHARE_PARAM_RECITER}=${encodeURIComponent(reciterId)}` +
    `&${SHARE_PARAM_SURAH}=${surahNumber}`
  );
}
