import { Stack } from "expo-router";

export default function NasheedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: "#C9A84C",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="all-artists"
        options={{
          title: "All Artists",
        }}
      />
      <Stack.Screen
        name="artist/[id]"
        options={{
          title: "Artist",
          headerBackTitle: "Artists",
        }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{
          title: "Playlist",
          headerBackTitle: "Playlists",
        }}
      />
    </Stack>
  );
}
