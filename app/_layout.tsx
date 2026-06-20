import { Stack } from "expo-router";
import { GOLD } from "../constants/colors";
import { AudioPlayerProvider } from "../context/AudioPlayerContext";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { Platform } from "react-native";
import { useEffect } from "react";

import Purchases, { LOG_LEVEL } from "react-native-purchases";

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
  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    if (Platform.OS === "ios" && iosApiKey) {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === "android" && androidApiKey) {
      Purchases.configure({ apiKey: androidApiKey });
    }
  }, []);
  return (
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
    </AudioPlayerProvider>
  );
}
