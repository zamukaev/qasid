import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";

export default function QuranLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: GOLD,
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
        name="reciter/[id]"
        options={{
          title: "Reciter",
          headerBackTitle: "Reciters",
        }}
      />
    </Stack>
  );
}
