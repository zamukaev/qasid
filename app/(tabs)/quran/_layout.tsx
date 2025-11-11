import { Stack } from "expo-router";

export default function QuranLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: "#E7C11C",
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
        name="all-reciters"
        options={{
          title: "All Reciters",
          headerBackTitle: "Quran",
        }}
      />
      <Stack.Screen
        name="surah/[id]"
        options={{
          title: "Surah",
        }}
      />
    </Stack>
  );
}

