import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: GOLD,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false, title: "Your Library" }}
      />
      <Stack.Screen name="favorites" options={{ title: "Favorites" }} />
      <Stack.Screen name="downloads" options={{ title: "Downloads" }} />
      <Stack.Screen name="my-playlist/[id]" options={{ title: "Playlist" }} />
    </Stack>
  );
}
