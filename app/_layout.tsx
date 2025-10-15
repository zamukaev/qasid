import { getAuth } from "@react-native-firebase/auth";
import { Stack } from "expo-router";
import { AudioPlayerProvider } from "../context/AudioPlayerContext";

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
