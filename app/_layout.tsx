import { Stack } from "expo-router";
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
  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = "test_EdKpJMOxxEmeVEdSEDZnxswKOVJ";
    const androidApiKey = "test_EdKpJMOxxEmeVEdSEDZnxswKOVJ";

    if (Platform.OS === "ios") {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === "android") {
      Purchases.configure({ apiKey: androidApiKey });
    }
  }, []);
  return (
    <AudioPlayerProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: "#090A07" },
          headerTintColor: "#C9A84C",
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AudioPlayerProvider>
  );
}
