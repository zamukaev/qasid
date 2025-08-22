import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";

export default function _AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="welcome" options={{ headerTitle: "welcome" }} />
      <Stack.Screen name="signin" options={{ headerTitle: "log in" }} />
      <Stack.Screen name="signup" options={{ headerTitle: "sign up" }} />
    </Stack>
  );
}
