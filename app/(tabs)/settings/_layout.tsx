import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
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
        name="contact-support"
        options={{
          title: "Contact & Support",
          headerBackTitle: "Settings",
        }}
      />
    </Stack>
  );
}
