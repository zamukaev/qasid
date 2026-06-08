import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";
import { title } from "process";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
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
        options={{
          headerShown: false,
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile Settings",
        }}
      />
      <Stack.Screen
        name="contact-support"
        options={{
          title: "Contact & Support",
        }}
      />
      <Stack.Screen
        name="terms-privacy"
        options={{
          title: "Terms & Privacy",
        }}
      />
      <Stack.Screen
        name="downloads"
        options={{
          title: "Downloads",
        }}
      />
      <Stack.Screen name="premium" options={{ title: "Premium" }} />
    </Stack>
  );
}
