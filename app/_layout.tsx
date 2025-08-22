import { Redirect, Stack } from "expo-router";
import { useState } from "react";
export default function RootLayout() {
  const auth = false;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: "#E7C11C",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
