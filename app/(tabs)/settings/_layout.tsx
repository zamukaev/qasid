import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";

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
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile Settings",
          headerBackTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="contact-support"
        options={{
          title: "Contact & Support",
          headerBackTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="terms-privacy"
        options={{
          title: "Terms & Privacy",
          headerBackTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="downloads"
        options={{
          title: "Downloads",
          headerBackTitle: "Settings",
        }}
      />
    </Stack>
  );
}
