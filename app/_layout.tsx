import { Stack } from "expo-router";
import { GOLD } from "../constants/colors";
import { AudioPlayerProvider } from "../context/AudioPlayerContext";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { ErrorAlert } from "../components";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { Platform } from "react-native";
import { useEffect, useState } from "react";

import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { getApp } from "@react-native-firebase/app";
import { getMessaging, onMessage } from "@react-native-firebase/messaging";
import { hydrateStorageUrlCache } from "../services/storage";

import "../global.css";

// react-native-screens calls makeMutable() during render inside
// ScreenGestureDetector, which Reanimated strict mode flags as a warning.
// This is a known library issue — disable strict mode to suppress the noise.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  // RevenueCat aborts the app (fatalError in checkForSimulatedStoreAPIKeyInRelease)
  // if a Test/Simulated-Store key (test_…) is used in a Release build. Select the
  // key by build type so release/TestFlight ALWAYS uses the production appl_ key
  // and never crashes — instead of manually toggling comments (the old footgun).
  const iosApiKey = __DEV__
    ? process.env.EXPO_PUBLIC_IOS_TEST_API_KEY
    : process.env.EXPO_PUBLIC_IOS_API_KEY;
  const androidApiKey = __DEV__
    ? process.env.EXPO_PUBLIC_ANDROID_TEST_API_KEY
    : process.env.EXPO_PUBLIC_ANDROID_API_KEY;
  // Overlap the cache's disk read with app boot rather than paying for it on
  // the first screen that resolves a Storage path.
  useEffect(() => {
    void hydrateStorageUrlCache();
  }, []);

  useEffect(() => {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

    if (Platform.OS === "ios" && iosApiKey) {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === "android" && androidApiKey) {
      Purchases.configure({ apiKey: androidApiKey });
    }
  }, []);

  const [foregroundMessage, setForegroundMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    // FCM does not show a system notification while the app is foregrounded,
    // so surface it ourselves via the existing toast component.
    return onMessage(getMessaging(getApp()), async (message) => {
      const title = message.notification?.title;
      const body = message.notification?.body;
      if (!title && !body) return;
      setForegroundMessage([title, body].filter(Boolean).join(" — "));
    });
  }, []);
  return (
    <AppErrorBoundary>
      <AudioPlayerProvider>
        <Stack
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: "#090A07" },
            headerTintColor: GOLD,
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <ErrorAlert
          visible={foregroundMessage !== null}
          message={foregroundMessage ?? ""}
          type="info"
          onClose={() => setForegroundMessage(null)}
        />
      </AudioPlayerProvider>
    </AppErrorBoundary>
  );
}
