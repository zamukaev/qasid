import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";

export default function NasheedLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="all-artists" options={{ title: "All Artists" }} />
      <Stack.Screen
        name="artist/[id]"
        options={{
          title: "Artist",
        }}
      />
      <Stack.Screen name="playlist/[id]" options={{ title: "Playlist" }} />
      <Stack.Screen name="generated/[key]" options={{ title: "Playlist" }} />
      <Stack.Screen name="mix/index" options={{ title: "Weekly Mix" }} />
      <Stack.Screen name="favorites" options={{ title: "Favorites" }} />
    </Stack>
  );
}
