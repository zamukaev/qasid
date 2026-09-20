import { Platform, Share } from "react-native";
import Constants from "expo-constants";

const APP_NAME = "QASID";
const PLAY_STORE_DETAILS = "https://play.google.com/store/apps/details";

/**
 * The plain store page for this app, for "get the app" links.
 *
 * Deliberately not `getStoreReviewUrl()` from review-service: app.json's
 * `ios.appStoreUrl` / `android.playStoreUrl` carry review-only query params
 * (`action=write-review`, `showAllReviews`) that would drop a friend straight
 * into the rating form.
 */
export function getStoreShareUrl(): string | null {
  const config = Constants.expoConfig;

  if (Platform.OS === "ios") {
    const appStoreUrl = config?.ios?.appStoreUrl;
    return appStoreUrl ? appStoreUrl.split("?")[0] : null;
  }

  // Rebuilt from the application id rather than trimmed, because the Play
  // Store URL needs its `?id=` to resolve at all.
  const applicationId = config?.android?.package;
  return applicationId ? `${PLAY_STORE_DETAILS}?id=${applicationId}` : null;
}

/**
 * Opens the OS share sheet for one track.
 *
 * `trackUrl` is a Universal/App Link built by constants/links.ts, so a tap
 * opens the app at that track — and, without the app, the web page that offers
 * the store. The store URL is only the fallback for when the link cannot be
 * built at all.
 */
export async function shareTrack(
  title: string,
  subtitle: string | undefined,
  trackUrl: string | null,
): Promise<void> {
  const heading = subtitle ? `"${title}" — ${subtitle}` : `"${title}"`;
  const url = trackUrl ?? getStoreShareUrl();

  try {
    if (!url) {
      await Share.share({ message: `${heading}\n\nListen on ${APP_NAME}.` });
      return;
    }

    const message = `${heading}\n\nListen on ${APP_NAME}:`;
    if (Platform.OS === "ios") {
      // iOS takes the link as its own item so Messages and Mail render a
      // preview card; putting it in `message` too would duplicate it.
      await Share.share({ message, url });
      return;
    }
    // Android reads `message` only — the link has to live inside the text.
    await Share.share(
      { message: `${message}\n${url}` },
      { dialogTitle: `Share ${title}` },
    );
  } catch {
    // Dismissing the sheet rejects on some Android targets; nothing to do.
  }
}
