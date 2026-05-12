import { Stack } from "expo-router";
import { AudioPlayerProvider } from "../context/AudioPlayerContext";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import "../global.css";

// react-native-screens calls makeMutable() during render inside
// ScreenGestureDetector, which Reanimated strict mode flags as a warning.
// This is a known library issue — disable strict mode to suppress the noise.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  return (
    <AudioPlayerProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: "#090A07" },
          headerTintColor: "#E7C11C",
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AudioPlayerProvider>
  );
}
