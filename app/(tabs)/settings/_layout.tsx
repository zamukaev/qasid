import { Stack } from "expo-router";

export default function SettingsLayout() {
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
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="premium"
        options={{
          headerBackTitle: "Settings",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
